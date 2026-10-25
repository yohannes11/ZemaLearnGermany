import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/client.dart';
import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/settings.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';
import '../gamification/game.dart';
import '../gamification/tally.dart' as tally;
import '../progress/progress.dart';

const _reasons = ['study', 'career', 'life'];

/// The first-run introduction: why German is worth it (the website's sourced figures), how the app works, and a
/// daily goal. Skip goes straight to the goal, so every learner starts with one they chose.
class Onboarding extends StatefulWidget {
  const Onboarding({super.key});

  @override
  State<Onboarding> createState() => _OnboardingState();
}

class _OnboardingState extends State<Onboarding> {
  final _pages = PageController();
  var _index = 0;
  var _goal = tally.defaultGoal;
  WhyGerman? _why;
  String? _whyLang;

  // The page list is fixed once the learner moves on, so figures arriving late can't shift the pages.
  List<String>? _frozen;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final lang = course.lang;
    try {
      final why = await Api.instance.whyGerman(lang);
      if (!mounted || course.lang != lang) return;
      setState(() {
        _why = why;
        _whyLang = lang;
      });
    } catch (_) {
      // Offline on first start: the introduction goes on without the figures.
    }
  }

  List<String> get _slides {
    if (_frozen != null) return _frozen!;
    final why = _whyLang == course.lang ? _why : null;
    final reasons = why == null ? <String>[] : _reasons.where((k) => why.paths.any((p) => p.key == k));
    return ['welcome', for (final k in reasons) 'reason:$k', 'how', 'goal'];
  }

  void _goTo(int target) {
    _frozen ??= _slides;
    HapticFeedback.selectionClick();
    _pages.animateToPage(target, duration: Motion.slow, curve: Motion.ease);
  }

  void _finish() {
    HapticFeedback.mediumImpact();
    setDailyGoal(_goal);
    // The router sees this and shows the app.
    settings.update(() => settings.onboarded = true);
  }

  Widget _slide(String key) {
    if (key == 'welcome') {
      return _WelcomeSlide(lang: course.lang, onLang: (next) {
        course.setLang(next);
        setState(() {});
        _load();
      });
    }
    if (key == 'how') return const _HowSlide();
    if (key == 'goal') return _GoalSlide(goal: _goal, onGoal: (g) => setState(() => _goal = g));
    final path = _why?.paths.where((p) => 'reason:${p.key}' == key).firstOrNull;
    return path == null ? const SizedBox.shrink() : _ReasonSlide(path: path, stats: _why!.stats);
  }

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final slides = _slides;
    final last = slides.length - 1;
    return Scaffold(
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Space.lg),
            child: SizedBox(
              height: 48,
              child: Row(children: [
                Expanded(child: Txt('Zema German', role: TextRole.overline, colour: c.brand)),
                if (_index < last) TextButton(onPressed: () => _goTo(last), child: Txt('Skip', role: TextRole.label, colour: c.muted)),
              ]),
            ),
          ),
          Expanded(
            child: PageView(
              controller: _pages,
              onPageChanged: (i) => setState(() {
                _frozen ??= slides;
                _index = i;
              }),
              children: [
                for (final key in slides)
                  SingleChildScrollView(
                    padding: const EdgeInsets.all(Space.lg),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 560),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [_slide(key)]),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(Space.lg),
            child: Column(children: [
              Semantics(
                label: 'Page ${_index + 1} of ${slides.length}',
                excludeSemantics: true,
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  for (var i = 0; i < slides.length; i++)
                    AnimatedContainer(
                      duration: Motion.base,
                      margin: const EdgeInsets.symmetric(horizontal: Space.xs),
                      width: i == _index ? 28 : 8,
                      height: 8,
                      decoration: BoxDecoration(color: i == _index ? c.brand : c.borderStrong, borderRadius: BorderRadius.circular(Radii.pill)),
                    ),
                ]),
              ),
              const SizedBox(height: Space.lg),
              AppButton(
                label: _index == last ? 'Start learning' : 'Next',
                icon: _index == last ? Icons.rocket_launch_outlined : Icons.arrow_forward_rounded,
                kind: _index == last ? ButtonKind.gold : ButtonKind.primary,
                onPressed: () => _index == last ? _finish() : _goTo(_index + 1),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.selected, required this.onTap, required this.child, required this.label});
  final bool selected;
  final VoidCallback onTap;
  final Widget child;
  final String label;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Semantics(
      inMutuallyExclusiveGroup: true,
      checked: selected,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: selected ? c.brandSoft : c.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(Radii.lg),
          side: BorderSide(color: selected ? c.brand : c.border, width: 1.5),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(Radii.lg),
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Container(constraints: const BoxConstraints(minHeight: 56), padding: const EdgeInsets.all(Space.md), alignment: Alignment.center, child: child),
        ),
      ),
    );
  }
}

class _WelcomeSlide extends StatelessWidget {
  const _WelcomeSlide({required this.lang, required this.onLang});
  final String lang;
  final ValueChanged<String> onLang;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
      Container(
        height: 180,
        decoration: BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(Radii.xl)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Center(child: Txt('Hallo!', role: TextRole.display, colour: c.brandInk)),
          Positioned(left: 0, right: 0, bottom: 0, height: 10, child: ColoredBox(color: c.goldBright)),
        ]),
      ),
      const Txt('Learn German, a few minutes a day', role: TextRole.title),
      Txt('Real recordings, short lessons and a streak that keeps you going. Made for Amharic and English speakers.', colour: c.muted),
      const Txt('Explanations in', role: TextRole.label),
      Row(children: [
        for (final (code, name) in const [('en', 'English'), ('am', 'አማርኛ')]) ...[
          Expanded(child: _Choice(selected: lang == code, label: name, onTap: () => onLang(code), child: Txt(name, role: TextRole.subheading))),
          if (code == 'en') const SizedBox(width: Space.sm),
        ],
      ]),
    ], Space.md));
  }
}

class _ReasonSlide extends StatelessWidget {
  const _ReasonSlide({required this.path, required this.stats});
  final WhyPath path;
  final List<WhyStat> stats;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    final source = path.sources.firstOrNull;
    final figures = [for (final i in path.stats) if (i < stats.length) stats[i]];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
      if (path.image != null)
        ClipRRect(
          borderRadius: BorderRadius.circular(Radii.xl),
          child: Stack(children: [
            Image.network(path.image!.url, height: 140, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox(height: 140)),
            Positioned(
              right: Space.sm,
              bottom: Space.xs,
              child: Text('Photo: ${path.image!.credit}', style: TextStyle(fontSize: 10, color: c.onImage, shadows: const [Shadow(blurRadius: 3)])),
            ),
          ]),
        ),
      Txt(path.title, role: TextRole.heading),
      Row(children: [
        for (final (i, stat) in figures.indexed) ...[
          if (i > 0) const SizedBox(width: Space.sm),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.sm + 4),
              decoration: BoxDecoration(color: c.goldSoft, borderRadius: BorderRadius.circular(Radii.lg)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                FittedBox(fit: BoxFit.scaleDown, child: Txt(stat.display, role: TextRole.heading, colour: c.xp)),
                Txt(stat.label, role: TextRole.caption),
              ]),
            ),
          ),
        ],
      ]),
      Txt(path.body, colour: c.muted),
      if (path.needs != null)
        Container(
          padding: const EdgeInsets.all(Space.sm),
          decoration: BoxDecoration(color: c.brandSoft, borderRadius: BorderRadius.circular(Radii.md)),
          child: Row(children: [
            Icon(Icons.school_outlined, size: 18, color: c.brand),
            const SizedBox(width: Space.sm),
            Expanded(child: Txt(path.needs!, role: TextRole.label, colour: c.brand)),
          ]),
        ),
      if (source != null)
        InkWell(
          onTap: () => launchUrl(Uri.parse(source.url), mode: LaunchMode.inAppBrowserView),
          child: Txt('Source: ${source.publisher}, ${source.date} ›', role: TextRole.caption, colour: c.subtle),
        ),
    ], Space.md));
  }
}

class _HowSlide extends StatelessWidget {
  const _HowSlide();

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    Widget feature(IconData icon, Color colour, Color bg, String title, String body) => Container(
          padding: const EdgeInsets.all(Space.md),
          decoration: BoxDecoration(
            color: c.surface,
            borderRadius: BorderRadius.circular(Radii.lg),
            border: Border.all(color: c.border),
          ),
          child: Row(children: [
            // The section's colour (vocabulary gold, lessons emerald) is in its badge.
            Badge2(icon: icon, colour: colour, background: bg),
            const SizedBox(width: Space.md),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Txt(title, role: TextRole.subheading), Txt(body, role: TextRole.caption, colour: c.muted)]),
            ),
          ]),
        );
    Widget perk(IconData icon, Color colour, Color bg, String text) => Expanded(
          child: Column(children: [Badge2(icon: icon, colour: colour, background: bg), const SizedBox(height: Space.sm), Txt(text, role: TextRole.caption, align: TextAlign.center)]),
        );
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
      const Txt('Two ways to learn, one streak', role: TextRole.title),
      feature(Icons.style_rounded, c.xp, c.goldSoft, 'Words',
          'Flashcards, matching, typing and speaking, with real recordings and pictures. Smart review brings each word back just before you forget it.'),
      feature(Icons.school_rounded, c.brand, c.brandSoft, 'Lessons',
          'Short grammar lessons, reading texts, unit tests and listening practice, with exercises that check you right away.'),
      Row(children: [
        perk(Icons.local_fire_department_rounded, c.flame, c.flameSoft, 'Keep a daily streak'),
        perk(Icons.bolt_rounded, c.xp, c.goldSoft, 'Earn XP for every answer'),
        perk(Icons.shield_rounded, c.brand, c.brandSoft, 'Level up as you go'),
      ]),
    ], Space.md));
  }
}

class _GoalSlide extends StatelessWidget {
  const _GoalSlide({required this.goal, required this.onGoal});
  final int goal;
  final ValueChanged<int> onGoal;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: gapped([
      const Txt('Pick a daily goal', role: TextRole.title),
      Txt('You can change it any time under Me. Small and steady wins.', colour: c.muted),
      for (final option in dailyGoals)
        _Choice(
          selected: goal == option.xp,
          onTap: () => onGoal(option.xp),
          label: '${option.name}, ${option.time}, ${option.xp} XP',
          child: Row(children: [
            Expanded(child: Txt(option.name, role: TextRole.subheading)),
            Txt(option.time, role: TextRole.caption, colour: c.muted),
            const SizedBox(width: Space.md),
            Txt('${option.xp} XP', role: TextRole.label, colour: c.xp),
          ]),
        ),
    ], Space.md));
  }
}
