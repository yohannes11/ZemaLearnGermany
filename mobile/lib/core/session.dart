import 'dart:io';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';

import 'api/client.dart';
import 'api/models.dart';
import 'storage.dart';
import 'sync/engine.dart';

/// The signed-in learner, or a guest. The same account works on the website.
class Session extends ChangeNotifier {
  Session._();
  static final instance = Session._();

  User? user;

  void _signedIn(User next) {
    user = next;
    Storage.instance.write('user', next.toJson());
    notifyListeners();
    sync.start();
  }

  /// Offline the saved user stands in; the server confirms the sign-in when it can be reached.
  Future<void> load() async {
    // The server no longer accepts the saved sign-in: unsent progress is kept for the next sign-in.
    Api.instance.onSignedOut = () {
      user = null;
      Storage.instance.remove('user');
      notifyListeners();
      sync.stop(forget: false);
    };
    if (await Api.instance.loadToken() == null) return;
    final saved = Storage.instance.read<Map<String, dynamic>?>('user', null);
    if (saved != null) _signedIn(User.fromJson(saved));
    Api.instance.me().then((current) {
      if (current != null) _signedIn(current);
    }, onError: (_) {});
  }

  Future<String> _deviceName() async {
    try {
      final info = DeviceInfoPlugin();
      if (Platform.isAndroid) {
        final a = await info.androidInfo;
        return '${a.manufacturer} ${a.model}';
      }
      if (Platform.isIOS) return (await info.iosInfo).name;
    } catch (_) {}
    return 'Phone';
  }

  Future<void> signIn(String login, String password) async =>
      _signedIn(await Api.instance.signIn(login, password, await _deviceName()));

  Future<void> register({required String username, required String name, required String email, required String password}) async =>
      _signedIn(await Api.instance.register(username: username, name: name, email: email, password: password, device: await _deviceName()));

  /// Sends what is waiting while the sign-in still works, then signs this phone out.
  Future<void> signOut() async {
    await sync.stop(forget: true);
    try {
      await Api.instance.signOut();
    } catch (_) {
    } finally {
      user = null;
      Storage.instance.remove('user');
      notifyListeners();
    }
  }
}

final session = Session.instance;
