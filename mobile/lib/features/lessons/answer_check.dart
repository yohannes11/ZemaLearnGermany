/// Checking typed answers, ported line for line from the website (web/static/course/js/course.js: normalizeAnswer,
/// acceptedAnswers, localCheck, soundsLike), so an answer counts the same on both. Change both together.
library;

enum Verdict { correct, almost, wrong }

class Checked {
  const Checked(this.verdict, [this.note = '']);
  final Verdict verdict;
  final String note;
}

String normalizeAnswer(String text) => text
    .replaceAll(RegExp(r'\([^)]*\)'), ' ')
    .replaceAll(RegExp(r'[…."!?¿¡,;:„“”«»።፣፤፥፦፧]'), ' ')
    .replaceAll(RegExp('[’`]'), "'")
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim()
    .toLowerCase();

String foldUmlauts(String s) => s.replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss');
String _stripUmlauts(String s) => s.replaceAll('ä', 'a').replaceAll('ö', 'o').replaceAll('ü', 'u').replaceAll('ß', 'ss');

int editDistance(String a, String b) {
  final row = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    var prev = row[0];
    row[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final tmp = row[j];
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      row[j] = [row[j] + 1, row[j - 1] + 1, prev + cost].reduce((x, y) => x < y ? x : y);
      prev = tmp;
    }
  }
  return row[b.length];
}

// "to do/make" -> ["to do/make", "to do", "to make"]; "danke / danke schön" -> both halves.
List<String> acceptedAnswers(String expected) {
  final parts = expected.split('/').map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
  final to = RegExp('^to ', caseSensitive: false);
  if (parts.length > 1 && to.hasMatch(parts[0])) {
    for (var i = 1; i < parts.length; i++) {
      if (!to.hasMatch(parts[i])) parts[i] = 'to ${parts[i]}';
    }
  }
  return [expected, if (parts.length > 1) ...parts].map(normalizeAnswer).toList();
}

String _expandContractions(String s) => s
    .replaceAllMapped(RegExp(r"\b(what|who|where|how|it|he|she|that)'s\b"), (m) => '${m[1]} is')
    .replaceAll(RegExp(r"\bi'm\b"), 'i am')
    .replaceAllMapped(RegExp(r"\b(you|we|they)'re\b"), (m) => '${m[1]} are')
    .replaceAll(RegExp(r"\bcan't\b"), 'cannot')
    .replaceAllMapped(RegExp(r"\b(do|does|is|are)n't\b"), (m) => '${m[1]} not');

/// One expected answer. `t` translates the notes (the website's interface strings).
Checked localCheck(String answer, String expected, bool toGerman, [String Function(String)? t]) {
  final tr = t ?? (String s) => s;
  if (!toGerman) {
    answer = _expandContractions(normalizeAnswer(answer));
    expected = expected.split('/').map((p) => _expandContractions(normalizeAnswer(p))).join(' / ');
  }
  final given = normalizeAnswer(answer);
  if (given.isEmpty) return const Checked(Verdict.wrong);
  String dropEnglishArticle(String s) => s.replaceFirst(RegExp('^(the|a|an|to) '), '');
  final germanArticle = RegExp('^(der|die|das) ');
  for (final target in acceptedAnswers(expected)) {
    if (given == target) return const Checked(Verdict.correct);
    if (!toGerman && dropEnglishArticle(given) == dropEnglishArticle(target)) return const Checked(Verdict.correct);
    if (toGerman) {
      if (foldUmlauts(given) == foldUmlauts(target)) {
        return Checked(Verdict.correct, tr('ae/oe/ue/ss works, but try the ä ö ü ß keys.'));
      }
      if (_stripUmlauts(given) == _stripUmlauts(target)) {
        return Checked(Verdict.almost, tr('Watch the umlauts (ä, ö, ü) and ß.'));
      }
      if (germanArticle.hasMatch(target)) {
        final noun = target.replaceFirst(germanArticle, '');
        final article = target.split(' ').first;
        if (given == noun) {
          return Checked(Verdict.almost, tr("Don't forget the article: {article}.").replaceAll('{article}', article));
        }
        if (germanArticle.hasMatch(given) && given.replaceFirst(germanArticle, '') == noun) {
          return Checked(Verdict.almost, tr('Wrong article. This noun takes {article}.').replaceAll('{article}', article));
        }
      }
    }
    final allowed = target.length <= 5 ? 1 : 2;
    if (editDistance(foldUmlauts(given), foldUmlauts(target)) <= allowed) {
      return Checked(Verdict.almost, tr('Nearly! Check the spelling.'));
    }
  }
  return const Checked(Verdict.wrong);
}

/// Every accepted answer: the best verdict wins (as on the website, "almost" counts as right).
Checked checkTyped(String answer, List<String> targets, bool toGerman, [String Function(String)? t]) {
  var result = const Checked(Verdict.wrong);
  for (final target in targets) {
    final r = localCheck(answer, target, toGerman, t);
    if (r.verdict == Verdict.correct) return r;
    if (r.verdict == Verdict.almost && result.verdict == Verdict.wrong) result = r;
  }
  return result;
}

/// Word tiles put in order: the same comparison as the website's.
bool checkOrder(List<String> given, String answer, List<String> alts, List<String> tiles, bool lines) {
  if (lines) return given.join('\n') == tiles.join('\n');
  final said = normalizeAnswer(given.join(' '));
  return [answer, ...alts].any((a) => normalizeAnswer(a) == said);
}

/// Speaking: close enough counts, since recognisers often drop punctuation, umlauts or a short word.
bool soundsLike(List<String> heardList, String target) {
  final targets = acceptedAnswers(target).map(foldUmlauts).toList();
  return heardList.any((h) {
    final heard = foldUmlauts(normalizeAnswer(h));
    if (heard.isEmpty) return false;
    return targets.any((t) {
      final allowed = (t.length * 0.34).round();
      return heard == t || heard.contains(t) || editDistance(heard, t) <= (allowed < 1 ? 1 : allowed);
    });
  });
}
