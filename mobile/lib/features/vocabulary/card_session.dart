import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/audio.dart';
import '../../core/settings.dart';
import '../../core/sync/engine.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../gamification/celebration.dart';
import '../gamification/game.dart';
import '../lessons/quiz_session.dart';
import '../progress/progress.dart';
import 'srs.dart';
import 'word_picture.dart';

/// A run through a deck of flashcards, then the celebration. Every answer is graded for review, earns XP and is
/// saved as it is given, so the deck can be continued on another phone. Cards go German → English, English →
/// German, or mixed, as on the website.
class CardSession extends StatefulWidget {
  const CardSession({super.key, required this.deck, required this.title, required this.ref, this.answers = const []});

  final List<Word> deck;
  final String title;

  /// The section key, a unit's `unit:<id>`, or "review": saved with the position.
  final String ref;

  /// Answers already given, when continuing.
  final List<bool> answers;

  @override
  State<CardSession> createState() => _CardSessionState();
}

class _CardSessionState extends State<CardSession> {
  late final _startLevel = Game.current.level.level;
  late final _startLearned = sync.state.learned.toSet();
  late final _given = [...widget.answers.take(widget.deck.length)];
  late var _xp = 0;
  final _rnd = Random();
  late final List<bool> _germanFirst = [
    for (final _ in widget.deck) settings.cardDirection == 'mixed' ? _rnd.nextBool() : settings.cardDirection == 'de-en',
  ];

  int get _position => _given.length;

  @override
  void initState() {
    super.initState();
    if (widget.deck.isNotEmpty) _save();
    _announce();
  }

  void _save() {
    final done = _given.length >= widget.deck.length;
    sync.record({
      'kind': 'session',
      'session': done
          ? null
          : {
              'kind': 'cards',
              'ref': widget.ref,
              'items': [for (final w in widget.deck) w.german],
              'answers': [..._given],
              'position': _given.length,
              ...sync.sessionDefaults,
            },
    });
  }

  /// German-first cards say the word as they appear.
  void _announce() {
    if (_position < widget.deck.length && _germanFirst[_position]) audio.play(widget.deck[_position].german);
  }

  void _answer(bool knewIt) {
    if (_position >= widget.deck.length) return;
    final word = widget.deck[_position];
    final points = knewIt ? (_startLearned.contains(word.german) ? XP.reviewRight : XP.newWord) : XP.reviewWrong;
    grade(word.german, knewIt);
    if (knewIt) setLearned(word.german, true);
    awardXp(points);
    setState(() {
      _xp += points;
      _given.add(knewIt);
    });
    _save();
    _announce();
  }

  @override
  Widget build(BuildContext context) {
    final deck = widget.deck;
    if (_position >= deck.length) {
      final knew = _given.where((a) => a).length;
      final again = _given.length - knew;
      final missed = [for (final (i, w) in deck.indexed) if (i < _given.length && !_given[i]) w];
      final success = knew >= again;
      return Celebration(
        title: deck.isEmpty ? 'Nothing to practise' : (success ? 'Ausgezeichnet!' : 'Gut gemacht!'),
        message: deck.isEmpty ? 'Learn some words first, then come back.' : T('You went through all {n} cards.', {'n': deck.length}),
        xpGained: _xp,
        levelBefore: _startLevel,
        success: deck.isNotEmpty && success,
        stats: [
          Stat(Icons.check_circle_outline_rounded, T('known first try'), '$knew'),
          Stat(Icons.refresh_rounded, T('to review'), '$again'),
        ],
        extra: [
          if (missed.isNotEmpty)
            AppButton(
              label: T('Review {n} missed', {'n': missed.length}),
              kind: ButtonKind.secondary,
              icon: Icons.replay_rounded,
              onPressed: () => context.pushReplacement('/session/cards', extra: CardDeck(missed, widget.title, widget.ref)),
            ),
        ],
        onContinue: () => context.pop(),
      );
    }
    final word = deck[_position];
    final c = context.c;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Space.md),
          child: Column(children: [
            SessionHeader(done: _position, total: deck.length, colour: c.goldBright),
            const SizedBox(height: Space.sm),
            Txt(_germanFirst[_position] ? T('German → English') : T('English → German'), role: TextRole.caption, colour: c.muted),
            const SizedBox(height: Space.md),
            Expanded(
              child: Stack(children: [
                if (_position + 1 < deck.length)
                  Positioned.fill(
                    child: IgnorePointer(
                      child: ExcludeSemantics(
                        child: Transform.translate(
                          offset: const Offset(0, 14),
                          child: Transform.scale(scale: 0.95, child: _Face(word: deck[_position + 1], german: _germanFirst[_position + 1], back: false)),
                        ),
                      ),
                    ),
                  ),
                Positioned.fill(
                  child: SwipeCard(key: ValueKey('$_position-${word.german}'), word: word, germanFirst: _germanFirst[_position], onAnswer: _answer),
                ),
              ]),
            ),
            const SizedBox(height: Space.lg),
            Row(children: [
              Expanded(child: AppButton(label: T('Still learning'), kind: ButtonKind.secondary, icon: Icons.refresh_rounded, onPressed: () => _answer(false))),
              if (audio.hasClip(word.german)) ...[
                const SizedBox(width: Space.sm),
                RoundIconButton(icon: Icons.volume_up_rounded, label: 'Listen to ${word.german}', onPressed: () => audio.play(word.german)),
              ],
              const SizedBox(width: Space.sm),
              Expanded(child: AppButton(label: T('I knew it'), icon: Icons.check_rounded, onPressed: () => _answer(true))),
            ]),
          ]),
        ),
      ),
    );
  }
}

/// A deck handed to the cards route.
class CardDeck {
  const CardDeck(this.words, this.title, this.ref, [this.answers = const []]);
  final List<Word> words;
  final String title;
  final String ref;
  final List<bool> answers;
}

/// One side of a card.
class _Face extends StatelessWidget {
  const _Face({required this.word, required this.german, required this.back});
  final Word word;

  /// Whether this side shows the German.
  final bool german;
  final bool back;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Container(
      padding: const EdgeInsets.all(Space.lg),
      decoration: BoxDecoration(
        color: back ? c.brandSoft : c.surface,
        borderRadius: BorderRadius.circular(Radii.xl),
        border: Border.all(color: back ? c.brand : c.border, width: 1.5),
        boxShadow: elevation(context, 2),
      ),
      child: Center(
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: gapped([
            Txt(german ? T('German') : T('English'), role: TextRole.overline, colour: c.muted),
            if (!german || !back) WordPicture(codes: word.pic, size: 72),
            Txt(german ? word.german : course.meaning(word), role: german ? TextRole.german : TextRole.title, align: TextAlign.center),
            if (back) Txt(german ? course.meaning(word) : word.german, role: TextRole.bodyStrong, colour: c.muted, align: TextAlign.center),
            Txt(
              back ? T('Did you know it?') : (german ? T('What does it mean? Tap the card to check.') : T('Say it in German, then tap the card.')),
              role: TextRole.caption,
              colour: c.subtle,
              align: TextAlign.center,
            ),
          ], Space.md)),
        ),
      ),
    );
  }
}

/// A flashcard: tap to turn it over, swipe right for "I knew it", left for "Again". Buttons below do the same for
/// anyone not swiping.
class SwipeCard extends StatefulWidget {
  const SwipeCard({super.key, required this.word, required this.germanFirst, required this.onAnswer});
  final Word word;
  final bool germanFirst;
  final ValueChanged<bool> onAnswer;

  @override
  State<SwipeCard> createState() => _SwipeCardState();
}

class _SwipeCardState extends State<SwipeCard> with TickerProviderStateMixin {
  late final _turn = AnimationController(vsync: this, duration: Motion.slow);
  late final _fly = AnimationController(vsync: this, duration: const Duration(milliseconds: 220));
  double _dx = 0;
  double _from = 0;
  double _to = 0;
  bool _answered = false;

  @override
  void initState() {
    super.initState();
    _fly.addListener(() => setState(() => _dx = _from + (_to - _from) * Curves.easeOut.transform(_fly.value)));
  }

  @override
  void dispose() {
    _turn.dispose();
    _fly.dispose();
    super.dispose();
  }

  void _flip() {
    HapticFeedback.selectionClick();
    if (_turn.value < 0.5) {
      _turn.forward();
      // English-first cards say the German as soon as it is revealed.
      if (!widget.germanFirst) audio.play(widget.word.german);
    } else {
      _turn.reverse();
    }
  }

  void _release(double velocity, double width) {
    final threshold = width * 0.28;
    final fling = velocity.abs() > 800 && _dx.abs() > 40;
    _from = _dx;
    if (_dx.abs() > threshold || fling) {
      final right = _dx > 0 || (fling && velocity > 0);
      _to = right ? width * 1.5 : -width * 1.5;
      _fly.forward(from: 0).then((_) {
        if (_answered) return;
        _answered = true;
        widget.onAnswer(right);
      });
    } else {
      _to = 0;
      _fly.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return LayoutBuilder(builder: (context, box) {
      final width = box.maxWidth;
      final threshold = width * 0.28;
      final knew = (_dx / threshold).clamp(0.0, 1.0);
      final again = (-_dx / threshold).clamp(0.0, 1.0);
      return Semantics(
        button: true,
        label: widget.word.german,
        hint: 'Double tap to turn the card',
        onTap: _flip,
        child: GestureDetector(
          onTap: _flip,
          onHorizontalDragUpdate: (d) => setState(() => _dx += d.delta.dx),
          onHorizontalDragEnd: (d) => _release(d.primaryVelocity ?? 0, width),
          child: Transform.translate(
            offset: Offset(_dx, 0),
            child: Transform.rotate(
              angle: (_dx / width).clamp(-1.0, 1.0) * 14 * pi / 180,
              child: Stack(children: [
                Positioned.fill(
                  child: AnimatedBuilder(
                    animation: _turn,
                    builder: (context, _) {
                      final back = _turn.value >= 0.5;
                      final angle = _turn.value * pi;
                      return Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          ..setEntry(3, 2, 0.0011)
                          ..rotateY(back ? angle - pi : angle),
                        child: _Face(word: widget.word, german: back ? !widget.germanFirst : widget.germanFirst, back: back),
                      );
                    },
                  ),
                ),
                _Stamp(text: T('I knew it'), colour: c.green, opacity: knew, left: true),
                _Stamp(text: T('Still learning'), colour: c.flame, opacity: again, left: false),
              ]),
            ),
          ),
        ),
      );
    });
  }
}

class _Stamp extends StatelessWidget {
  const _Stamp({required this.text, required this.colour, required this.opacity, required this.left});
  final String text;
  final Color colour;
  final double opacity;
  final bool left;

  @override
  Widget build(BuildContext context) => Positioned(
        top: Space.lg,
        left: left ? Space.lg : null,
        right: left ? null : Space.lg,
        child: Opacity(
          opacity: opacity,
          child: Transform.rotate(
            angle: (left ? -12 : 12) * pi / 180,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: Space.xs),
              decoration: BoxDecoration(border: Border.all(color: colour, width: 3), borderRadius: BorderRadius.circular(Radii.sm)),
              child: Txt(text, role: TextRole.overline, colour: colour),
            ),
          ),
        ),
      );
}
