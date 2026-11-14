// Checks the website's course search (static/course/js/search.js) against search_cases.json, on the real course.
// Run by test_search.py:  node apps/course/tests/search_check.js   (prints the failures; exit code 1 if any)
const fs = require('fs');
const path = require('path');

const web = path.resolve(__dirname, '../../..');
const load = file => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(web, file), 'utf8'))(window);
  return window;
};
const { COURSE } = load('static/course/js/course-data.js');
const { COURSE_AM } = load('static/course/js/course-am.js');
const search = require(path.join(web, 'static/course/js/search.js'));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'search_cases.json'), 'utf8'));

const failures = [];
const fail = (what, got) => failures.push(`${what}: got ${JSON.stringify(got)}`);

cases.fold.forEach(([text, want]) => { if (search.fold(text) !== want) fail(`fold ${text} → ${want}`, search.fold(text)); });
cases.same_sound.forEach(([a, b]) => {
  const [ka, kb] = [a, b].map(w => search.phonetic(search.fold(w)));
  if (ka !== kb) fail(`${a} sounds like ${b}`, [ka, kb]);
});
cases.transliterate.forEach(([text, want]) => { if (search.transliterate(text) !== want) fail(`transliterate ${text} → ${want}`, search.transliterate(text)); });

const index = search.createIndex(COURSE, COURSE_AM, null);
// Whether a result fits the filters it was asked for (search.js filters the same way).
const fitsFilters = (r, { types = [], pos = [], unit = null, section = null, level = null }) =>
  (!types.length || types.includes(r.type)) && (!pos.length || (r.kind === 'word' && pos.includes(r.pos))) &&
  (unit === null || r.units.includes(unit)) && (!section || r.sections.includes(section)) && (!level || r.levels.includes(level));

cases.queries.forEach(({ q, first, expect = [], within = 10, none, filters = null }) => {
  const results = index.search(q, { filters });
  results.filter(r => filters && !fitsFilters(r, filters)).forEach(r => fail(`"${q}" with ${JSON.stringify(filters)} only fitting results`, [r.kind, r.id]));
  const top = results.map(r => [r.kind, r.id]);
  const shown = top.slice(0, Math.max(within, 3));
  if (none) { if (results.length) fail(`"${q}" finds nothing`, shown); return; }
  if (first && (top[0] || []).join('|') !== first.join('|')) fail(`"${q}" first ${first}`, shown);
  expect.forEach(want => {
    if (!top.slice(0, within).some(r => r.join('|') === want.join('|'))) fail(`"${q}" finds ${want} in the first ${within}`, shown);
  });
});

if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
console.log(`search: ${cases.queries.length} queries and ${cases.fold.length + cases.same_sound.length + cases.transliterate.length} spelling cases pass`);
