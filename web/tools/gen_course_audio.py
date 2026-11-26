"""Record audio for every phrase in static/course/js/course-data.js (words and their example sentences, grammar), and every German text
a learner can point at to hear it (tools/hover_texts.py), that is not yet in static/audio/manifest.json.

Clips are stored under the exact text the app looks up; what is spoken is that text without notes in
brackets and, for "A → B" examples, only the part after the arrow.

    gen_course_audio.py            records what is missing
    gen_course_audio.py --fresh    records everything again into static/audio-new/, for a change of voice or
                                   speed; swap it in with --swap once every clip is there

The service can change the voice behind a name without notice (in November 2026 "Katja" became a different,
lower voice), so a change of voice means recording every clip again: the site never mixes old and new voices.
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
# Gentle changes of speed: slowing speech by a third makes the vowels drag and sound robotic.
SPEEDS = {"slow": "-25%", "normal": "-10%", "natural": "+0%"}
AUDIO = ROOT / "static" / "audio"
FRESH = "--fresh" in sys.argv
OUT = ROOT / "static" / "audio-new" if FRESH else AUDIO
sem = asyncio.Semaphore(16)
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
            texts += [de for w in section["words"] for de, _ in w.get("examples", [])]  # each word's sentences
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


async def record(text, voice, rate):
    audio = b""
    async for chunk in edge_tts.Communicate(text, voice, rate=rate).stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
    return audio


async def one(text, clip_id, vkey, skey):
    path = OUT / vkey / skey / f"{clip_id}.mp3"
    if path.exists() and path.stat().st_size:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        err = None
        for attempt in range(4):
            try:
                audio = await asyncio.wait_for(record(spoken(text), VOICES[vkey], SPEEDS[skey]), 40)
                if not audio:
                    raise RuntimeError("no audio")
                path.write_bytes(audio)  # only complete clips: a refused request never leaves an empty file
                return
            except Exception as exc:
                err = exc
                await asyncio.sleep(2 * (attempt + 1))
        failed.append((text, vkey, skey, repr(err)))


def write_mix(texts, manifest):
    """static/audio/mix.json: the clips the man says when a learner picks both voices. Woman and man take turns in
    teaching order, so every chapter, table and reading has about as many of each."""
    men, seen = [], set()
    for t in texts + list(manifest):
        clip = manifest[t]
        if clip not in seen:
            if len(seen) % 2:
                men.append(clip)
            seen.add(clip)
    (AUDIO / "mix.json").write_text(json.dumps({"conrad": men}, separators=(",", ":")), encoding="utf-8")


def swap():
    """Puts static/audio-new/ in place of static/audio/, once it holds every clip of the manifest."""
    new = ROOT / "static" / "audio-new"
    manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    missing = [
        (v, s, i) for i in set(manifest.values()) for v in VOICES for s in SPEEDS
        if not (new / v / s / f"{i}.mp3").is_file() or not (new / v / s / f"{i}.mp3").stat().st_size
    ]
    if missing:
        sys.exit(f"{len(missing)} clips still missing in {new}, e.g. {missing[:3]}; run --fresh again")
    for v in VOICES:
        for s in SPEEDS:
            old = AUDIO / v / s
            for clip in old.glob("*.mp3"):
                clip.unlink()
            for clip in (new / v / s).glob("*.mp3"):
                clip.replace(old / clip.name)
    print("swapped in", sum(1 for _ in AUDIO.rglob("*.mp3")), "clips")


async def main():
    source = (ROOT / "static" / "course" / "js" / "course-data.js").read_text(encoding="utf-8")
    course = json.loads(source[source.index("{") : source.rindex("}") + 1])
    manifest = json.loads((AUDIO / "manifest.json").read_text(encoding="utf-8"))
    texts = collect(course)
    for t in texts:
        manifest.setdefault(t, hashlib.sha1(t.encode(), usedforsecurity=False).hexdigest()[:16])
    # Save the manifest first so the app can already find clips as they arrive.
    (AUDIO / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    write_mix(texts, manifest)
    if FRESH:  # also the clips only the manifest still names (texts dropped from the course stay playable)
        texts += [t for t in manifest if t not in set(texts)]
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


if "--swap" in sys.argv:
    swap()
else:
    asyncio.run(main())
