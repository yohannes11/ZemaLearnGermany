"""Record audio for every phrase in static/course/js/course-data.js (vocabulary + grammar), and every German text
a learner can point at to hear it (tools/hover_texts.py), that is not yet in static/audio/manifest.json.

Clips are stored under the exact text the app looks up; what is spoken is that text without notes in
brackets and, for "A → B" examples, only the part after the arrow.
"""

import asyncio
import hashlib
import json
import re
import sys
from pathlib import Path

import edge_tts
from hover_texts import hover_texts

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"katja": "de-DE-KatjaNeural", "conrad": "de-DE-ConradNeural"}
SPEEDS = {"slow": "-35%", "normal": "-12%", "natural": "+0%"}
OUT = ROOT / "static" / "audio"
sem = asyncio.Semaphore(8)
failed = []


def spoken(text):
    if "→" in text:
        text = text.split("→")[-1]
    return re.sub(r"\([^)]*\)", "", text).replace("…", "").replace("  ", " ").strip() or text


def collect(course):
    texts = []
    for unit in course["units"]:
        for section in unit["sections"]:
            texts += [w["german"] for w in section["words"]]
        for lesson in unit["grammar"]:
            for block in lesson.get("blocks", []):
                texts += [de for de, _ in block.get("examples", [])]
                texts += block.get("table", {}).get("say", [])
                texts += block.get("reading", [])
                texts += [de for de, _ in block.get("glossary", [])]
            texts += [item["say"] for item in lesson.get("quiz", {}).get("items", []) if item["say"]]
    texts += hover_texts(course)
    seen, unique = set(), []
    for t in texts:
        if t not in seen:
            seen.add(t)
            unique.append(t)
    return unique


async def one(text, clip_id, vkey, skey):
    path = OUT / vkey / skey / f"{clip_id}.mp3"
    if path.exists() and path.stat().st_size:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        err = None
        for _ in range(4):
            try:
                await asyncio.wait_for(
                    edge_tts.Communicate(spoken(text), VOICES[vkey], rate=SPEEDS[skey]).save(str(path)), 40
                )
                return
            except Exception as exc:
                err = exc
                await asyncio.sleep(2)
        failed.append((text, vkey, skey, repr(err)))


async def main():
    source = (ROOT / "static" / "course" / "js" / "course-data.js").read_text(encoding="utf-8")
    course = json.loads(source[source.index("{") : source.rindex("}") + 1])
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    texts = collect(course)
    for t in texts:
        manifest.setdefault(t, hashlib.sha1(t.encode(), usedforsecurity=False).hexdigest()[:16])
    # Save the manifest first so the app can already find clips as they arrive.
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    jobs = [one(t, manifest[t], v, s) for t in texts for v in VOICES for s in SPEEDS]
    print(f"{len(texts)} phrases, {len(jobs)} clip slots", flush=True)
    done = 0
    for chunk in range(0, len(jobs), 300):
        await asyncio.gather(*jobs[chunk : chunk + 300])
        done += len(jobs[chunk : chunk + 300])
        print(f"progress {done}/{len(jobs)}", flush=True)
    print("clips on disk:", sum(1 for _ in OUT.rglob("*.mp3")), "· failed:", len(failed), flush=True)
    for f in failed[:20]:
        print("FAILED", *f, flush=True)
    sys.exit(1 if failed else 0)


asyncio.run(main())
