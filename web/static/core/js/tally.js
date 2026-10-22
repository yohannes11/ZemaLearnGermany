/* The stick-strikeout streak tally: one implementation for the website and the app.

   The website loads this file as a script (window.ZemaTally); the app imports the very same file
   (mobile/metro.config.js, `@shared/tally`). Both draw from what it returns, so the streak, the sticks, their
   positions, colours and timing are identical everywhere. Types: tally.d.ts. Tests: mobile `npm run test:sync`.

   The tally, one stick per day of the current streak:
     - a day the learner practised keeps the streak alive: a stick ("kept");
     - a day they reached their daily goal: the stick gets a bold diagonal strikeout ("met");
     - today, until its goal is reached: a glowing stick ("today"), counted in the streak once practised;
     - a missed day covered by a streak freeze: an icy stick ("frozen");
     - the day a streak broke: one muted stick before the new streak ("missed").
   Sticks are bundled in fives; a bundle whose five days all reached the goal is bound with a gold band.
   Every five goal days in a streak earn a freeze (at most two), and a freeze covers one missed day by itself.

   Everything is computed from the synced facts (days practised, XP per day, the daily goal's history), never
   stored, so every device shows the same tally. Days are the learner's own calendar days (YYYY-MM-DD): the day
   ends at their midnight, wherever they are. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZemaTally = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY_MS = 86400000;
  var DEFAULT_GOAL = 50;
  var BUNDLE = 5;
  var MAX_FREEZES = 2;
  // A broken streak shows the day it broke only while it is recent.
  var SHOW_BREAK_DAYS = 2;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // Calendar arithmetic in UTC, so daylight-saving changes can never skip or repeat a day.
  function parse(day) { var p = day.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function key(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(day, n) { return key(parse(day) + n * DAY_MS); }
  /** The learner's calendar day now (their device's time zone). */
  function today(date) {
    date = date || new Date();
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /** The daily goal in force on `day`: the latest change ([day, at, xp, id]) made on or before it. */
  function goalOn(goals, day, fallback) {
    var best = null;
    for (var i = 0; i < goals.length; i++) {
      var g = goals[i];
      if (g[0] > day) continue;
      if (!best || g[1] > best[1] || (g[1] === best[1] && g[3] > best[3])) best = g;
    }
    return best ? best[2] : fallback;
  }

  /**
   * The streak and its marks. `input`: { days, xp, goals, today, defaultGoal }.
   * Returns { streak, freezes, goal, todayXp, todayMet, marks: [{ day, state, today }], broken: day | null }.
   */
  function timeline(input) {
    var now = input.today || today();
    var practised = {};
    (input.days || []).forEach(function (d) { practised[d] = true; });
    var xp = input.xp || {};
    var goals = input.goals || [];
    var fallback = input.defaultGoal || DEFAULT_GOAL;
    var met = function (day) { return (xp[day] || 0) >= goalOn(goals, day, fallback); };

    var first = Object.keys(practised).filter(function (d) { return d < now; }).sort()[0];
    var run = [];
    var freezes = 0;
    var metInRun = 0;
    var broken = null;
    for (var day = first; day && day < now; day = addDays(day, 1)) {
      if (practised[day]) {
        var m = met(day);
        run.push({ day: day, state: m ? 'met' : 'kept', today: false });
        if (m && ++metInRun % BUNDLE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
      } else if (freezes > 0) {
        freezes--;
        run.push({ day: day, state: 'frozen', today: false });
      } else {
        if (run.length) broken = day;
        run = [];
        metInRun = 0;
        freezes = 0;
      }
    }
    var todayMet = met(now);
    // Today glows until its goal is reached; practising already keeps the streak going, so it counts.
    run.push({ day: now, state: todayMet ? 'met' : 'today', today: true });
    var streak = run.filter(function (m) { return m.state === 'met' || m.state === 'kept'; }).length + (practised[now] && !todayMet ? 1 : 0);
    var recentBreak = broken && run.length === 1 && broken >= addDays(now, -SHOW_BREAK_DAYS) ? broken : null;
    return {
      streak: streak,
      freezes: freezes,
      goal: goalOn(goals, now, fallback),
      todayXp: xp[now] || 0,
      todayMet: todayMet,
      marks: run,
      broken: recentBreak,
    };
  }

  /** Sizes for a tally: "full" (Home, profile, results) and "compact" (top bars). */
  var SIZES = {
    full: { height: 30, pitch: 12, gap: 14, stroke: 3.2, strike: 3.6, maxSticks: 20, pad: 6 },
    compact: { height: 16, pitch: 7, gap: 7, stroke: 2.2, strike: 2.4, maxSticks: 5, pad: 3 },
  };

  /**
   * Where everything goes, in SVG units: { width, height, sticks: [{ x, y1, y2, state, day, today }],
   * strikes: [{ x1, y1, x2, y2, day }], bands: [{ x1, x2, y }], hidden }. `hidden` counts days in bundles too old
   * to show (shown as "+n"); the newest days are always visible.
   */
  function layout(model, sizeName) {
    var s = SIZES[sizeName] || SIZES.full;
    var marks = model.marks;
    var firstBundle = Math.max(0, Math.ceil((marks.length - s.maxSticks) / BUNDLE));
    var hidden = firstBundle * BUNDLE;
    var top = s.pad;
    var bottom = top + s.height;
    var x0 = s.pad + s.stroke;
    var sticks = [];
    var strikes = [];
    var bands = [];
    if (model.broken) {
      sticks.push({ x: x0, y1: top, y2: bottom, state: 'missed', day: model.broken, today: false });
      x0 += s.pitch + s.gap;
    }
    var bundleX = function (b) { return x0 + (b - firstBundle) * (BUNDLE * s.pitch + s.gap); };
    for (var i = hidden; i < marks.length; i++) {
      var b = Math.floor(i / BUNDLE);
      var x = bundleX(b) + (i % BUNDLE) * s.pitch;
      sticks.push({ x: x, y1: top, y2: bottom, state: marks[i].state, day: marks[i].day, today: marks[i].today });
      if (marks[i].state === 'met') {
        // Each strike crosses its own stick only, so every day stays readable.
        var half = s.pitch * 0.36;
        strikes.push({ x1: x - half, y1: top + s.height * 0.78, x2: x + half, y2: top + s.height * 0.22, day: marks[i].day });
      }
    }
    for (var bi = firstBundle; bi * BUNDLE + BUNDLE <= marks.length; bi++) {
      var all = true;
      for (var j = 0; j < BUNDLE; j++) all = all && marks[bi * BUNDLE + j].state === 'met';
      if (all) bands.push({ x1: bundleX(bi) - s.stroke, x2: bundleX(bi) + (BUNDLE - 1) * s.pitch + s.stroke, y: bottom + s.stroke + 1 });
    }
    var last = sticks.length ? sticks[sticks.length - 1].x : x0;
    return { width: last + s.stroke + s.pad + s.pitch * 0.36, height: bottom + s.stroke * 2 + 3 + s.pad, sticks: sticks, strikes: strikes, bands: bands, hidden: hidden, size: s };
  }

  /** Which colour each part takes: names from the design system (web: CSS --vars, app: ui/theme). */
  var COLOURS = { stick: 'text', today: 'goldBright', missed: 'borderStrong', frozen: 'freeze', strike: 'flame', band: 'goldBright' };

  /** Motion, shared by both: the strikeout draws itself, a new stick pops in, today's stick glows. */
  var MOTION = { strikeMs: 420, strikeStaggerMs: 90, popMs: 260, glowMs: 1600, ease: [0.2, 0.7, 0.2, 1] };

  return {
    BUNDLE: BUNDLE,
    MAX_FREEZES: MAX_FREEZES,
    DEFAULT_GOAL: DEFAULT_GOAL,
    SIZES: SIZES,
    COLOURS: COLOURS,
    MOTION: MOTION,
    today: today,
    addDays: addDays,
    goalOn: goalOn,
    timeline: timeline,
    layout: layout,
  };
});
