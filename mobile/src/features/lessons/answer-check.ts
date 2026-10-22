/**
 * Checking typed answers, ported line for line from the website (web/static/course/js/course.js: normalizeAnswer,
 * acceptedAnswers, localCheck), so a typed answer counts the same on both. Change both together.
 */

export type Verdict = { verdict: 'correct' | 'almost' | 'wrong'; note: string };

export function normalizeAnswer(text: string) {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[…."!?¿¡,;:„“”«»።፣፤፥፦፧]/g, ' ')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const foldUmlauts = (s: string) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
const stripUmlauts = (s: string) => s.replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// "to do/make" -> ["to do/make", "to do", "to make"]; "danke / danke schön" -> both halves.
function acceptedAnswers(expected: string) {
  const parts = expected.split('/').map(p => p.trim()).filter(Boolean);
  if (parts.length > 1 && /^to /i.test(parts[0])) {
    for (let i = 1; i < parts.length; i++) if (!/^to /i.test(parts[i])) parts[i] = 'to ' + parts[i];
  }
  return [expected, ...(parts.length > 1 ? parts : [])].map(normalizeAnswer);
}

const expandContractions = (s: string) =>
  s
    .replace(/\b(what|who|where|how|it|he|she|that)'s\b/g, '$1 is')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\b(you|we|they)'re\b/g, '$1 are')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\b(do|does|is|are)n't\b/g, '$1 not');

/** One expected answer. `t` translates the notes (the website's interface strings). */
export function localCheck(answer: string, expected: string, toGerman: boolean, t: (text: string) => string = s => s): Verdict {
  if (!toGerman) {
    answer = expandContractions(normalizeAnswer(answer));
    expected = expected
      .split('/')
      .map(p => expandContractions(normalizeAnswer(p)))
      .join(' / ');
  }
  const given = normalizeAnswer(answer);
  if (!given) return { verdict: 'wrong', note: '' };
  const dropEnglishArticle = (s: string) => s.replace(/^(the|a|an|to) /, '');
  const germanArticle = /^(der|die|das) /;
  for (const target of acceptedAnswers(expected)) {
    if (given === target) return { verdict: 'correct', note: '' };
    if (!toGerman && dropEnglishArticle(given) === dropEnglishArticle(target)) return { verdict: 'correct', note: '' };
    if (toGerman) {
      if (foldUmlauts(given) === foldUmlauts(target)) return { verdict: 'correct', note: t('ae/oe/ue/ss works, but try the ä ö ü ß keys.') };
      if (stripUmlauts(given) === stripUmlauts(target)) return { verdict: 'almost', note: t('Watch the umlauts (ä, ö, ü) and ß.') };
      if (germanArticle.test(target)) {
        const noun = target.replace(germanArticle, '');
        const article = target.split(' ')[0];
        if (given === noun) return { verdict: 'almost', note: t("Don't forget the article: {article}.").replace('{article}', article) };
        if (germanArticle.test(given) && given.replace(germanArticle, '') === noun) {
          return { verdict: 'almost', note: t('Wrong article. This noun takes {article}.').replace('{article}', article) };
        }
      }
    }
    const allowed = target.length <= 5 ? 1 : 2;
    if (editDistance(foldUmlauts(given), foldUmlauts(target)) <= allowed) return { verdict: 'almost', note: t('Nearly! Check the spelling.') };
  }
  return { verdict: 'wrong', note: '' };
}

/** Every accepted answer: the best verdict wins (as on the website, "almost" counts as right). */
export function checkTyped(answer: string, targets: string[], toGerman: boolean, t?: (text: string) => string): Verdict {
  let result: Verdict = { verdict: 'wrong', note: '' };
  for (const target of targets) {
    const r = localCheck(answer, target, toGerman, t);
    if (r.verdict === 'correct') return r;
    if (r.verdict === 'almost' && result.verdict === 'wrong') result = r;
  }
  return result;
}

/** Word tiles put in order: the same comparison as the website's. */
export function checkOrder(given: string[], answer: string, alts: string[], tiles: string[], lines: boolean) {
  if (lines) return given.join('\n') === tiles.join('\n');
  return [answer, ...alts].some(a => normalizeAnswer(a) === normalizeAnswer(given.join(' ')));
}
