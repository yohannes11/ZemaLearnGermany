import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/models.dart';
import '../../core/course.dart';
import '../../core/i18n.dart';
import '../../core/offline/pictures.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';

/// A word's picture: photos (compound words show their parts, joined by +), a flat swatch for a colour, or a
/// clock. Photos are kept on disk once seen. Decorative for screen readers: the text carries the meaning.
class WordPicture extends StatelessWidget {
  const WordPicture({super.key, required this.codes, required this.size});

  final List<String> codes;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (codes.isEmpty) return const SizedBox.shrink();
    final c = context.c;
    final radius = BorderRadius.circular(size * 0.14);
    return ExcludeSemantics(
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final (i, code) in codes.indexed) ...[
          if (i > 0) const SizedBox(width: 6),
          if (code == '+')
            Txt('+', colour: c.subtle, style: TextStyle(fontSize: size * 0.42, fontWeight: FontWeight.w700, height: 1))
          else if (code.startsWith('#'))
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: Color(int.parse('ff${code.substring(1)}', radix: 16)),
                borderRadius: radius,
                border: code == '#ffffff' ? Border.all(color: c.borderStrong) : null,
              ),
            )
          else
            SizedBox(
              width: size,
              height: size,
              child: FutureBuilder<Uint8List?>(
                future: Pictures.instance.bytes(code),
                builder: (context, snap) => AnimatedOpacity(
                  opacity: snap.data == null ? 0 : 1,
                  duration: const Duration(milliseconds: 150),
                  child: switch (snap.data) {
                    null => const SizedBox.shrink(),
                    final data when code.contains('.') => ClipRRect(
                        borderRadius: radius,
                        child: Image.memory(data, width: size, height: size, fit: BoxFit.cover, gaplessPlayback: true),
                      ),
                    final data => SvgPicture.memory(data, width: size, height: size),
                  },
                ),
              ),
            ),
        ],
      ]),
    );
  }
}

/// Who took the photos of a word and their licence, under its picture; tapping opens the photo on Wikimedia Commons.
class PhotoCredits extends StatelessWidget {
  const PhotoCredits(this.word, {super.key});

  final Word word;

  @override
  Widget build(BuildContext context) {
    final credits = course.photoCredits(word);
    if (credits.isEmpty) return const SizedBox.shrink();
    return Wrap(alignment: WrapAlignment.center, spacing: Space.sm, children: [
      for (final credit in credits)
        InkWell(
          onTap: () => launchUrl(Uri.parse(credit.page), mode: LaunchMode.inAppBrowserView),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.xs),
            child: Txt(T('Photo: {credit}', {'credit': '${credit.author}, ${credit.license}'}),
                role: TextRole.caption, colour: context.c.subtle, align: TextAlign.center),
          ),
        ),
    ]);
  }
}

/// Clocks for times the course teaches (web/tools/clock_pictures.py): each time on an analog face at the exact
/// hour said (vier Uhr is 4:00), with the time in digits underneath. Decorative for screen readers: the text says
/// the time.
class ClockPictures extends StatelessWidget {
  const ClockPictures(this.times, {super.key, this.size = 44, this.caption = true});

  final List<String> times;
  final double size;
  final bool caption;

  static String code(String time) {
    final [hours, minutes] = time.split(':');
    return 'clock-${hours.padLeft(2, '0')}$minutes';
  }

  @override
  Widget build(BuildContext context) {
    if (times.isEmpty) return const SizedBox.shrink();
    return ExcludeSemantics(
      child: Wrap(spacing: 10, runSpacing: 6, children: [
        for (final time in times)
          Column(mainAxisSize: MainAxisSize.min, children: [
            WordPicture(codes: [code(time)], size: size),
            if (caption)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Txt(time, role: TextRole.caption, colour: context.c.muted, style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
          ]),
      ]),
    );
  }
}
