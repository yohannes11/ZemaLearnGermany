import type { Lesson, QuizItem, Unit, Word } from '@/core/api/types';
import { hasClip } from '@/core/offline/audio';

import { QUIZ_SIZE, shuffle } from './kinds';

/** What every question shares: what to ask, the right answer, and what to play and explain. */
type Common = {
  prompt: string;
  hint?: string;
  answer: string;
  /** German to play: before answering for listening questions, after answering otherwise. */
  say?: string;
  listen: boolean;
  /** Shown as the answer afterwards (the website's `show`, else `say`). */
  shown?: string;
  why?: string;
};

export type ChoiceQuestion = Common & { type: 'choice'; options: string[]; gap?: { before: string; after: string } };
/** Word tiles (or dialogue lines) put in order. */
export type OrderQuestion = Common & { type: 'order'; tiles: string[]; lines: boolean; alts: string[] };
/** A typed answer: a translation or dictation. */
export type WriteQuestion = Common & { type: 'write'; text?: string; toGerman: boolean; alts: string[] };
export type Question = ChoiceQuestion | OrderQuestion | WriteQuestion;

type Translate = (text: string) => string;
type Amharic = { words: Record<string, string>; text: Record<string, string> } | null;

/**
 * One quiz item as a question, as the website builds it (course.js: forLanguage, withChoices, buildOrder,
 * buildWrite). In Amharic, "what does it mean in English?" becomes a choice between Amharic meanings: typed
 * Amharic has too many right wordings to check fairly.
 */
function fromItem(item: QuizItem, t: Translate, amharic: Amharic, meaningPool: string[]): Question {
  const raw = item as QuizItem & Record<string, unknown>;
  const common: Common = {
    prompt: t(String(item.prompt ?? '')),
    hint: item.hint ? t(item.hint) : undefined,
    answer: item.answer,
    say: item.say,
    listen: item.type === 'listen' || raw.listen === true,
    shown: typeof raw.show === 'string' ? raw.show : item.say,
    why: item.why ? t(item.why) : undefined,
  };
  const alts = Array.isArray(raw.alts) ? (raw.alts as string[]) : [];

  if (item.type === 'order') {
    return { ...common, type: 'order', tiles: (raw.tiles as string[]) ?? [], lines: raw.mode === 'lines', alts };
  }
  if (item.type === 'write') {
    const text = typeof raw.text === 'string' ? raw.text : undefined;
    if (amharic && raw.lang === 'en') {
      const right = (text && amharic.words[text]) || t(item.answer);
      const others = shuffle([...new Set(meaningPool)].filter(m => m !== right)).slice(0, 2);
      return { ...common, type: 'choice', answer: right, options: shuffle([right, ...others]), hint: text };
    }
    return { ...common, type: 'write', text, toGerman: raw.lang === 'de', alts };
  }
  const options = shuffle(Array.isArray(raw.options) ? (raw.options as string[]) : []);
  if (item.type === 'gap') {
    const gap = { before: String(raw.before ?? ''), after: String(raw.after ?? '') };
    return { ...common, type: 'choice', options, prompt: common.listen ? 'Listen and fill the gap' : 'Fill the gap', gap };
  }
  return { ...common, type: 'choice', options };
}

/**
 * A lesson's exercise: QUIZ_SIZE items drawn at random (or the items an exercise saved on another device), as item
 * numbers, so any device can rebuild the very same questions.
 */
export function lessonQuestions(lesson: Lesson, t: Translate, amharic: Amharic, items?: number[]) {
  const all = lesson.quiz?.items ?? [];
  const picked = items ? items.filter(i => Number.isInteger(i) && i >= 0 && i < all.length) : shuffle(all.map((_, i) => i)).slice(0, QUIZ_SIZE);
  const pool = amharic ? Object.values(amharic.words) : [];
  return { items: picked, questions: picked.map(i => fromItem(all[i], t, amharic, pool)) };
}

export const LISTENING_SIZE = 10;

/**
 * Listening practice for a unit: hear a word or phrase and pick what was said, among others from the same unit,
 * plus the unit's own listening items. Needs the recordings (downloaded, or streamed online).
 */
export function listeningQuestions(unit: Unit, meaning: (word: Word) => string): Question[] {
  const words = unit.sections.flatMap(s => s.words).filter(w => hasClip(w.german));
  const fromWords: Question[] = shuffle(words)
    .slice(0, LISTENING_SIZE)
    .map(word => {
      const others = shuffle(words.filter(w => w.german !== word.german)).slice(0, 3);
      return {
        type: 'choice',
        prompt: 'What do you hear?',
        options: shuffle([word.german, ...others.map(o => o.german)]),
        answer: word.german,
        say: word.german,
        listen: true,
        why: `${word.german} = ${meaning(word)}`,
      };
    });
  const fromLessons: Question[] = unit.grammar
    .flatMap(lesson => lesson.quiz?.items ?? [])
    .filter(item => item.type === 'listen' && item.say && hasClip(item.say))
    .map(item => ({
      type: 'choice',
      prompt: 'What do you hear?',
      options: shuffle('options' in item ? (item.options as string[]) : []),
      answer: item.answer,
      say: item.say,
      listen: true,
      why: item.why,
    }));
  return shuffle([...fromWords, ...shuffle(fromLessons).slice(0, 4)]).slice(0, LISTENING_SIZE);
}
