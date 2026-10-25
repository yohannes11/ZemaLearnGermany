import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

import '../api/client.dart';
import '../storage.dart';
import 'live.dart';
import 'rules.dart';

/// The sync engine. The app records what the learner does as operations (rules.dart); what it shows is the
/// server's last state with the operations it hasn't confirmed yet applied on top, so every change appears at
/// once, offline too. Operations wait in a persisted outbox and are sent when signed in and online: right after a
/// change (a short pause gathers several), when the app comes back to the front, when the network returns, and
/// when the live connection says another device changed something. The server applies each operation once, so
/// sending again after a failure is always safe. See SYNC.md.
class SyncEngine extends ChangeNotifier {
  SyncEngine._();
  static final instance = SyncEngine._();

  static const _flushDelay = Duration(milliseconds: 800);
  static const _batch = 500;
  static const _maxOutbox = 5000;
  static const _retry = [5, 15, 30, 60];

  Map<String, dynamic>? _snapshot;
  List<Op> _outbox = [];
  String _device = '';
  int? lastSync;

  /// The learner's state, with changes not yet confirmed already applied.
  SyncState state = SyncState.empty;
  bool online = true;
  bool syncing = false;
  int get pending => _outbox.length;
  String get device => _device;
  String get platform => Platform.isIOS ? 'ios' : 'android';

  bool _signedIn = false;
  Timer? _timer;
  int _retries = 0;
  Future<void>? _inFlight;
  Live? _live;
  final _contentListeners = <VoidCallback>[];
  final _random = Random.secure();

  String newId() {
    String hex(int n) => List.generate(n, (_) => _random.nextInt(16).toRadixString(16)).join();
    return '${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}';
  }

  static String dayKey([DateTime? date]) {
    final d = date ?? DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  void _recompute() {
    final base = _snapshot == null ? SyncState.empty : SyncState.fromJson(_snapshot!);
    state = applyAll(base, _outbox);
    notifyListeners();
  }

  void _save() {
    Storage.instance.write('sync', {'snapshot': _snapshot, 'outbox': _outbox, 'device': _device, 'lastSync': lastSync});
  }

  void _schedule([Duration delay = _flushDelay]) {
    _timer?.cancel();
    if (_signedIn && _outbox.isNotEmpty) _timer = Timer(delay, flush);
  }

  /// Loads what was saved on the phone. Call once, before the first screen.
  void load() {
    final saved = Storage.instance.read<Map<String, dynamic>>('sync', {});
    _snapshot = (saved['snapshot'] as Map?)?.cast<String, dynamic>();
    _outbox = [...?(saved['outbox'] as List?)?.map((op) => (op as Map).cast<String, dynamic>())];
    _device = saved['device'] as String? ?? '';
    lastSync = (saved['lastSync'] as num?)?.toInt();
    if (_device.isEmpty) _device = '$platform-${newId()}';
    _save();
    _recompute();

    // Back in the front, or back online: catch up at once.
    AppLifecycleListener(
      onResume: () {
        _live?.open();
        if (_signedIn) flush();
      },
      onPause: () => _live?.pause(),
    );
    Connectivity().onConnectivityChanged.listen((results) {
      online = results.any((r) => r != ConnectivityResult.none);
      notifyListeners();
      if (online && _signedIn) {
        _retries = 0;
        flush();
      }
    });
  }

  /// Records something the learner did, e.g. `record({'kind': 'xp', 'amount': 10})`; it shows at once and is
  /// sent in the background. The engine adds its id, time and day.
  void record(Map<String, dynamic> op) {
    final full = {'id': newId(), 'at': DateTime.now().millisecondsSinceEpoch, 'day': dayKey(), ...op};
    _outbox = [..._outbox, full];
    if (_outbox.length > _maxOutbox) _outbox = _outbox.sublist(_outbox.length - _maxOutbox);
    _save();
    _recompute();
    _schedule();
  }

  /// Sends waiting operations (or, with none, fetches the latest state). Safe to call any time.
  Future<void> flush() {
    if (!_signedIn) return Future.value();
    if (_inFlight != null) return _inFlight!;
    _timer?.cancel();
    return _inFlight = _send().whenComplete(() => _inFlight = null);
  }

  Future<void> _send() async {
    final sending = _outbox.take(_batch).toList();
    final sent = {for (final op in sending) op['id']};
    syncing = true;
    notifyListeners();
    try {
      final snapshot = sending.isNotEmpty ? await Api.instance.postSync(sending, _device) : await Api.instance.getSync();
      // Operations recorded while the request was out stay in the outbox and keep showing on top.
      _snapshot = snapshot;
      _outbox = _outbox.where((op) => !sent.contains(op['id'])).toList();
      lastSync = DateTime.now().millisecondsSinceEpoch;
      _retries = 0;
      online = true;
    } on ApiError catch (error) {
      if (error.status == 400) {
        // The server refused this batch (sending it again can't fix it): drop it so the rest can go.
        _outbox = _outbox.where((op) => !sent.contains(op['id'])).toList();
      } else {
        online = !error.offline;
        _timer = Timer(Duration(seconds: _retry[min(_retries++, _retry.length - 1)]), flush);
      }
    } finally {
      syncing = false;
      _save();
      _recompute();
    }
    if (_outbox.isNotEmpty && _retries == 0) _schedule(Duration.zero);
  }

  /// Starts syncing for the signed-in learner. Operations recorded before signing in (as a guest) go to the
  /// account, so nothing done before signing in is lost; they merge by the same rules as everything else.
  Future<void> start() async {
    _signedIn = true;
    _live?.close();
    _live = Live(
      onProgress: (revision, origin) {
        if (origin != _device && revision != (_snapshot?['revision'] as num?)?.toInt()) flush();
      },
      onContent: () {
        for (final listener in [..._contentListeners]) {
          listener();
        }
      },
      onReconnected: flush,
    )..open();
    await flush();
  }

  /// Stops syncing. Signing out (`forget`): send what is waiting, then forget this learner's progress on the
  /// phone, where the next person may learn (it is safe in the account). A sign-in that expired: keep what wasn't
  /// sent, so it reaches the account next time.
  Future<void> stop({required bool forget}) async {
    if (forget) {
      try {
        await flush();
      } catch (_) {}
    }
    _signedIn = false;
    _live?.close();
    _live = null;
    _timer?.cancel();
    _snapshot = null;
    if (forget) _outbox = [];
    lastSync = null;
    _save();
    _recompute();
  }

  /// Called when an admin published text (the course refreshes).
  VoidCallback onContentChanged(VoidCallback listener) {
    _contentListeners.add(listener);
    return () => _contentListeners.remove(listener);
  }

  /// The open exercise to continue, if any (from this or another device).
  Map<String, dynamic>? get openSession {
    final s = state.session;
    if (s == null || s['done'] == true) return null;
    final items = s['items'] as List? ?? [];
    return ((s['position'] as num?) ?? 0) < items.length ? s : null;
  }

  /// What every saved session carries: where it was left.
  Map<String, dynamic> get sessionDefaults => {'platform': platform, 'device': _device};
}

final sync = SyncEngine.instance;
