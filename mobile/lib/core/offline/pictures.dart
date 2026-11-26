import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../storage.dart';
import 'audio.dart';

/// Word pictures (photos, and clock SVGs), kept on disk once seen, so they show offline afterwards.
class Pictures {
  Pictures._();
  static final instance = Pictures._();

  final _loading = <String, Future<Uint8List?>>{};

  Directory get _dir => Directory('${Storage.instance.documents.path}/pictures');

  /// The picture's file, from disk or (once) from the server; null when it can't be had.
  /// [name] is a photo's file name ('apple.jpg', or 'full/apple.jpg' for the whole photo) or a clock's code
  /// ('clock-0930', an SVG).
  Future<Uint8List?> bytes(String name) => _loading[name] ??= _fetch(name).then((data) {
        if (data == null) _loading.remove(name); // try again next time
        return data;
      });

  Future<Uint8List?> _fetch(String name) async {
    final file = File('${_dir.path}/${name.contains('.') ? name : '$name.svg'}');
    if (file.existsSync()) return file.readAsBytes();
    try {
      final response = await http.get(Uri.parse(audio.pictureUrl(name))).timeout(const Duration(seconds: 20));
      if (response.statusCode != 200) return null;
      await file.parent.create(recursive: true);
      await file.writeAsBytes(response.bodyBytes);
      return response.bodyBytes;
    } catch (_) {
      return null;
    }
  }
}
