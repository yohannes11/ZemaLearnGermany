// The app's answer checking, on answers whose verdict the website gives. Run: npm run test:sync
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkOrder, checkTyped, normalizeAnswer } from './answer-check.ts';

test('normalising ignores punctuation, brackets and case', () => {
  assert.equal(normalizeAnswer('  Wie geht es Ihnen? (formal) '), 'wie geht es ihnen');
});

test('German answers', () => {
  assert.equal(checkTyped('Ich heiße Liya', ['Ich heiße Liya.'], true).verdict, 'correct');
  assert.equal(checkTyped('Ich heisse Liya', ['Ich heiße Liya.'], true).verdict, 'correct'); // ss for ß
  assert.equal(checkTyped('schon', ['schön'], true).verdict, 'almost'); // umlaut missing
  assert.equal(checkTyped('Tisch', ['der Tisch'], true).note, "Don't forget the article: der.");
  assert.equal(checkTyped('die Tisch', ['der Tisch'], true).note, 'Wrong article. This noun takes der.');
  assert.equal(checkTyped('Hund', ['der Tisch'], true).verdict, 'wrong');
});

test('English answers', () => {
  assert.equal(checkTyped("I'm fine", ['I am fine'], false).verdict, 'correct');
  assert.equal(checkTyped('make', ['to do/make'], false).verdict, 'correct');
  assert.equal(checkTyped('the table', ['table'], false).verdict, 'correct');
});

test('word order', () => {
  assert.ok(checkOrder(['Ich', 'komme', 'aus', 'Äthiopien.'], 'Ich komme aus Äthiopien.', [], [], false));
  assert.ok(!checkOrder(['Aus', 'Äthiopien', 'komme', 'ich.'], 'Ich komme aus Äthiopien.', [], [], false));
  assert.ok(checkOrder(['Hallo!', 'Hi!'], '', [], ['Hallo!', 'Hi!'], true));
});
