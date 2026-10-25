import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/api/models.dart';
import 'core/course.dart';
import 'core/i18n.dart';
import 'core/settings.dart';
import 'core/sync/engine.dart';
import 'features/lessons/quiz_session.dart';
import 'features/onboarding/onboarding.dart';
import 'features/vocabulary/card_session.dart';
import 'features/vocabulary/speak_coach.dart';
import 'features/vocabulary/srs.dart';
import 'features/vocabulary/study_modes.dart';
import 'screens/home_screen.dart';
import 'screens/lessons_screens.dart';
import 'screens/me_screen.dart';
import 'screens/words_screens.dart';
import 'ui/watch.dart';

final _root = GlobalKey<NavigatorState>();

/// Four tabs, each with one job and its own back stack: Home (today, the map, what next), Words (vocabulary),
/// Lessons (grammar, reading, unit tests, listening) and Me (account and settings). A unit opened from the map,
/// and the sections and lessons it links to, stay inside Home, so the way back is always there. Practice sessions
/// cover the tabs: one task at a time, with one way out.
final router = GoRouter(
  navigatorKey: _root,
  refreshListenable: settings,
  redirect: (context, state) {
    final onboarding = state.matchedLocation == '/onboarding';
    if (!settings.onboarded && !onboarding) return '/onboarding';
    if (settings.onboarded && onboarding) return '/';
    return null;
  },
  routes: [
    GoRoute(path: '/onboarding', builder: (_, _) => const Onboarding()),
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => _Tabs(shell: shell),
      branches: [
        StatefulShellBranch(routes: [
          GoRoute(path: '/', builder: (_, _) => const HomeScreen(), routes: [
            GoRoute(path: 'unit/:id', builder: (_, s) => UnitScreen(id: int.tryParse(s.pathParameters['id']!) ?? -1)),
            GoRoute(path: 'section/:key', builder: (_, s) => SectionScreen(sectionKey: s.pathParameters['key']!, lessonPath: '/lesson/')),
            GoRoute(path: 'lesson/:key', builder: (_, s) => LessonScreen(lessonKey: s.pathParameters['key']!)),
          ]),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/words', builder: (_, _) => const WordsScreen(), routes: [
            GoRoute(path: ':key', builder: (_, s) => SectionScreen(sectionKey: s.pathParameters['key']!, lessonPath: '/lessons/')),
          ]),
        ]),
        StatefulShellBranch(routes: [
          GoRoute(path: '/lessons', builder: (_, _) => const LessonsScreen(), routes: [
            GoRoute(path: ':key', builder: (_, s) => LessonScreen(lessonKey: s.pathParameters['key']!)),
          ]),
        ]),
        StatefulShellBranch(routes: [GoRoute(path: '/me', builder: (_, _) => const MeScreen())]),
      ],
    ),
    GoRoute(path: '/sign-in', parentNavigatorKey: _root, pageBuilder: (_, _) => const MaterialPage(fullscreenDialog: true, child: SignInScreen())),
    GoRoute(path: '/session/cards', parentNavigatorKey: _root, pageBuilder: (_, s) => _session(_cards(s))),
    GoRoute(
      path: '/session/quiz/:key',
      parentNavigatorKey: _root,
      pageBuilder: (_, s) => _session(_withCourse((context) {
        final found = course.lesson(s.pathParameters['key']!);
        return found == null ? const _Missing() : QuizSession(kind: LessonQuiz(found.unit, found.lesson, resume: s.uri.queryParameters['resume'] == '1'));
      })),
    ),
    GoRoute(
      path: '/session/listening/:unit',
      parentNavigatorKey: _root,
      pageBuilder: (_, s) => _session(_withCourse((context) {
        final unit = course.unit(int.tryParse(s.pathParameters['unit']!) ?? -1);
        return unit == null ? const _Missing() : QuizSession(kind: ListeningQuiz(unit));
      })),
    ),
    for (final (mode, build) in <(String, Widget Function(WordScope, GoRouterState))>[
      ('learn', (scope, _) => WordPages(scope: scope)),
      ('match', (scope, _) => MatchGame(scope: scope)),
      ('practice', (scope, _) => PracticeSession(scope: scope)),
      ('speak', (scope, s) => SpeakCoach(scope: scope, from: int.tryParse(s.uri.queryParameters['from'] ?? '') ?? 0)),
    ])
      GoRoute(
        path: '/session/$mode/:scope',
        parentNavigatorKey: _root,
        pageBuilder: (_, s) => _session(_withCourse((context) {
          final scope = WordScope.find(s.pathParameters['scope']!);
          return scope == null || scope.words.isEmpty ? const _Missing() : build(scope, s);
        })),
      ),
  ],
);

Page<void> _session(Widget child) => MaterialPage(fullscreenDialog: true, child: child);

/// A session opened from a link the course may still be loading: wait for it rather than call it missing.
/// The session itself is built once, so later course updates don't restart it.
Widget _withCourse(WidgetBuilder builder) => CourseGate(builder: (context) => _Once(builder: builder));

class _Once extends StatefulWidget {
  const _Once({required this.builder});
  final WidgetBuilder builder;
  @override
  State<_Once> createState() => _OnceState();
}

class _OnceState extends State<_Once> {
  late final Widget _child = widget.builder(context);
  @override
  Widget build(BuildContext context) => _child;
}

/// Flashcards for a section or unit (?scope=), today's review (?review=1), a deck left open on this or another
/// device (?resume=1), or a deck handed over (the missed cards of the last one).
Widget _cards(GoRouterState s) => _withCourse((context) {
      if (s.extra is CardDeck) {
        final deck = s.extra! as CardDeck;
        return CardSession(deck: deck.words, title: deck.title, ref: deck.ref);
      }
      final q = s.uri.queryParameters;
      final byGerman = {for (final w in course.allWords) w.german: w};
      final saved = q['resume'] == '1' ? sync.openSession : null;
      if (saved != null && saved['kind'] == 'cards') {
        final ref = '${saved['ref']}';
        final deck = [for (final g in saved['items'] as List) if (byGerman['$g'] != null) byGerman['$g']!];
        final position = (saved['position'] as num).toInt();
        return CardSession(
          deck: deck,
          title: WordScope.find(ref)?.title ?? T('Review'),
          ref: ref,
          answers: [for (final a in (saved['answers'] as List).take(position)) a == true],
        );
      }
      if (q['review'] == '1') return CardSession(deck: dueWords().take(reviewSessionSize).toList(), title: T('Review'), ref: 'review');
      final scope = WordScope.find(q['scope'] ?? '');
      if (scope == null) return const _Missing();
      // Words still to learn first, then the known ones.
      final known = sync.state.learned.toSet();
      final List<Word> deck = [...scope.words.where((w) => !known.contains(w.german)), ...scope.words.where((w) => known.contains(w.german))];
      return CardSession(deck: deck, title: scope.title, ref: scope.key);
    });

class _Missing extends StatelessWidget {
  const _Missing();
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(),
        body: const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('This is no longer in the course.', textAlign: TextAlign.center))),
      );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: shell,
        bottomNavigationBar: ListenableBuilder(
          // Labels follow the interface language.
          listenable: course,
          builder: (context, _) => NavigationBar(
            selectedIndex: shell.currentIndex,
            // A second tap on the current tab goes back to its start.
            onDestinationSelected: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
            destinations: [
              NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home_rounded), label: T('Home')),
              NavigationDestination(icon: const Icon(Icons.style_outlined), selectedIcon: const Icon(Icons.style_rounded), label: T('Words')),
              NavigationDestination(icon: const Icon(Icons.school_outlined), selectedIcon: const Icon(Icons.school_rounded), label: T('Lessons')),
              NavigationDestination(icon: const Icon(Icons.account_circle_outlined), selectedIcon: const Icon(Icons.account_circle_rounded), label: T('Me')),
            ],
          ),
        ),
      );
}
