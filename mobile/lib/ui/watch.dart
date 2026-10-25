import 'package:flutter/material.dart';

import '../core/course.dart';
import '../core/session.dart';
import '../core/settings.dart';
import '../core/sync/engine.dart';
import 'primitives.dart';
import 'theme.dart';

/// Rebuilds when anything the app shows changes: progress (from this or another device), the course, the account
/// or settings. The stores are small, so screens simply redraw from them.
class Watch extends StatelessWidget {
  const Watch({super.key, required this.builder});

  final WidgetBuilder builder;

  static final _all = Listenable.merge([sync, course, session, settings]);

  @override
  Widget build(BuildContext context) => ListenableBuilder(listenable: _all, builder: (context, _) => builder(context));
}

/// Shows its child once the course is on the phone; before that, loading or what to do when offline.
class CourseGate extends StatelessWidget {
  const CourseGate({super.key, required this.builder});

  final WidgetBuilder builder;

  @override
  Widget build(BuildContext context) => Watch(builder: (context) {
        final c = context.c;
        if (course.bundle != null) return builder(context);
        return Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(Space.lg),
              child: course.error == null
                  ? CircularProgressIndicator(color: c.brand, semanticsLabel: 'Loading the course')
                  : Column(mainAxisSize: MainAxisSize.min, children: [
                      Badge2(icon: Icons.wifi_off_rounded, colour: c.muted, background: c.surface2, size: 72),
                      const SizedBox(height: Space.md),
                      const Txt('The course downloads once', role: TextRole.heading, align: TextAlign.center),
                      const SizedBox(height: Space.sm),
                      Txt('Connect to the internet to get it. After that it works offline.', colour: c.muted, align: TextAlign.center),
                      const SizedBox(height: Space.md),
                      AppButton(label: 'Try again', icon: Icons.refresh_rounded, onPressed: course.refresh),
                    ]),
            ),
          ),
        );
      });
}
