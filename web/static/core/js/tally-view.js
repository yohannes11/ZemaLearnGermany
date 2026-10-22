/* The streak tally on the website: draws the layout from tally.js (the same file the app uses) as SVG, with the
   same colours (as CSS variables from zema.css) and timing (passed to tally.css as custom properties). */
(function () {
  'use strict';
  var T = window.ZemaTally;
  var SEEN_KEY = 'tally-struck';
  var MAX_REMEMBERED = 60;
  var CSS_VAR = { text: '--text', goldBright: '--gold-bright', borderStrong: '--border-strong', freeze: '--freeze', flame: '--flame' };

  function colour(name) { return 'var(' + (CSS_VAR[name] || '--text') + ')'; }
  function seen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; } }
  function remember(days) {
    if (!days.length) return;
    var all = seen().concat(days).filter(function (d, i, a) { return a.indexOf(d) === i; }).slice(-MAX_REMEMBERED);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(all)); } catch (e) {}
  }
  function line(x1, y1, x2, y2, attrs) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' + attrs + '/>';
  }

  /**
   * Draws `model` (ZemaTally.timeline(...)) into `el`. Strikes this browser hasn't drawn yet draw themselves once
   * (also for goals reached on another device). `label` is the text for screen readers.
   */
  function render(el, model, size, label) {
    var layout = T.layout(model, size);
    var s = layout.size;
    var before = seen();
    var fresh = [];
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var parts = [];
    layout.bands.forEach(function (b) {
      parts.push(line(b.x1, b.y, b.x2, b.y, 'class="tally-band" stroke="' + colour(T.COLOURS.band) + '" stroke-width="' + s.stroke + '"'));
    });
    layout.sticks.forEach(function (stick) {
      if (stick.state === 'today') {
        parts.push(line(stick.x, stick.y1, stick.x, stick.y2, 'class="tally-glow" stroke="' + colour(T.COLOURS.today) + '" stroke-width="' + s.stroke * 3 + '"'));
      }
      var name = stick.state === 'met' || stick.state === 'kept' ? T.COLOURS.stick : T.COLOURS[stick.state];
      var dash = stick.state === 'missed' ? ' stroke-dasharray="' + s.stroke + ' ' + s.stroke * 1.4 + '"' : '';
      parts.push(line(stick.x, stick.y1, stick.x, stick.y2, 'class="tally-stick is-' + stick.state + '" stroke="' + colour(name) + '" stroke-width="' + s.stroke + '"' + dash));
    });
    layout.strikes.forEach(function (strike) {
      var length = Math.hypot(strike.x2 - strike.x1, strike.y2 - strike.y1).toFixed(2);
      var isNew = before.indexOf(strike.day) < 0;
      var style = '--len:' + length;
      if (isNew && !reduce) style += ';--delay:' + fresh.length * T.MOTION.strikeStaggerMs + 'ms';
      if (isNew) fresh.push(strike.day);
      parts.push(line(strike.x1, strike.y1, strike.x2, strike.y2,
        'class="tally-strike' + (isNew && !reduce ? ' draw' : '') + '" stroke="' + colour(T.COLOURS.strike) + '" stroke-width="' + s.strike + '" stroke-dasharray="' + length + '" style="' + style + '"'));
    });
    el.classList.add('tally', 'tally-' + size);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
    el.style.setProperty('--strike-ms', T.MOTION.strikeMs + 'ms');
    el.style.setProperty('--glow-ms', T.MOTION.glowMs + 'ms');
    el.style.setProperty('--ease', 'cubic-bezier(' + T.MOTION.ease.join(',') + ')');
    el.innerHTML = (layout.hidden ? '<span class="tally-more" aria-hidden="true">+' + layout.hidden + '</span>' : '') +
      '<svg width="' + layout.width.toFixed(1) + '" height="' + layout.height.toFixed(1) + '" viewBox="0 0 ' + layout.width.toFixed(1) + ' ' + layout.height.toFixed(1) + '" aria-hidden="true" focusable="false">' + parts.join('') + '</svg>';
    remember(fresh);
    return fresh.length;
  }

  window.ZemaTallyView = { render: render };
})();
