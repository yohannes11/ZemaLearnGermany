import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api/client.dart';
import '../core/config.dart';
import '../core/course.dart';
import '../core/i18n.dart';
import '../core/offline/audio.dart';
import '../core/session.dart';
import '../core/settings.dart';
import '../core/sync/engine.dart';
import '../features/gamification/game.dart';
import '../features/gamification/tally_view.dart';
import '../features/progress/progress.dart';
import '../features/reminders/reminders.dart';
import '../ui/primitives.dart';
import '../ui/theme.dart';
import '../ui/watch.dart';

/// The website, already signed in as this learner (a link that works once, for two minutes).
Future<void> openWebsite() async {
  String url;
  try {
    url = await Api.instance.webSessionLink('/learn/');
  } on ApiError {
    url = '${apiUrl()}/learn/';
  }
  await launchUrl(Uri.parse(url), mode: LaunchMode.inAppBrowserView);
}

/// Account, stats and settings.
class MeScreen extends StatefulWidget {
  const MeScreen({super.key});

  @override
  State<MeScreen> createState() => _MeScreenState();
}

class _MeScreenState extends State<MeScreen> {
  var _reminder = reminders.settings;
  var _saved = audio.savedBytes();

  Future<void> _setReminder(ReminderSettings next) async {
    if (!await reminders.save(next)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Notifications are off. Allow them for Zema German in your phone settings to get reminders.')));
      }
      return;
    }
    setState(() => _reminder = next);
    final game = Game.current;
    await reminders.schedule(game.streak, game.practisedToday);
  }

  @override
  Widget build(BuildContext context) => Watch(builder: (context) {
        final c = context.c;
        final user = session.user;
        final game = Game.current;
        Widget stat(Widget top, String value, String label) => Expanded(
              child: Semantics(
                label: '$value $label',
                excludeSemantics: true,
                child: Column(children: [top, Txt(value, role: TextRole.heading), Txt(label, role: TextRole.caption, colour: c.muted, align: TextAlign.center)]),
              ),
            );
        Widget setting(String title, Widget control, [String? detail]) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
              Txt(title, role: TextRole.subheading),
              if (detail != null) Txt(detail, role: TextRole.caption, colour: c.muted),
              control,
            ], Space.sm));
        return Scaffold(
          appBar: AppBar(title: Txt(T('Your account'), role: TextRole.title)),
          body: PageList(children: [
            AppCard(
              raised: true,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                Row(children: [
                  Badge2(icon: user != null ? Icons.person_rounded : Icons.person_outline_rounded, colour: c.brandInk, background: c.brand, size: 52),
                  const SizedBox(width: Space.md),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Txt(user?.name.isNotEmpty == true ? user!.name : (user?.username ?? 'Guest learner'), role: TextRole.heading),
                      Txt(user != null ? '@${user.username} · syncs with the website' : 'Progress is saved on this phone only', role: TextRole.caption, colour: c.muted),
                    ]),
                  ),
                ]),
                if (user != null) const _SyncLine(),
                if (user != null) AppButton(label: 'Open the website, signed in', kind: ButtonKind.secondary, icon: Icons.open_in_new_rounded, onPressed: openWebsite),
                if (user != null)
                  AppButton(label: T('Change password'), kind: ButtonKind.secondary, icon: Icons.key_rounded, onPressed: () => _changePassword(context)),
                if (user != null)
                  AppButton(label: T('Sign out'), kind: ButtonKind.ghost, icon: Icons.logout_rounded, onPressed: session.signOut)
                else
                  AppButton(label: 'Sign in or create an account', icon: Icons.person_add_alt_rounded, onPressed: () => context.push('/sign-in')),
              ], Space.sm)),
            ),
            AppCard(
              child: Row(children: [
                stat(InkWell(onTap: () => showStreakSheet(context), child: const TallyView(size: 'compact')), '${game.streak}', 'day streak'),
                stat(Icon(Icons.bolt_rounded, color: c.xp), '${game.totalXp}', 'total XP'),
                stat(Icon(Icons.style_rounded, color: c.goldBright), '${sync.state.learned.length}', 'words'),
                stat(Icon(Icons.school_rounded, color: c.brand), '${[for (final u in course.units) ...u.grammar].where(lessonPassed).length}', 'lessons'),
              ]),
            ),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                setting(
                  T('Daily goal'),
                  Segmented<int>(label: T('Daily goal'), value: game.dailyGoal, options: [for (final g in dailyGoals) (g.xp, T(g.name))], onChanged: setDailyGoal),
                  dailyGoals.where((g) => g.xp == game.dailyGoal).firstOrNull?.time ?? T('{n} XP a day', {'n': game.dailyGoal}),
                ),
                setting(
                  'Explanations in',
                  Segmented<String>(label: 'Explanations in', value: course.lang, options: const [('en', 'English'), ('am', 'አማርኛ')], onChanged: course.setLang),
                ),
                setting(
                  T('Voice'),
                  Segmented<Voice>(
                    label: T('Voice'),
                    value: settings.voice,
                    options: [(Voice.katja, T('Selam')), (Voice.conrad, T('Dawit'))],
                    onChanged: (v) => settings.update(() => settings.voice = v),
                  ),
                ),
                setting(
                  T('Speaking speed'),
                  Segmented<Speed>(
                    label: T('Speaking speed'),
                    value: settings.speed,
                    options: [(Speed.slow, T('Slow')), (Speed.normal, T('Learner')), (Speed.natural, T('Natural'))],
                    onChanged: (v) => settings.update(() => settings.speed = v),
                  ),
                ),
                setting(
                  T('Appearance'),
                  Segmented<Appearance>(
                    label: T('Appearance'),
                    value: settings.appearance,
                    options: [(Appearance.system, 'Phone'), (Appearance.light, T('Light')), (Appearance.dark, T('Dark'))],
                    onChanged: (v) => settings.update(() => settings.appearance = v),
                  ),
                ),
                setting(
                  T('Flashcards'),
                  Segmented<String>(
                    label: T('Flashcards'),
                    value: settings.cardDirection,
                    options: [('de-en', 'DE → EN'), ('en-de', 'EN → DE'), ('mixed', 'Mixed')],
                    onChanged: (v) => settings.update(() => settings.cardDirection = v),
                  ),
                ),
                setting(
                  T('Practice'),
                  Segmented<String>(
                    label: T('Practice'),
                    value: settings.practiceDirection,
                    options: [('de-en', 'DE → EN'), ('en-de', 'EN → DE')],
                    onChanged: (v) => settings.update(() => settings.practiceDirection = v),
                  ),
                ),
              ], Space.md)),
            ),
            AppCard(
              child: Row(children: [
                Expanded(
                  child: InkWell(
                    onTap: () async {
                      final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: _reminder.hour, minute: _reminder.minute));
                      if (picked != null) await _setReminder(ReminderSettings(enabled: _reminder.enabled, hour: picked.hour, minute: picked.minute));
                    },
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Txt('Daily reminder', role: TextRole.subheading),
                      Txt('${_reminder.time} · not on days you have practised · tap to change the time', role: TextRole.caption, colour: c.muted),
                    ]),
                  ),
                ),
                Switch(value: _reminder.enabled, onChanged: (on) => _setReminder(ReminderSettings(enabled: on, hour: _reminder.hour, minute: _reminder.minute))),
              ]),
            ),
            AppCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
                const Txt('Offline recordings', role: TextRole.subheading),
                Txt('${(_saved / 1024 / 1024).toStringAsFixed(1)} MB on this phone. Save a unit from any of its word lists.', role: TextRole.caption, colour: c.muted),
                if (_saved > 0)
                  AppButton(
                    label: 'Delete saved recordings',
                    kind: ButtonKind.danger,
                    icon: Icons.delete_outline_rounded,
                    onPressed: () async {
                      await audio.deleteSaved();
                      setState(() => _saved = 0);
                    },
                  ),
              ], Space.sm)),
            ),
            if (isTestBuild) const _TestServer(),
            AppButton(
              label: 'Watch the introduction again',
              kind: ButtonKind.ghost,
              icon: Icons.play_circle_outline_rounded,
              onPressed: () => settings.update(() => settings.onboarded = false),
            ),
          ]),
        );
      });

  Future<void> _changePassword(BuildContext context) async {
    final current = TextEditingController();
    final next = TextEditingController();
    String? error;
    var busy = false;
    await showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialog) => AlertDialog(
          title: Text(T('Change password')),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: current, obscureText: true, decoration: InputDecoration(labelText: T('Current password'))),
            TextField(controller: next, obscureText: true, decoration: InputDecoration(labelText: T('New password'))),
            if (error != null) Padding(padding: const EdgeInsets.only(top: Space.sm), child: Txt(error!, colour: context.c.red)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: Text(T('Cancel'))),
            FilledButton(
              onPressed: busy
                  ? null
                  : () async {
                      final messenger = ScaffoldMessenger.of(this.context);
                      setDialog(() => busy = true);
                      try {
                        await Api.instance.changePassword(current.text, next.text);
                        if (context.mounted) Navigator.pop(context);
                        messenger.showSnackBar(SnackBar(content: Text(T('Your password has been changed.'))));
                      } on ApiError catch (e) {
                        setDialog(() {
                          error = T(e.message);
                          busy = false;
                        });
                      }
                    },
              child: Text(T('Save')),
            ),
          ],
        ),
      ),
    );
  }
}

/// Where the learner's progress stands: synced, waiting to sync, or saved on the phone while offline. Tap to sync.
class _SyncLine extends StatefulWidget {
  const _SyncLine();

  @override
  State<_SyncLine> createState() => _SyncLineState();
}

class _SyncLineState extends State<_SyncLine> {
  // "n min ago" moves on by itself.
  late final _tick = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final pending = sync.pending;
    final last = sync.lastSync;
    final ago = last == null ? null : ((DateTime.now().millisecondsSinceEpoch - last) / 60000).round().clamp(0, 1 << 30);
    final changes = '$pending ${pending == 1 ? 'change' : 'changes'}';
    final text = sync.syncing
        ? 'Syncing…'
        : !sync.online && pending > 0
            ? 'Offline · $changes saved on this phone, sent when you are back online'
            : pending > 0
                ? '$changes waiting to sync'
                : ago == null
                    ? 'Not synced yet'
                    : 'Synced with your account ${ago < 1 ? 'just now' : '$ago min ago'}';
    final ok = pending == 0 && sync.online && !sync.syncing;
    return Material(
      color: ok ? c.greenSoft : c.surface2,
      borderRadius: BorderRadius.circular(Radii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.md),
        onTap: sync.flush,
        child: Padding(
          padding: const EdgeInsets.all(Space.sm),
          child: Row(children: [
            Icon(!sync.online ? Icons.cloud_off_rounded : (ok ? Icons.cloud_done_outlined : Icons.cloud_sync_outlined), size: 18, color: ok ? c.green : c.muted),
            const SizedBox(width: Space.sm),
            Expanded(child: Txt(text, role: TextRole.caption, colour: ok ? c.green : c.muted)),
          ]),
        ),
      ),
    );
  }
}

/// Test builds talk to a computer on the local network, whose address can change (another Wi-Fi, a router
/// restart). Then nothing loads and recordings stay silent; this sets the new address without building again.
class _TestServer extends StatefulWidget {
  const _TestServer();

  @override
  State<_TestServer> createState() => _TestServerState();
}

class _TestServerState extends State<_TestServer> {
  late final _draft = TextEditingController(text: settings.serverUrl.isEmpty ? builtInApiUrl : settings.serverUrl);
  var _status = '';

  Future<void> _save() async {
    final url = _draft.text.trim().replaceFirst(RegExp(r'/+$'), '');
    settings.update(() => settings.serverUrl = url == builtInApiUrl ? '' : url);
    setState(() => _status = 'checking');
    try {
      await Api.instance.index();
      setState(() => _status = 'ok');
      audio.reload();
      course.refresh();
      if (session.user != null) sync.start();
    } on ApiError {
      setState(() => _status = 'fail');
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
        const Txt('Test server', role: TextRole.subheading),
        Txt('This test build gets its course, recordings and progress from a computer on your Wi-Fi. If that computer has a new address, enter it here.',
            role: TextRole.caption, colour: c.muted),
        TextField(
          controller: _draft,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(hintText: 'http://192.168.1.4:8000', border: OutlineInputBorder()),
        ),
        if (_status.isNotEmpty)
          Txt(
            switch (_status) {
              'checking' => 'Checking…',
              'ok' => 'Connected. Course and recordings come from here now.',
              _ => 'No answer from that address. Is the server running, on the same Wi-Fi?',
            },
            role: TextRole.caption,
            colour: _status == 'ok' ? c.green : (_status == 'fail' ? c.red : c.muted),
          ),
        AppButton(label: 'Save and connect', kind: ButtonKind.secondary, icon: Icons.lan_rounded, busy: _status == 'checking', onPressed: _save),
      ], Space.sm)),
    );
  }
}

/// Sign in, or create a free account; the same account works on the website.
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  var _creating = false;
  final _login = TextEditingController();
  final _password = TextEditingController();
  final _username = TextEditingController();
  final _name = TextEditingController();
  final _email = TextEditingController();
  String? _error;
  var _busy = false;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_creating) {
        await session.register(username: _username.text.trim(), name: _name.text.trim(), email: _email.text.trim(), password: _password.text);
      } else {
        await session.signIn(_login.text.trim(), _password.text);
      }
      if (mounted) context.pop();
    } on ApiError catch (problem) {
      setState(() => _error = T(problem.message));
    } catch (_) {
      setState(() => _error = T('Something went wrong. Please try again.'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(String label, TextEditingController controller, {bool secret = false, TextInputType? type, Iterable<String>? hints}) => TextField(
        controller: controller,
        obscureText: secret,
        keyboardType: type,
        autocorrect: false,
        autofillHints: hints,
        textCapitalization: label == T('Name') ? TextCapitalization.words : TextCapitalization.none,
        onSubmitted: secret ? (_) => _submit() : null,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      );

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Scaffold(
      appBar: AppBar(title: Txt(T('Your account'), role: TextRole.heading)),
      body: AutofillGroup(
        child: PageList(children: [
          Txt(_creating ? T('Create your account') : 'Welcome back', role: TextRole.title),
          Txt('Your words, scores, XP and streak follow you to every device and the website.', colour: c.muted),
          if (_creating) ...[
            _field(T('Name'), _name, hints: const [AutofillHints.name]),
            _field(T('Username'), _username, hints: const [AutofillHints.newUsername]),
            _field(T('Email'), _email, type: TextInputType.emailAddress, hints: const [AutofillHints.email]),
          ] else
            _field(T('Username or email'), _login, hints: const [AutofillHints.username, AutofillHints.email]),
          _field(T('Password'), _password, secret: true, hints: [_creating ? AutofillHints.newPassword : AutofillHints.password]),
          if (_error != null) Semantics(liveRegion: true, child: Txt(_error!, colour: c.red)),
          AppButton(label: _creating ? T('Create account') : T('Sign in'), busy: _busy, onPressed: _submit),
          AppButton(
            label: _creating ? 'I already have an account' : 'Create a free account',
            kind: ButtonKind.ghost,
            onPressed: () => setState(() => _creating = !_creating),
          ),
        ]),
      ),
    );
  }
}
