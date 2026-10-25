import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/settings.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../lessons/answer_check.dart';
import '../lessons/quiz_session.dart' show SessionHeader;
import '../progress/progress.dart';
import 'study_modes.dart';
import 'word_picture.dart';

const _sayTimes = 3;

enum _Dot { none, current, done, good, tried }

/// Speaking practice, as on the website: the coach (Selam or Dawit, after the chosen voice) says the word three
/// times, the middle one slowly; then the learner says it three times. With speech recognition the coach checks
/// the words; without it (or without the microphone) the learner taps "I said it". Saying it counts the word as
/// learned.
class SpeakCoach extends StatefulWidget {
  const SpeakCoach({super.key, required this.scope, this.from = 0});
  final WordScope scope;
  final int from;

  @override
  State<SpeakCoach> createState() => _SpeakCoachState();
}

class _SpeakCoachState extends State<SpeakCoach> {
  late var _index = widget.from.clamp(0, widget.scope.words.length - 1);
  final _speech = SpeechToText();
  bool? _recognition; // null until asked
  var _token = 0;
  var _running = false;
  var _done = false;
  var _talking = false;
  var _listening = false;
  var _bubbleDe = 'Los geht’s!';
  var _bubbleEn = '';
  String? _heard;
  final _listen = List.filled(_sayTimes, _Dot.none);
  final _say = List.filled(_sayTimes, _Dot.none);
  Completer<bool>? _tap;

  @override
  void initState() {
    super.initState();
    _reset();
  }

  @override
  void dispose() {
    _token++;
    _speech.cancel();
    audio.stop();
    super.dispose();
  }

  void _reset() {
    _token++;
    _speech.cancel();
    audio.stop();
    _running = false;
    _done = false;
    _talking = false;
    _listening = false;
    _heard = null;
    _tap = null;
    _listen.fillRange(0, _sayTimes, _Dot.none);
    _say.fillRange(0, _sayTimes, _Dot.none);
    _bubble('Los geht’s!', T("Hi, I'm {name}. I'll say it three times, then it's your turn.", {'name': coachName()}));
  }

  void _bubble(String de, String en) {
    _bubbleDe = de;
    _bubbleEn = en;
  }

  Future<void> _coachSays(String text, {Speed? speed}) async {
    setState(() => _talking = true);
    await audio.play(text, speed: speed);
    if (mounted) setState(() => _talking = false);
  }

  Future<void> _wait(int ms) => Future.delayed(Duration(milliseconds: ms));

  /// One attempt: recognised words when the phone can, else a tap on "I said it".
  Future<({bool spoke, String? heard, bool? match})> _hear(String target, bool Function() alive) async {
    _recognition ??= await _speech.initialize(onError: (_) {}, onStatus: (_) {});
    if (_recognition == true) {
      final done = Completer<List<String>>();
      setState(() => _listening = true);
      await _speech.listen(
        listenOptions: SpeechListenOptions(
          localeId: 'de_DE',
          listenFor: const Duration(seconds: 7),
          pauseFor: const Duration(seconds: 2),
          partialResults: false,
          cancelOnError: true,
        ),
        onResult: (r) {
          if (r.finalResult && !done.isCompleted) {
            done.complete([r.recognizedWords, ...r.alternates.map((a) => a.recognizedWords)].where((w) => w.trim().isNotEmpty).toList());
          }
        },
      );
      final heard = await done.future.timeout(const Duration(seconds: 9), onTimeout: () => const []);
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      if (!alive()) return (spoke: false, heard: null, match: null);
      if (heard.isEmpty) return (spoke: false, heard: null, match: null);
      return (spoke: true, heard: heard.first, match: soundsLike(heard, target));
    }
    _tap = Completer<bool>();
    setState(() {});
    final spoke = await _tap!.future;
    _tap = null;
    return (spoke: spoke, heard: null, match: null);
  }

  Future<void> _session() async {
    _reset();
    final token = _token;
    bool alive() => mounted && token == _token;
    final word = widget.scope.words[_index].german;
    setState(() => _running = true);

    // 1. The coach reads the word three times; the middle one slowly.
    setState(() => _bubble('Hör zu!', T('Listen carefully.')));
    await _coachSays('Hör zu!');
    for (var i = 0; i < _sayTimes; i++) {
      if (!alive()) return;
      setState(() {
        _listen[i] = _Dot.current;
        _bubble(word, i == 1 ? T('Once more, slowly.') : T('Listen · {n} of 3', {'n': i + 1}));
      });
      await _coachSays(word, speed: i == 1 ? Speed.slow : null);
      if (!alive()) return;
      setState(() => _listen[i] = _Dot.done);
      await _wait(450);
    }

    // 2. The learner says it three times, with encouragement after each try.
    var good = 0, checked = 0;
    var lastMissed = false;
    for (var i = 0; i < _sayTimes; i++) {
      if (!alive()) return;
      setState(() => _say[i] = _Dot.current);
      if (i == 0) {
        setState(() => _bubble('Jetzt du!', T('Now you. Say “{word}” out loud.', {'word': word})));
        await _coachSays('Jetzt du!');
      } else if (lastMissed) {
        setState(() => _bubble('Jetzt du!', T('Your turn · {n} of 3', {'n': i + 1})));
      } else {
        setState(() => _bubble('Noch einmal!', T('Once more · {n} of 3', {'n': i + 1})));
        await _coachSays('Noch einmal!');
      }
      ({bool spoke, String? heard, bool? match}) result;
      while (true) {
        if (!alive()) return;
        result = await _hear(word, alive);
        if (!alive()) return;
        if (result.spoke) break;
        setState(() => _bubble('Ich höre nichts…', T("I didn't hear you. Try again, a little louder.")));
        await _wait(1400);
      }
      setState(() => _heard = result.heard);
      lastMissed = result.match == false;
      if (result.match == false) {
        checked++;
        setState(() {
          _say[i] = _Dot.tried;
          _bubble('Fast! Noch einmal.', T('Almost! Listen once more and copy the sound.'));
        });
        await _coachSays('Fast! Noch einmal.');
        if (!alive()) return;
        await _coachSays(word);
      } else {
        if (result.match == true) {
          good++;
          checked++;
        }
        final praise = i.isOdd ? 'Super!' : 'Sehr gut!';
        setState(() {
          _say[i] = result.match == true ? _Dot.good : _Dot.done;
          _bubble(praise, result.match == true ? T('That sounded right!') : T('Well done!'));
        });
        await _coachSays(praise);
      }
      await _wait(500);
    }
    if (!alive()) return;

    // 3. Celebrate and count the word as learned.
    learnWord(word);
    setState(() => _bubble(
        'Wunderbar!',
        checked > 0
            ? T('You said it three times. {good} of {checked} sounded right.', {'good': good, 'checked': checked})
            : T('You said it three times. Great practice!')));
    await _coachSays('Wunderbar!');
    if (!alive()) return;
    setState(() {
      _running = false;
      _done = true;
    });
  }

  void _go(int index) => setState(() {
        _index = index;
        _reset();
      });

  Widget _dots(String label, List<_Dot> dots) {
    final c = context.c;
    return Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      SizedBox(width: 72, child: Txt(label, role: TextRole.caption, colour: c.muted)),
      for (final d in dots)
        Container(
          width: 26,
          height: 26,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: switch (d) { _Dot.good => c.green, _Dot.done => c.brand, _Dot.tried => c.goldBright, _ => c.surface2 },
            border: Border.all(color: d == _Dot.current ? c.brand : Colors.transparent, width: 2),
          ),
          child: d == _Dot.good ? Icon(Icons.check_rounded, size: 16, color: c.brandInk) : null,
        ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final words = widget.scope.words;
    final word = words[_index];
    final female = settings.voice == Voice.katja;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(children: [
            SessionHeader(done: _index + 1, total: words.length),
            const SizedBox(height: Space.md),
            Expanded(
              child: ListView(children: gapped([
                // The coach and what they say.
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  AnimatedContainer(
                    duration: Motion.base,
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: female ? c.goldSoft : c.brandSoft,
                      border: Border.all(color: _talking ? c.brand : (_listening ? c.flame : c.border), width: _talking || _listening ? 4 : 1.5),
                    ),
                    child: Icon(female ? Icons.face_3_rounded : Icons.face_6_rounded, size: 44, color: female ? c.gold : c.brand),
                  ),
                  const SizedBox(width: Space.md),
                  Expanded(
                    child: Semantics(
                      liveRegion: true,
                      child: Container(
                        padding: const EdgeInsets.all(Space.md),
                        decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: c.border)),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Txt(coachName(), role: TextRole.overline, colour: c.brand),
                          Txt(_bubbleDe, role: TextRole.heading),
                          if (_bubbleEn.isNotEmpty) Txt(_bubbleEn, role: TextRole.caption, colour: c.muted),
                        ]),
                      ),
                    ),
                  ),
                ]),
                AppCard(
                  child: Column(children: gapped([
                    WordPicture(codes: word.pic, size: 64),
                    Txt(word.german, role: TextRole.german, align: TextAlign.center),
                    Txt(course.meaning(word), colour: c.muted, align: TextAlign.center),
                  ], Space.sm)),
                ),
                _dots(T('Listen'), _listen),
                _dots(T('Say it'), _say),
                if (_listening) Txt(T('Listening…'), role: TextRole.label, colour: c.flame, align: TextAlign.center),
                if (_heard != null) Txt('${T('I heard:')} “$_heard”', colour: c.muted, align: TextAlign.center),
                if (_recognition == false && _running)
                  Txt(T('Say it out loud, then tap “I said it”.'), role: TextRole.caption, colour: c.muted, align: TextAlign.center),
              ], Space.md)),
            ),
            ...gapped([
              if (_tap != null)
                AppButton(label: T('I said it'), icon: Icons.check_rounded, onPressed: () => _tap?.complete(true)),
              if (!_running && !_done) AppButton(label: T('Begin'), icon: Icons.mic_rounded, onPressed: _session),
              if (_running && _tap == null)
                AppButton(
                  label: T('Stop'),
                  kind: ButtonKind.ghost,
                  onPressed: () => setState(() {
                    _reset();
                    _bubble('Kein Problem.', T('Stopped. Press Begin whenever you are ready.'));
                  }),
                ),
              if (_done)
                Row(children: [
                  Expanded(child: AppButton(label: T('Say it again'), kind: ButtonKind.secondary, onPressed: _session)),
                  if (_index + 1 < words.length) ...[
                    const SizedBox(width: Space.sm),
                    Expanded(
                      child: AppButton(
                        label: '${T('Next word')} →',
                        onPressed: () {
                          _go(_index + 1);
                          _session();
                        },
                      ),
                    ),
                  ],
                ]),
              if (!_running)
                Row(children: [
                  Expanded(child: AppButton(label: '← ${T('Previous')}', kind: ButtonKind.ghost, onPressed: _index == 0 ? null : () => _go(_index - 1))),
                  Expanded(
                    child: AppButton(label: '${T('Next word')} →', kind: ButtonKind.ghost, onPressed: _index + 1 >= words.length ? null : () => _go(_index + 1)),
                  ),
                ]),
              if (_done && _index + 1 >= words.length) AppButton(label: T('Continue'), kind: ButtonKind.secondary, onPressed: () => context.pop()),
            ], Space.sm),
          ]),
        ),
      ),
    );
  }
}
