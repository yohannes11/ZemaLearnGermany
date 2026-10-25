import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../storage.dart';
import 'models.dart';

/// A request the server answered with an error, or that never reached it (`status` 0).
class ApiError implements Exception {
  ApiError(this.message, this.status);
  final String message;
  final int status;
  bool get offline => status == 0;
  @override
  String toString() => message;
}

const _tokenKey = 'token';
const _timeout = Duration(seconds: 20);

/// Every request to /api/v1/, signed with the saved bearer token (no cookies or CSRF in a native app).
class Api {
  Api._();
  static final instance = Api._();

  final _http = http.Client();
  String? _token;

  /// Called when the server no longer accepts the saved sign-in (password changed, device removed by an admin).
  void Function()? onSignedOut;

  /// The saved sign-in, for the live connection (it signs in with the token in its first message).
  String? get token => _token;

  Future<String?> loadToken() async => _token = await Storage.instance.readSecret(_tokenKey);

  Future<void> _saveToken(String? value) async {
    _token = value;
    await Storage.instance.writeSecret(_tokenKey, value);
  }

  /// A JSON request; returns the response so callers can handle 304.
  Future<http.Response> request(String path, {String method = 'GET', Object? body, Map<String, String> headers = const {}}) async {
    final request = http.Request(method, Uri.parse('${apiUrl()}/api/v1/$path'))
      ..headers.addAll({
        'Accept': 'application/json',
        if (body != null) 'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
        ...headers,
      });
    if (body != null) request.body = jsonEncode(body);
    http.Response response;
    try {
      response = await http.Response.fromStream(await _http.send(request).timeout(_timeout));
    } catch (_) {
      throw ApiError('No connection to the server.', 0);
    }
    if (response.statusCode == 401 && _token != null) {
      await _saveToken(null);
      onSignedOut?.call();
    }
    if (response.statusCode >= 400) {
      String? message;
      try {
        message = (jsonDecode(utf8.decode(response.bodyBytes)) as Map)['error'] as String?;
      } catch (_) {}
      throw ApiError(message ?? 'The server answered ${response.statusCode}.', response.statusCode);
    }
    return response;
  }

  Future<Map<String, dynamic>> _json(String path, {String method = 'GET', Object? body}) async {
    final response = await request(path, method: method, body: body);
    return (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();
  }

  Future<ApiIndex> index() async => ApiIndex.fromJson(await _json(''));

  /// The course as raw JSON (to save as is), or null when `version` is still current (the server answers 304).
  Future<Map<String, dynamic>?> course(String lang, String? version) async {
    final response = await request('course/?lang=$lang', headers: {if (version != null) 'If-None-Match': '"$version"'});
    if (response.statusCode == 304) return null;
    return (jsonDecode(utf8.decode(response.bodyBytes)) as Map).cast<String, dynamic>();
  }

  Future<User> signIn(String login, String password, String device) async {
    final data = await _json('auth/token/', method: 'POST', body: {'login': login, 'password': password, 'device': device});
    await _saveToken(data['token'] as String);
    return User.fromJson((data['user'] as Map).cast());
  }

  Future<User> register({required String username, required String name, required String email, required String password, required String device}) async {
    final data = await _json('auth/register/',
        method: 'POST', body: {'username': username, 'name': name, 'email': email, 'password': password, 'device': device});
    await _saveToken(data['token'] as String);
    return User.fromJson((data['user'] as Map).cast());
  }

  Future<void> signOut() async {
    try {
      await request('auth/token/', method: 'DELETE');
    } finally {
      await _saveToken(null);
    }
  }

  Future<User?> me() async {
    final user = (await _json('auth/me/'))['user'];
    return user == null ? null : User.fromJson((user as Map).cast());
  }

  Future<void> changePassword(String current, String next) => _json('auth/password/', method: 'POST', body: {'current': current, 'new': next});

  Future<WhyGerman> whyGerman(String lang) async => WhyGerman.fromJson(await _json('why-german/?lang=$lang'));

  /// The account's whole state (see core/sync).
  Future<Map<String, dynamic>> getSync() => _json('sync/');

  /// Sends operations (each applied once on the server) and gets the resulting state, with every device's changes.
  Future<Map<String, dynamic>> postSync(List<Map<String, dynamic>> ops, String device) =>
      _json('sync/', method: 'POST', body: {'ops': ops, 'device': device});

  /// A link that opens the website signed in as the same learner (works once, for two minutes).
  Future<String> webSessionLink([String next = '/learn/']) async =>
      (await _json('auth/web-session/?next=${Uri.encodeQueryComponent(next)}', method: 'POST'))['url'] as String;
}
