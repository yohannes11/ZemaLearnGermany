// The shared streak tally (web/static/core/js/tally.js), used by both the website and the app. Run: npm run test:sync
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const tally = createRequire(import.meta.url)('../../../../web/static/core/js/tally.js');

const T = '2026-10-10';
const day = (n: number) => tally.addDays(T, n);
const states = (input: object) => tally.timeline({ today: T, ...input }).marks.map((m: { state: string }) => m.state);

test('practice keeps the streak; the goal strikes the day', () => {
  const t = tally.timeline({ today: T, days: [day(-2), day(-1), T], xp: { [day(-2)]: 60, [day(-1)]: 10, [T]: 50 } });
  assert.deepEqual(t.marks.map((m: { state: string }) => m.state), ['met', 'kept', 'met']);
  assert.equal(t.streak, 3);
  assert.equal(t.todayMet, true);
});

test('today glows until its goal is reached, and counts once practised', () => {
  assert.deepEqual(states({ days: [day(-1)], xp: { [day(-1)]: 50 } }), ['met', 'today']);
  assert.equal(tally.timeline({ today: T, days: [day(-1)] }).streak, 1);
  const practising = tally.timeline({ today: T, days: [day(-1), T], xp: { [T]: 20 } });
  assert.deepEqual(practising.marks.map((m: { state: string }) => m.state), ['kept', 'today']);
  assert.equal(practising.streak, 2);
});

test('a missed day breaks the streak and shows while recent', () => {
  const t = tally.timeline({ today: T, days: [day(-3), day(-2)], xp: {} });
  assert.equal(t.streak, 0);
  assert.equal(t.broken, day(-1));
  assert.deepEqual(t.marks.map((m: { state: string }) => m.state), ['today']);
  assert.equal(tally.timeline({ today: T, days: [day(-9), day(-8)] }).broken, null); // long ago: not shown
});

test('five goal days earn a freeze that covers one missed day', () => {
  const days = [-7, -6, -5, -4, -3, -1].map(day);
  const xp = Object.fromEntries(days.map(d => [d, 50]));
  const t = tally.timeline({ today: T, days, xp });
  assert.deepEqual(t.marks.map((m: { state: string }) => m.state), ['met', 'met', 'met', 'met', 'met', 'frozen', 'met', 'today']);
  assert.equal(t.streak, 6);
  assert.equal(t.freezes, 0);
});

test('each day is judged by the goal in force that day', () => {
  const goals = [[day(-5), 1, 30, 'a'], [day(-1), 2, 100, 'b']];
  const t = tally.timeline({ today: T, days: [day(-2), day(-1)], xp: { [day(-2)]: 40, [day(-1)]: 40 }, goals });
  assert.deepEqual(t.marks.map((m: { state: string }) => m.state), ['met', 'kept', 'today']);
  assert.equal(t.goal, 100);
});

test('layout: bundles of five, a gold band on a full bundle, old bundles folded away', () => {
  const days = Array.from({ length: 26 }, (_, i) => day(i - 26));
  const xp = Object.fromEntries(days.map(d => [d, 50]));
  const model = tally.timeline({ today: T, days, xp });
  const full = tally.layout(model, 'full');
  assert.equal(full.hidden, 10);
  assert.equal(full.sticks.length, 17); // days 11-26 and today
  assert.equal(full.strikes.length, 16);
  assert.ok(full.bands.length >= 3);
  const gap = full.sticks[5].x - full.sticks[4].x;
  assert.ok(gap > full.sticks[1].x - full.sticks[0].x, 'bundles are set apart');
  assert.equal(tally.layout(model, 'compact').sticks.length <= 5, true);
});

test('dates cross month ends and daylight-saving changes', () => {
  assert.equal(tally.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(tally.addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(tally.addDays('2027-01-01', -1), '2026-12-31');
});
