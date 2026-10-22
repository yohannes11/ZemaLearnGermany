/**
 * The API's data, as served by web/apps/api (version 1). The course shapes come from
 * web/tools/course_content.py; keep these in step when either changes.
 */

export type Word = { german: string; english: string; pic?: string[] };

export type Section = { key: string; title: string; words: Word[] };

export type Table = { head: string[]; rows: string[][]; say?: string[]; highlight?: number };

export type Block = {
  step?: string;
  title?: string;
  text?: string;
  table?: Table;
  /** [German, meaning] */
  examples?: [string, string][];
  /** Paragraphs of a reading text. */
  reading?: string[];
  /** [German, meaning] */
  glossary?: [string, string][];
};

type ItemBase = { prompt?: string; answer: string; hint?: string; say?: string; why?: string };

/** The item types with a list of options: about 85% of all quiz items. */
export type ChoiceItem =
  | (ItemBase & { type: 'choose' | 'listen'; options: string[]; show?: string })
  | (ItemBase & { type: 'gap'; before: string; after: string; options: string[]; listen?: boolean });

/** Word tiles put in order, or a typed answer (translation, dictation). */
export type OpenItem = ItemBase & { type: 'order' | 'write'; alts?: string[]; [field: string]: unknown };

export type QuizItem = ChoiceItem | OpenItem;

export type Lesson = {
  key: string;
  code: string;
  title: string;
  chapters: string[];
  intro?: string[];
  blocks?: Block[];
  rules?: string[][];
  quiz?: { title: string; items: QuizItem[] };
  /** A lesson the web course builds itself (unit tests, the present-tense trainer). */
  custom?: string;
};

export type Unit = {
  id: number;
  label?: string;
  title: string;
  lessonsLabel?: string;
  sections: Section[];
  grammar: Lesson[];
};

export type Course = { units: Unit[] };

export type CourseBundle = {
  /** Changes whenever the course, its Amharic or an admin's published text change does. */
  version: string;
  lang: 'en' | 'am';
  course: Course;
  amharic: { words: Record<string, string>; text: Record<string, string> } | null;
  /** Text admins changed on the site: wherever `key` would be shown, show the value instead. */
  texts: Record<string, string>;
};

export type ApiIndex = {
  api: number;
  minAppVersion: string;
  languages: Record<string, string>;
  audio: { base: string; manifest: string; voices: string[]; speeds: string[] };
  pictureBase: string;
};

/** German text -> clip id; clips are at <audio.base><voice>/<speed>/<id>.mp3 */
export type AudioManifest = Record<string, string>;

export type User = { id: number; username: string; email: string; name: string; role: 'learner' | 'admin' };

export type Source = { publisher: string; title: string; date: string; url: string };

/** Why learn German: the website's landing page figures, each with its official source. */
export type WhyGerman = {
  lang: 'en' | 'am';
  stats: { display: string; label: string; detail: string; source: Source }[];
  paths: {
    key: string;
    title: string;
    body: string;
    needs: string | null;
    image: { url: string; credit: string; width: number; height: number } | null;
    sources: Source[];
    /** Indexes into `stats` of the figures that back this reason. */
    stats: number[];
  }[];
};
