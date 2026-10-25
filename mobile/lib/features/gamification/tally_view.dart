import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/i18n.dart';
import '../../core/settings.dart';
import '../../core/sync/engine.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../progress/progress.dart';
import 'game.dart';
import 'tally.dart' as tally;
import '../../ui/watch.dart';

const _maxRemembered = 60;

/// What the tally says, for screen readers (it is a picture otherwise).
String describeTally(tally.Timeline t) {
  final met = t.marks.where((m) => m.state == tally.Mark.met).length;
  return [
    t.streak > 0 ? T('{n}-day streak', {'n': t.streak}) : T('No streak yet'),
    if (met > 0) 'daily goal reached on $met ${met == 1 ? 'day' : 'days'}',
    t.todayMet ? T("Today's goal reached") : T('Today: {xp} of {goal} XP', {'xp': t.todayXp, 'goal': t.goal}),
    if (t.freezes > 0) '${t.freezes} streak ${t.freezes == 1 ? 'freeze' : 'freezes'}',
    if (t.broken != null) 'the last streak was broken',
  ].join(', ');
}

/// The stick-strikeout streak tally, drawn from the layout shared with the website: the same sticks, bundles,
/// colours and timing on both. A day that reached its goal strikes itself out once on this device (also when that
/// happened offline or on another device, the next time the tally is shown).
class TallyView extends StatefulWidget {
  const TallyView({super.key, this.size = 'full', this.feel = false, this.model});

  final String size;

  /// Haptics when a strike draws (only one tally on screen should).
  final bool feel;
  final tally.Timeline? model;

  @override
  State<TallyView> createState() => _TallyViewState();
}

class _TallyViewState extends State<TallyView> with TickerProviderStateMixin {
  late final _glow = AnimationController(vsync: this, duration: const Duration(milliseconds: tally.glowMs));
  late final _draw = AnimationController(vsync: this);
  List<String> _fresh = [];
  Timer? _haptic;

  @override
  void initState() {
    super.initState();
    // It redraws as progress changes (a goal reached here, offline, or on another device), drawing new strikes.
    sync.addListener(_changed);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (!MediaQuery.of(context).disableAnimations) _glow.repeat(reverse: true);
      _strikeNew();
    });
  }

  void _changed() {
    if (!mounted) return;
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _strikeNew());
  }

  /// Strikes this device hasn't drawn yet draw themselves now, and are remembered so they draw only once.
  void _strikeNew() {
    if (!mounted) return;
    final reduced = MediaQuery.of(context).disableAnimations;
    final layout = tally.layout(widget.model ?? Game.current.timeline, widget.size);
    final unseen = [for (final s in layout.strikes) if (!settings.struck.contains(s.day)) s.day];
    if (unseen.isEmpty) return;
    settings.update(() => settings.struck = {...settings.struck, ...unseen}.toList().reversed.take(_maxRemembered).toList().reversed.toList());
    if (reduced) return;
    setState(() => _fresh = unseen);
    _draw.duration = Duration(milliseconds: tally.strikeMs + (unseen.length - 1) * tally.strikeStaggerMs);
    _draw.forward(from: 0);
    if (widget.feel) {
      _haptic?.cancel();
      _haptic = Timer(Duration(milliseconds: (_draw.duration!.inMilliseconds * 0.8).round()), HapticFeedback.mediumImpact);
    }
  }

  @override
  void dispose() {
    sync.removeListener(_changed);
    _haptic?.cancel();
    _glow.dispose();
    _draw.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model ?? Game.current.timeline;
    final layout = tally.layout(model, widget.size);
    final c = context.c;
    return Semantics(
      label: describeTally(model),
      image: true,
      excludeSemantics: true,
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (layout.hidden > 0)
          Padding(
            padding: const EdgeInsets.only(right: 2),
            child: Txt('+${layout.hidden}', role: widget.size == 'compact' ? TextRole.caption : TextRole.label, colour: c.muted),
          ),
        AnimatedBuilder(
          animation: Listenable.merge([_glow, _draw]),
          builder: (context, _) => CustomPaint(
            size: Size(layout.width, layout.height),
            painter: _TallyPainter(layout, c, _glow.value, _draw, _fresh),
          ),
        ),
      ]),
    );
  }
}

class _TallyPainter extends CustomPainter {
  _TallyPainter(this.layout, this.c, this.glow, this.draw, this.fresh);

  final tally.TallyLayout layout;
  final Palette c;
  final double glow;
  final AnimationController draw;
  final List<String> fresh;

  Color _stick(tally.Mark state) => switch (state) {
        tally.Mark.met || tally.Mark.kept => c.text,
        tally.Mark.today => c.goldBright,
        tally.Mark.missed => c.borderStrong,
        tally.Mark.frozen => c.freeze,
      };

  @override
  void paint(Canvas canvas, Size size) {
    final s = layout.size;
    Paint line(Color colour, double width) => Paint()
      ..color = colour
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    for (final b in layout.bands) {
      canvas.drawLine(Offset(b.x1, b.y), Offset(b.x2, b.y), line(c.goldBright, s.stroke));
    }
    for (final stick in layout.sticks) {
      if (stick.state == tally.Mark.today) {
        canvas.drawLine(Offset(stick.x, stick.y1), Offset(stick.x, stick.y2),
            line(c.goldBright.withValues(alpha: 0.2 + 0.5 * glow), s.stroke * 3));
      }
    }
    for (final stick in layout.sticks) {
      final paint = line(_stick(stick.state), s.stroke);
      if (stick.state == tally.Mark.missed) {
        // Dotted: the day the last streak broke.
        final dash = s.stroke, gap = s.stroke * 1.4;
        for (var y = stick.y1; y < stick.y2; y += dash + gap) {
          canvas.drawLine(Offset(stick.x, y), Offset(stick.x, min(y + dash, stick.y2)), paint);
        }
      } else {
        canvas.drawLine(Offset(stick.x, stick.y1), Offset(stick.x, stick.y2), paint);
      }
    }
    final total = draw.duration?.inMilliseconds ?? 1;
    var order = 0;
    for (final strike in layout.strikes) {
      var share = 1.0;
      if (fresh.contains(strike.day)) {
        final start = order++ * tally.strikeStaggerMs / total;
        final span = tally.strikeMs / total;
        share = Motion.ease.transform(((draw.value - start) / span).clamp(0.0, 1.0));
      }
      if (share <= 0) continue;
      final from = Offset(strike.x1, strike.y1);
      final to = Offset(strike.x2, strike.y2);
      canvas.drawLine(from, Offset.lerp(from, to, share)!, line(c.flame, s.strike));
    }
  }

  @override
  bool shouldRepaint(_TallyPainter old) => true;
}

/// A ring that fills as today's XP approaches the daily goal; anything can sit in its middle.
class GoalRing extends StatelessWidget {
  const GoalRing({super.key, required this.value, this.size = 96, this.stroke = 10, this.colour, this.child});

  final double value;
  final double size;
  final double stroke;
  final Color? colour;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final share = value.isFinite ? value.clamp(0.0, 1.0) : 0.0;
    final c = context.c;
    return Semantics(
      value: '${(share * 100).round()}%',
      child: SizedBox(
        width: size,
        height: size,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: share),
          duration: Motion.celebrate,
          curve: Motion.ease,
          builder: (context, v, child) => CustomPaint(painter: _RingPainter(v, stroke, c.surface2, colour ?? c.xp), child: child),
          child: Center(child: child),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.share, this.stroke, this.track, this.fill);
  final double share, stroke;
  final Color track, fill;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset(stroke / 2, stroke / 2) & Size(size.width - stroke, size.height - stroke);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;
    canvas.drawArc(rect, 0, 2 * pi, false, paint..color = track);
    if (share > 0) canvas.drawArc(rect, -pi / 2, 2 * pi * share, false, paint..color = fill..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.share != share || old.fill != fill || old.track != track;
}

/// The streak (as a tally), XP and level, at the top of the main tabs. The tally opens the streak sheet.
class StatChips extends StatelessWidget {
  const StatChips({super.key});

  // Listens itself: it is built const, so its parent redrawing would not redraw it.
  @override
  Widget build(BuildContext context) => Watch(builder: _build);

  Widget _build(BuildContext context) {
    final c = context.c;
    final game = Game.current;
    return Wrap(spacing: Space.sm, runSpacing: Space.sm, crossAxisAlignment: WrapCrossAlignment.center, children: [
      Material(
        color: game.goalMet ? c.flameSoft : c.surface2,
        borderRadius: BorderRadius.circular(Radii.pill),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.pill),
          onTap: () => showStreakSheet(context),
          child: Container(
            constraints: const BoxConstraints(minHeight: 32),
            padding: const EdgeInsets.symmetric(horizontal: Space.sm),
            child: const TallyView(size: 'compact'),
          ),
        ),
      ),
      Chip2(icon: Icons.bolt_rounded, value: '${game.totalXp}', colour: c.xp, background: c.goldSoft, label: '${game.totalXp} XP'),
      Chip2(icon: Icons.shield_rounded, value: '${game.level.level}', colour: c.brand, background: c.brandSoft, label: 'Level ${game.level.level}'),
    ]);
  }
}

/// The website's streak dialog: the full tally, today's XP, what each mark means, and the daily goal.
void showStreakSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => ListenableBuilder(
      listenable: Listenable.merge([settings, sync]),
      builder: (context, _) {
        final c = context.c;
        final game = Game.current;
        final t = game.timeline;
        Widget legend(Color colour, String text, {bool struck = false, bool dotted = false}) => Padding(
              padding: const EdgeInsets.only(bottom: Space.xs),
              child: Row(children: [
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CustomPaint(painter: _LegendPainter(colour, struck ? c.flame : null, dotted)),
                ),
                const SizedBox(width: Space.sm),
                Expanded(child: Txt(text, role: TextRole.caption, colour: c.muted)),
              ]),
            );
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(Space.lg, 0, Space.lg, Space.lg),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: gapped([
              Txt(T('Your streak'), role: TextRole.title),
              Txt(t.streak > 0 ? T('{n}-day streak', {'n': t.streak}) : T('No streak yet'), role: TextRole.heading),
              const TallyView(),
              Txt(t.todayMet ? T("Today's goal reached") : T('Today: {xp} of {goal} XP', {'xp': t.todayXp, 'goal': t.goal}),
                  colour: t.todayMet ? c.flame : c.muted),
              Column(children: [
                legend(c.text, T('Goal reached'), struck: true),
                legend(c.text, T('Practised')),
                legend(c.goldBright, T('Today')),
                legend(c.freeze, T('Covered by a streak freeze')),
                legend(c.borderStrong, T('Missed'), dotted: true),
              ]),
              Txt(T('Daily goal'), role: TextRole.subheading),
              Segmented<int>(
                label: T('Daily goal'),
                value: game.dailyGoal,
                options: [for (final g in dailyGoals) (g.xp, T(g.name))],
                onChanged: setDailyGoal,
              ),
              Txt(T('{n} XP a day', {'n': game.dailyGoal}), role: TextRole.caption, colour: c.muted),
              Txt(T('Every 5 days that reach the goal earn a streak freeze (you can hold 2). A freeze covers a missed day by itself.'),
                  role: TextRole.caption, colour: c.muted),
            ], Space.md)),
          ),
        );
      },
    ),
  );
}

class _LegendPainter extends CustomPainter {
  _LegendPainter(this.colour, this.strike, this.dotted);
  final Color colour;
  final Color? strike;
  final bool dotted;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = colour
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round;
    final x = size.width / 2;
    if (dotted) {
      for (var y = 2.0; y < size.height - 2; y += 6) {
        canvas.drawLine(Offset(x, y), Offset(x, y + 2.5), p);
      }
    } else {
      canvas.drawLine(Offset(x, 2), Offset(x, size.height - 2), p);
    }
    if (strike != null) {
      canvas.drawLine(Offset(x - 5, size.height * 0.78), Offset(x + 5, size.height * 0.22), Paint()
        ..color = strike!
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
