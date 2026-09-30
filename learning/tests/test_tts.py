from pathlib import Path
import subprocess

from learning.tts import GermanTTSService


def test_synthesize_uses_german_piper_voice(tmp_path, monkeypatch):
    model_path = tmp_path / 'de_DE-thorsten-medium.onnx'
    config_path = tmp_path / 'de_DE-thorsten-medium.onnx.json'
    model_path.write_bytes(b'model')
    config_path.write_bytes(b'config')

    service = GermanTTSService(
        voice_name='de_DE-thorsten-medium',
        voice_model=model_path,
        voice_config=config_path,
        cache_dir=tmp_path,
    )

    captured = {}

    def fake_run(command, **kwargs):
        captured['command'] = command
        out_path = Path(command[command.index('-f') + 1])
        out_path.write_bytes(b'RIFF')
        return type('Result', (), {'returncode': 0})()

    monkeypatch.setattr(subprocess, 'run', fake_run)

    result = service.synthesize('Guten Tag')

    assert result is not None
    assert result.exists()
    assert 'piper' in captured['command'][0]
    assert '-m' in captured['command']
    assert str(model_path) in captured['command']
    assert '--length-scale' in captured['command']


def test_synthesize_keeps_style_audio_in_a_separate_cache_file(tmp_path, monkeypatch):
    model_path = tmp_path / 'de_DE-thorsten-medium.onnx'
    config_path = tmp_path / 'de_DE-thorsten-medium.onnx.json'
    model_path.write_bytes(b'model')
    config_path.write_bytes(b'config')
    service = GermanTTSService(voice_model=model_path, voice_config=config_path, cache_dir=tmp_path, style='energetic')

    def fake_run(command, **kwargs):
        Path(command[command.index('-f') + 1]).write_bytes(b'RIFF')

    monkeypatch.setattr(subprocess, 'run', fake_run)
    result = service.synthesize('Guten Tag')

    assert result is not None
    assert len(result.stem) == 64
