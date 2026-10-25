import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// What the app keeps on the phone:
/// - small JSON values (progress, settings) in shared preferences, read once at start and kept in memory;
/// - the sign-in token in the Keychain / Keystore;
/// - large data (the course, recordings, pictures) as files in the app's documents folder.
class Storage {
  Storage._(this._prefs, this.documents);

  static late Storage instance;

  final SharedPreferences _prefs;

  /// The app's own documents folder, for the course, recordings and pictures.
  final Directory documents;
  static const _secure = FlutterSecureStorage();

  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    instance = Storage._(prefs, await getApplicationDocumentsDirectory());
  }

  T read<T>(String key, T fallback) {
    final raw = _prefs.getString('zema.$key');
    if (raw == null) return fallback;
    try {
      return jsonDecode(raw) as T;
    } catch (_) {
      return fallback;
    }
  }

  Future<void> write(String key, Object? value) => _prefs.setString('zema.$key', jsonEncode(value));

  Future<void> remove(String key) => _prefs.remove('zema.$key');

  Future<String?> readSecret(String key) => _secure.read(key: 'zema.$key');

  Future<void> writeSecret(String key, String? value) =>
      value == null ? _secure.delete(key: 'zema.$key') : _secure.write(key: 'zema.$key', value: value);

  File file(String name) => File('${documents.path}/$name');
}
