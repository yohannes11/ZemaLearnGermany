import 'package:flutter/material.dart';

import 'theme.dart';

enum _Mark { german, strong, em, mark }

final _tag = RegExp(r'<(/?)(em|strong|mark)(\s+class="de")?\s*>');

/// Course text with the website's inline markup: <em class="de"> marks German inside an explanation, <strong>
/// stresses a word, <mark> highlights an ending. Anything else in angle brackets is left out rather than shown.
List<(String, Set<_Mark>)> _parse(String source) {
  final runs = <(String, Set<_Mark>)>[];
  final open = <_Mark>[];
  var last = 0;
  void push(String text) {
    final clean = text.replaceAll(RegExp('<[^>]*>'), '');
    if (clean.isNotEmpty) runs.add((clean, {...open}));
  }

  for (final m in _tag.allMatches(source)) {
    push(source.substring(last, m.start));
    last = m.end;
    final closing = m[1]!.isNotEmpty;
    final tag = m[2]!;
    final mark = switch (tag) {
      'strong' => _Mark.strong,
      'mark' => _Mark.mark,
      _ => (m[3] != null || (closing && open.contains(_Mark.german))) ? _Mark.german : _Mark.em,
    };
    if (closing) {
      final at = open.lastIndexOf(mark);
      if (at >= 0) open.removeAt(at);
    } else {
      open.add(mark);
    }
  }
  push(source.substring(last));
  return runs;
}

/// Text that may carry the course's inline markup, shown as the website shows it: German words in bold.
class RichTxt extends StatelessWidget {
  const RichTxt(this.source, {super.key, this.role = TextRole.body, this.colour, this.align});

  final String source;
  final TextRole role;
  final Color? colour;
  final TextAlign? align;

  @override
  Widget build(BuildContext context) {
    final c = context.c;
    return Text.rich(
      TextSpan(children: [
        for (final (text, marks) in _parse(source))
          TextSpan(
            text: text,
            style: TextStyle(
              fontWeight: marks.contains(_Mark.german) || marks.contains(_Mark.strong) || marks.contains(_Mark.mark) ? FontWeight.w700 : null,
              fontStyle: marks.contains(_Mark.em) ? FontStyle.italic : null,
              color: marks.contains(_Mark.mark) ? c.brand : null,
            ),
          ),
      ]),
      textAlign: align,
      style: textStyle(role).copyWith(color: colour ?? c.text),
    );
  }
}
