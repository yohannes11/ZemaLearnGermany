import 'dart:io';

import 'package:http/http.dart' as http;

import '../storage.dart';
import 'audio.dart';

/// Word pictures (Twemoji SVGs), kept on disk once seen, so they show offline afterwards.
class Pictures {
  Pictures._();
  static final instance = Pictures._();

  final _loading = <String, Future<String?>>{};

  Directory get _dir => Directory('${Storage.instance.documents.path}/pictures');

  /// The picture's SVG text, from disk or (once) from the server; null when it can't be had.
  Future<String?> svg(String code) => _loading[code] ??= _fetch(code).then((svg) {
        if (svg == null) _loading.remove(code); // try again next time
        return svg;
      });

  Future<String?> _fetch(String code) async {
    final file = File('${_dir.path}/$code.svg');
    if (file.existsSync()) return file.readAsString();
    try {
      final response = await http.get(Uri.parse(audio.pictureUrl(code))).timeout(const Duration(seconds: 20));
      if (response.statusCode != 200) return null;
      await _dir.create(recursive: true);
      await file.writeAsBytes(response.bodyBytes);
      return response.body;
    } catch (_) {
      return null;
    }
  }
}
