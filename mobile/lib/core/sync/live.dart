import 'dart:async';
import 'dart:convert';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../api/client.dart';
import '../config.dart';

/// The live connection (/ws/v1/): the server says when another device changed the learner's progress, or when an
/// admin published text. Messages only say *that* something changed; the engine then fetches it, so a message
/// lost while reconnecting costs nothing but a short delay. Closed while the app is in the background.
class Live {
  Live({required this.onProgress, required this.onContent, required this.onReconnected});

  final void Function(int revision, String origin) onProgress;
  final void Function() onContent;
  final void Function() onReconnected;

  static const _ping = Duration(seconds: 25);

  WebSocketChannel? _socket;
  StreamSubscription<dynamic>? _messages;
  Timer? _pinger;
  Timer? _reconnect;
  var _backoff = const Duration(seconds: 1);
  var _everConnected = false;
  var _wanted = false;

  void open() {
    _wanted = true;
    final token = Api.instance.token;
    if (token == null || _socket != null) return;
    final uri = Uri.parse('${apiUrl().replaceFirst(RegExp('^http'), 'ws')}/ws/v1/');
    final socket = WebSocketChannel.connect(uri);
    _socket = socket;
    socket.ready.then((_) {
      if (_socket != socket) return;
      // The app has no cookie: it signs in with its token as the first message (never in the address, which ends up in logs).
      socket.sink.add(jsonEncode({'type': 'auth', 'token': token}));
      _backoff = const Duration(seconds: 1);
      _pinger = Timer.periodic(_ping, (_) => socket.sink.add('{"type":"ping"}'));
      if (_everConnected) onReconnected();
      _everConnected = true;
    }, onError: (_) {});
    _messages = socket.stream.listen(
      (data) {
        Map<String, dynamic> message;
        try {
          message = (jsonDecode('$data') as Map).cast();
        } catch (_) {
          return;
        }
        if (message['type'] == 'progress' && message['revision'] is num) {
          onProgress((message['revision'] as num).toInt(), message['origin'] as String? ?? '');
        }
        if (message['type'] == 'content') onContent();
      },
      onDone: () => _closed(socket),
      onError: (_) => _closed(socket),
      cancelOnError: true,
    );
  }

  void _closed(WebSocketChannel socket) {
    _pinger?.cancel();
    if (_socket != socket) return;
    _socket = null;
    if (_wanted) {
      _reconnect = Timer(_backoff, open);
      final doubled = _backoff * 2;
      _backoff = doubled > const Duration(seconds: 60) ? const Duration(seconds: 60) : doubled;
    }
  }

  /// Closes the connection; [open] reconnects (the app returning to the front).
  void pause() {
    _wanted = false;
    _reconnect?.cancel();
    _pinger?.cancel();
    final socket = _socket;
    _socket = null;
    _messages?.cancel();
    socket?.sink.close();
  }

  void close() {
    pause();
    _everConnected = false;
  }
}
