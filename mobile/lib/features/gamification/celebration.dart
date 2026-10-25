import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/i18n.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../../ui/watch.dart';
import 'game.dart';
import 'tally_view.dart';

class Stat {
  const Stat(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;
}

/// The end of every session: what was earned, the streak, the goal, and a level-up when it happens. Confetti only
/// for a real success; a tough session gets encouragement instead.
class Celebration extends StatefulWidget {
  const Celebration({
    super.key,
    required this.title,
    required this.message,
    required this.xpGained,
    required this.levelBefore,
    required this.stats,
    required this.success,
    required this.onContinue,
    this.extra = const [],
  });

  final String title;
  final String message;
  final int xpGained;
  final int levelBefore;
  final List<Stat> stats;
  final bool success;
  final VoidCallback onContinue;

  /// More ways on: "Try again", "Review 3 missed", …
  final List<Widget> extra;

  @override
  State<Celebration> createState() => _CelebrationState();
}

class _CelebrationState extends State<Celebration> with SingleTickerProviderStateMixin {
  late final _intro = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400));

  @override
  void initState() {
    super.initState();
    _intro.forward();
    widget.success ? HapticFeedback.heavyImpact() : HapticFeedback.mediumImpact();
  }

  @override
  void dispose() {
    _intro.dispose();
    super.dispose();
  }

  /// Each part rises in after the one before.
  Widget _in(double from, Widget child) => AnimatedBuilder(
        animation: _intro,
        builder: (context, child) {
          final t = Motion.ease.transform(((_intro.value - from) / 0.3).clamp(0.0, 1.0));
          return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, 16 * (1 - t)), child: child));
        },
        child: child,
      );

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final reduced = MediaQuery.of(context).disableAnimations;
    return Scaffold(
      body: Stack(children: [
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Space.md),
            child: Watch(builder: (context) {
              final game = Game.current;
              final levelledUp = game.level.level > widget.levelBefore;
              return Column(children: [
                Expanded(
                  child: Center(
                    child: SingleChildScrollView(
                      child: Column(children: gapped([
                        _in(0, Badge2(
                          icon: widget.success ? Icons.emoji_events_rounded : Icons.fitness_center_rounded,
                          colour: widget.success ? c.xp : c.brand,
                          background: widget.success ? c.goldSoft : c.brandSoft,
                          size: 112,
                        )),
                        _in(0.08, Column(children: [
                          Txt(widget.title, role: TextRole.title, align: TextAlign.center),
                          const SizedBox(height: Space.sm),
                          Txt(widget.message, colour: c.muted, align: TextAlign.center),
                        ])),
                        _in(0.16, Container(
                          padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: Space.sm),
                          decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(Radii.pill)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.bolt_rounded, size: 28, color: c.xp),
                            const SizedBox(width: Space.sm),
                            TweenAnimationBuilder<int>(
                              tween: IntTween(begin: reduced ? widget.xpGained : 0, end: widget.xpGained),
                              duration: Motion.celebrate,
                              curve: Curves.easeOutCubic,
                              builder: (context, v, _) => Semantics(
                                label: '${widget.xpGained} XP earned',
                                excludeSemantics: true,
                                child: Txt('+$v XP', role: TextRole.title, colour: c.xp),
                              ),
                            ),
                          ]),
                        )),
                        if (levelledUp)
                          _in(0.3, Container(
                            padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: Space.sm),
                            decoration: BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(Radii.pill)),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.shield_rounded, color: c.brandInk),
                              const SizedBox(width: Space.sm),
                              Txt('Level ${game.level.level} reached!', role: TextRole.subheading, colour: c.brandInk),
                            ]),
                          )),
                        _in(0.24, Row(children: [
                          for (final stat in widget.stats) ...[_StatBox(icon: stat.icon, value: stat.value, label: stat.label), const SizedBox(width: Space.sm)],
                          Expanded(
                            child: _Box(
                              label: 'Daily goal: ${game.todayXp} of ${game.dailyGoal} XP',
                              children: [
                                GoalRing(value: game.todayXp / game.dailyGoal, size: 44, stroke: 6),
                                Txt('${min(game.todayXp, game.dailyGoal)}/${game.dailyGoal}', role: TextRole.label),
                                Txt(T('Daily goal').toLowerCase(), role: TextRole.caption, colour: c.muted),
                              ],
                            ),
                          ),
                        ])),
                        _in(0.32, Column(children: [
                          const TallyView(feel: true),
                          const SizedBox(height: Space.xs),
                          Txt(
                            game.goalMet ? 'Today struck off · ${T('{n}-day streak', {'n': game.streak})}' : T('{n}-day streak', {'n': game.streak}),
                            role: TextRole.label,
                            colour: game.goalMet ? c.flame : c.muted,
                          ),
                        ])),
                      ], Space.lg)),
                    ),
                  ),
                ),
                ...gapped([...widget.extra, AppButton(label: T('Continue'), onPressed: widget.onContinue)], Space.sm),
              ]);
            }),
          ),
        ),
        if (widget.success && !reduced) const Positioned.fill(child: IgnorePointer(child: Confetti())),
      ]),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.label, required this.children});
  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Semantics(
        label: label,
        excludeSemantics: true,
        child: Container(
          padding: const EdgeInsets.all(Space.md),
          decoration: BoxDecoration(
            color: context.c.surface,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: context.c.border, width: 0.8),
          ),
          child: Column(children: gapped(children, Space.xs)),
        ),
      );
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.icon, required this.value, required this.label});
  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Expanded(
        child: _Box(label: '$label: $value', children: [
          Icon(icon, color: context.c.brand),
          Txt(value, role: TextRole.heading),
          Txt(label, role: TextRole.caption, colour: context.c.muted, align: TextAlign.center),
        ]),
      );
}

/// A burst of falling confetti in the brand's colours.
class Confetti extends StatefulWidget {
  const Confetti({super.key});

  @override
  State<Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<Confetti> with SingleTickerProviderStateMixin {
  late final _fall = AnimationController(vsync: this, duration: const Duration(milliseconds: 2200))..forward();

  @override
  void dispose() {
    _fall.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final colours = [c.brand, c.goldBright, c.xp, c.flame, c.brandDeep, Colors.white];
    return AnimatedBuilder(
      animation: _fall,
      builder: (context, _) => CustomPaint(painter: _ConfettiPainter(Curves.easeOutQuad.transform(_fall.value), colours)),
    );
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.t, this.colours);
  final double t;
  final List<Color> colours;

  /// A fixed pseudo-random number in [0, 1) for piece `i`: the same on every frame, different per piece.
  double _scatter(int i, int salt) {
    final n = sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return n - n.floorToDouble();
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (t >= 1) return;
    final opacity = t < 0.85 ? 1.0 : (1 - t) / 0.15;
    for (var i = 0; i < 42; i++) {
      final x = _scatter(i, 1) * size.width + (_scatter(i, 2) - 0.5) * 160 * t;
      final y = -40 + (size.height + 80) * t;
      final piece = 7 + _scatter(i, 4) * 7;
      canvas.save();
      canvas.translate(x, y * (0.7 + 0.3 * _scatter(i, 5)));
      canvas.rotate((_scatter(i, 3) - 0.5) * 900 * t * pi / 180);
      final paint = Paint()..color = colours[i % colours.length].withValues(alpha: opacity);
      if (i % 3 == 0) {
        canvas.drawCircle(Offset.zero, piece / 2, paint);
      } else {
        canvas.drawRRect(RRect.fromRectAndRadius(Rect.fromCenter(center: Offset.zero, width: piece, height: piece * 0.45), const Radius.circular(2)), paint);
      }
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}
