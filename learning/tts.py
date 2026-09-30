import asyncio
import hashlib
import json
import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent / "tts_cache"

# Microsoft neural voices reached through the free edge-tts client (no API key).
# They are far more natural than any local model light enough for a laptop.
NEURAL_VOICES = {
    "de-DE-KatjaNeural": "Katja · female, clear standard German",
    "de-DE-ConradNeural": "Conrad · male, clear standard German",
    "de-DE-SeraphinaMultilingualNeural": "Seraphina · female, very expressive",
    "de-DE-FlorianMultilingualNeural": "Florian · male, very expressive",
}
DEFAULT_NEURAL_VOICE = "de-DE-KatjaNeural"
NEURAL_TIMEOUT_SECONDS = 20

# Speeds are synthesized natively (not stretched in the browser), so slow speech
# keeps natural pronunciation.
SPEEDS = {
    "slow": {"label": "Slow", "edge_rate": "-35%", "piper_length": 1.35},
    "normal": {"label": "Learner", "edge_rate": "-12%", "piper_length": 1.1},
    "natural": {"label": "Natural", "edge_rate": "+0%", "piper_length": 1.0},
}
DEFAULT_SPEED = "normal"

# Local Piper fallback, used when the neural service is unreachable (offline).
DEFAULT_VOICE = "de_DE-thorsten-medium"
DEFAULT_SPEAKER = 0
PREFERRED_VOICE_OPTIONS = (
    ("de_DE-thorsten_emotional-medium", "neutral"),
    ("de_DE-eva_k-x_low", "default"),
    ("de_DE-thorsten-medium", "default"),
)
SPEAKING_STYLES = {
    "clear": {"length_scale": 1.0, "noise_scale": 0.55, "noise_w_scale": 0.72},
    "warm": {"length_scale": 0.92, "noise_scale": 0.62, "noise_w_scale": 0.78},
    "energetic": {"length_scale": 0.84, "noise_scale": 0.7, "noise_w_scale": 0.84},
}


def _engine_setting():
    return os.environ.get("GERMAN_TTS_ENGINE", "neural").lower()


class GermanTTSService:
    def __init__(self, voice=None, speed=None, style="clear", voice_name=None, speaker=None, cache_dir=None):
        self.voice = voice if voice in NEURAL_VOICES else DEFAULT_NEURAL_VOICE
        self.speed = speed if speed in SPEEDS else DEFAULT_SPEED
        self.style = style if style in SPEAKING_STYLES else "clear"
        self.voice_name = voice_name or DEFAULT_VOICE
        self.speaker = DEFAULT_SPEAKER if speaker is None else int(speaker)
        self.cache_dir = Path(cache_dir) if cache_dir else CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.model_path = self.cache_dir / f"{self.voice_name}.onnx"
        self.config_path = self.cache_dir / f"{self.voice_name}.onnx.json"
        self.piper_bin = Path(
            os.environ.get("PIPER_BIN")
            or shutil.which("piper")
            or str(Path(__file__).resolve().parent.parent / ".venv" / "bin" / "piper")
        )

    def synthesize(self, text: str):
        text = (text or "").strip()
        if not text:
            return None
        if _engine_setting() != "piper":
            path = self._synthesize_neural(text)
            if path:
                return path
        return self._synthesize_piper(text)

    def _cache_path(self, key: str, suffix: str) -> Path:
        return self.cache_dir / f"{hashlib.sha256(key.encode('utf-8')).hexdigest()}{suffix}"

    def _synthesize_neural(self, text):
        output_path = self._cache_path(f"edge|{self.voice}|{self.speed}|{text}", ".mp3")
        if output_path.exists():
            return output_path
        try:
            import edge_tts
        except ImportError:
            logger.warning("edge-tts is not installed; using the local Piper voice.")
            return None

        tmp_path = output_path.with_suffix(".part")
        communicate = edge_tts.Communicate(text, self.voice, rate=SPEEDS[self.speed]["edge_rate"])
        try:
            asyncio.run(asyncio.wait_for(communicate.save(str(tmp_path)), NEURAL_TIMEOUT_SECONDS))
            if tmp_path.stat().st_size == 0:
                return None
            tmp_path.replace(output_path)
            return output_path
        except Exception as exc:
            logger.warning("Neural German voice unavailable (%s); using the local Piper voice.", exc)
            return None
        finally:
            tmp_path.unlink(missing_ok=True)

    def _synthesize_piper(self, text):
        if not (self.model_path.exists() and self.config_path.exists() and self.piper_bin.exists()):
            return None
        profile = SPEAKING_STYLES[self.style]
        length_scale = profile["length_scale"] * SPEEDS[self.speed]["piper_length"]
        output_path = self._cache_path(f"piper|{self.voice_name}|{self.speaker}|{self.style}|{self.speed}|{text}", ".wav")
        if output_path.exists():
            return output_path

        with tempfile.NamedTemporaryFile("w", suffix=".txt", encoding="utf-8", delete=False) as input_file:
            input_file.write(text)
            input_path = Path(input_file.name)
        command = [
            str(self.piper_bin),
            "-m", str(self.model_path),
            "-c", str(self.config_path),
            "-s", str(self.speaker),
            "-i", str(input_path),
            "-f", str(output_path),
            "--length-scale", str(length_scale),
            "--noise-scale", str(profile["noise_scale"]),
            "--noise-w-scale", str(profile["noise_w_scale"]),
            "--sentence-silence", "0.18",
        ]
        try:
            subprocess.run(command, check=True, capture_output=True)
            return output_path if output_path.exists() else None
        except (OSError, subprocess.CalledProcessError) as exc:
            logger.warning("Piper synthesis failed: %s", exc)
            return None
        finally:
            input_path.unlink(missing_ok=True)

    @classmethod
    def neural_voices(cls):
        return [{"id": voice_id, "label": label} for voice_id, label in NEURAL_VOICES.items()]

    @classmethod
    def speeds(cls):
        return [{"id": speed_id, "label": speed["label"]} for speed_id, speed in SPEEDS.items()]

    @classmethod
    def available_characters(cls, cache_dir=None):
        directory = Path(cache_dir) if cache_dir else CACHE_DIR
        characters = []
        for model, label in PREFERRED_VOICE_OPTIONS:
            config_path = directory / f"{model}.onnx.json"
            if not (directory / f"{model}.onnx").exists() or not config_path.exists():
                continue
            try:
                metadata = json.loads(config_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                metadata = {}
            speaker_map = metadata.get("speaker_id_map") or {"default": 0}
            if label not in speaker_map:
                continue
            characters.append({
                "id": f"{model}--{label}",
                "name": model,
                "speaker_label": label,
                "speaker": speaker_map[label],
                "model": model,
            })
        return characters
