import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:audio_session/audio_session.dart';
import 'package:http/http.dart' as http;
import 'package:just_audio/just_audio.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../config.dart';
import '../settings.dart';
import '../storage.dart';

/// The course's recorded audio. Clips stream from the server, and a unit can be saved so it plays offline:
/// files are kept at `<documents>/audio/<voice>/<speed>/<id>.mp3`, the same layout as on the server.
class Audio {
  Audio._();
  static final instance = Audio._();

  static const _parallelDownloads = 6;

  ApiIndex? _index;
  Map<String, String> _manifest = {};
  final _player = AudioPlayer();
  Future<void>? _loading;

  File get _manifestFile => Storage.instance.file('audio-manifest.json');
  Directory get _root => Directory('${Storage.instance.documents.path}/audio');
  Directory _dir(Voice voice, Speed speed) => Directory('${_root.path}/${voice.name}/${speed.name}');
  File _clip(Voice voice, Speed speed, String id) => File('${_dir(voice, speed).path}/$id.mp3');

  /// Loads the clip list: the saved one at once, then the server's when it can be reached. Safe to call again.
  Future<void> load() => _loading ??= _load().whenComplete(() => _loading = null);

  Future<void> _load() async {
    // Recordings are the lesson, not background noise: other audio (music, a podcast) is turned down while they play.
    try {
      final audioSession = await AudioSession.instance;
      await audioSession.configure(const AudioSessionConfiguration.speech());
    } catch (_) {}
    if (_manifestFile.existsSync()) {
      try {
        _manifest = (jsonDecode(_manifestFile.readAsStringSync()) as Map).map((k, v) => MapEntry('$k', '$v'));
      } catch (_) {}
    }
    try {
      _index = await Api.instance.index();
      final response = await http.get(Uri.parse(_index!.audioManifest)).timeout(const Duration(seconds: 20));
      if (response.statusCode == 200) {
        _manifest = (jsonDecode(utf8.decode(response.bodyBytes)) as Map).map((k, v) => MapEntry('$k', '$v'));
        await _manifestFile.writeAsString(jsonEncode(_manifest));
      }
    } catch (_) {
      // Offline: the saved list (and any saved clips) still work.
    }
  }

  /// Forgets the old server's answers and asks the current one (after its address changed under Me).
  Future<void> reload() {
    _index = null;
    return load();
  }

  /// The address of a word picture (Twemoji SVG, by its code).
  String pictureUrl(String code) => '${_index?.pictureBase ?? '${apiUrl()}/static/course/pics/'}$code.svg';

  bool hasClip(String german) => _manifest.containsKey(german);

  // Its address follows a fixed pattern, so playing doesn't depend on having reached the server at start-up.
  String _remote(Voice voice, Speed speed, String id) =>
      '${_index?.audioBase ?? '${apiUrl()}/static/audio/'}${voice.name}/${speed.name}/$id.mp3';

  /// Plays the recording of `german` (the saved copy when there is one) and completes when it ends or is
  /// interrupted. Returns false when there is no recording.
  Future<bool> play(String german, {Speed? speed}) async {
    final id = _manifest[german];
    if (id == null) return false;
    final voice = settings.voice;
    final pace = speed ?? settings.speed;
    final local = _clip(voice, pace, id);
    // Not reached at start-up (offline then, or the server moved): try again in the background.
    if (_index == null) unawaited(load());
    try {
      await _player.stop();
      if (local.existsSync()) {
        await _player.setFilePath(local.path);
      } else {
        await _player.setUrl(_remote(voice, pace, id));
      }
      await _player.play();
    } catch (_) {
      return false;
    }
    return true;
  }

  Future<void> stop() => _player.stop();

  /// Every German text in a unit that has a recording: its words, examples, tables, readings and quiz answers.
  List<String> unitTexts(Unit unit) {
    final texts = <String>{};
    for (final w in unit.words) {
      texts.add(w.german);
    }
    for (final lesson in unit.grammar) {
      for (final block in lesson.blocks) {
        texts.addAll(block.examples.map((e) => e.$1.contains('→') ? e.$1.split('→').last.trim() : e.$1));
        texts.addAll(block.table?.say ?? const []);
        texts.addAll(block.reading);
      }
      for (final item in lesson.quiz) {
        if (item.say != null) texts.add(item.say!);
      }
    }
    return texts.where(hasClip).toList();
  }

  ({int done, int total}) savedCount(Unit unit) {
    final texts = unitTexts(unit);
    final done = texts.where((t) => _clip(settings.voice, settings.speed, _manifest[t]!).existsSync()).length;
    return (done: done, total: texts.length);
  }

  /// Saves a unit's clips for offline use; saved clips are skipped, so it can resume after a break.
  Future<void> saveUnit(Unit unit, void Function(int done, int total) onProgress) async {
    if (_index == null) await load();
    final voice = settings.voice;
    final speed = settings.speed;
    await _dir(voice, speed).create(recursive: true);
    final ids = unitTexts(unit).map((t) => _manifest[t]!).toList();
    final queue = ids.where((id) => !_clip(voice, speed, id).existsSync()).toList();
    var done = ids.length - queue.length;
    onProgress(done, ids.length);
    final client = http.Client();
    Future<void> worker() async {
      while (queue.isNotEmpty) {
        final id = queue.removeLast();
        final response = await client.get(Uri.parse(_remote(voice, speed, id))).timeout(const Duration(seconds: 30));
        if (response.statusCode != 200) throw HttpException('${response.statusCode}');
        final file = _clip(voice, speed, id);
        await File('${file.path}.part').writeAsBytes(response.bodyBytes);
        await File('${file.path}.part').rename(file.path);
        onProgress(++done, ids.length);
      }
    }

    try {
      await Future.wait(List.generate(_parallelDownloads, (_) => worker()));
    } finally {
      client.close();
    }
  }

  /// Frees the space used by saved audio.
  Future<void> deleteSaved() async {
    if (_root.existsSync()) await _root.delete(recursive: true);
  }

  int savedBytes() {
    if (!_root.existsSync()) return 0;
    return _root.listSync(recursive: true).whereType<File>().fold(0, (sum, f) => sum + f.lengthSync());
  }
}

final audio = Audio.instance;
