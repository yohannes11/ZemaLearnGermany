// The app's answer checking, on answers whose verdict the website gives.
import 'package:flutter_test/flutter_test.dart';
import 'package:zema_german/features/lessons/answer_check.dart';

void main() {
  test('normalising ignores punctuation, brackets and case', () {
    expect(normalizeAnswer('  Wie geht es Ihnen? (formal) '), 'wie geht es ihnen');
  });

  test('German answers', () {
    expect(checkTyped('Ich heiße Liya', ['Ich heiße Liya.'], true).verdict, Verdict.correct);
    expect(checkTyped('Ich heisse Liya', ['Ich heiße Liya.'], true).verdict, Verdict.correct); // ss for ß
    expect(checkTyped('schon', ['schön'], true).verdict, Verdict.almost); // umlaut missing
    expect(checkTyped('Tisch', ['der Tisch'], true).note, "Don't forget the article: der.");
    expect(checkTyped('die Tisch', ['der Tisch'], true).note, 'Wrong article. This noun takes der.');
    expect(checkTyped('Hund', ['der Tisch'], true).verdict, Verdict.wrong);
  });

  test('English answers', () {
    expect(checkTyped("I'm fine", ['I am fine'], false).verdict, Verdict.correct);
    expect(checkTyped('make', ['to do/make'], false).verdict, Verdict.correct);
    expect(checkTyped('the table', ['table'], false).verdict, Verdict.correct);
  });

  test('word order', () {
    expect(checkOrder(['Ich', 'komme', 'aus', 'Äthiopien.'], 'Ich komme aus Äthiopien.', [], [], false), isTrue);
    expect(checkOrder(['Aus', 'Äthiopien', 'komme', 'ich.'], 'Ich komme aus Äthiopien.', [], [], false), isFalse);
    expect(checkOrder(['Hallo!', 'Hi!'], '', [], ['Hallo!', 'Hi!'], true), isTrue);
  });

  test('speaking: close enough counts', () {
    expect(soundsLike(['guten morgen'], 'Guten Morgen!'), isTrue);
    expect(soundsLike(['schoen'], 'schön'), isTrue);
    expect(soundsLike(['auf wiedersehen'], 'Danke'), isFalse);
  });
}
