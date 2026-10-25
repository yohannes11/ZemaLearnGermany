import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/offline/pictures.dart';

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
