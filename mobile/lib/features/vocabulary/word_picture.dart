import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/offline/pictures.dart';
import '../../ui/primitives.dart';
import '../../ui/theme.dart';

/// A word's picture: one or more emoji (compound words show their parts). Kept on disk once seen.
class WordPicture extends StatelessWidget {
  const WordPicture({super.key, required this.codes, required this.size});

  final List<String> codes;
  final double size;

  @override
  Widget build(BuildContext context) {
    if (codes.isEmpty) return const SizedBox.shrink();
    return ExcludeSemantics(
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final (i, code) in codes.indexed) ...[
          if (i > 0) const SizedBox(width: 6),
          SizedBox(
            width: size,
            height: size,
            child: FutureBuilder<String?>(
              future: Pictures.instance.svg(code),
              builder: (context, snap) => AnimatedOpacity(
                opacity: snap.data == null ? 0 : 1,
                duration: const Duration(milliseconds: 150),
                child: snap.data == null ? const SizedBox.shrink() : SvgPicture.string(snap.data!, width: size, height: size),
              ),
            ),
          ),
        ],
      ]),
    );
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
