/**
 * Progress sync rules: the same as the server's (web/apps/course/sync.py), so the app can show the result of its
 * own changes at once, offline too. Both are checked against web/apps/course/tests/sync_cases.json.
 *
 * - word, review, session: the latest change wins (by `at`, then by id).
 * - score: the best score is kept.
 * - xp: every operation adds its points once.
 * - days practised: every word, review, score and xp operation marks its `day`.
 * - goal: every change is kept, in time order (the streak tally judges each day by the goal in force then).
 *
 * No imports, so `node --test` can run rules.test.ts directly.
 */

export type Session = {
  kind: 'quiz' | 'cards' | 'listening';
  /** The lesson key (quiz), section key or "review" (cards). */
  ref: string;
  /** Item numbers of the lesson's quiz (quiz), or the German words (cards), in the order they are asked. */
  items: (number | string)[];
  answers: boolean[];
  position: number;
  done?: boolean;
  platform: 'web' | 'ios' | 'android';
  device: string;
};

type Base = { id: string; at: number; day: string };
export type Op = Base &
  (
    | { kind: 'word'; german: string; learned: boolean }
    | { kind: 'review'; german: string; box: number; due: string }
    | { kind: 'score'; lesson: string; score: number }
    | { kind: 'xp'; amount: number }
    | { kind: 'session'; session: Session | null }
    | { kind: 'goal'; xp: number }
  );

export type Review = { box: number; due: string; at?: number; id?: string };

export type SyncState = {
  revision: number;
  learned: string[];
  grammar: Record<string, number>;
  days: string[];
  xp: Record<string, number>;
  srs: Record<string, Review>;
  /** Daily goal changes, oldest first: [day, at, xp, id]. The goal in force on a day is the latest made on or before it. */
  goals: [string, number, number, string][];
  /** The open exercise, or null; `at`/`id` decide which change wins. */
  session: (Session & { at?: number; id?: string }) | null;
  /** When each word last changed here: [learned, at, id]. Not sent by the server; only for local ordering. */
  wordLog: Record<string, [boolean, number, string]>;
  /** A cleared session's stamp, so an older position can't bring it back. */
  sessionStamp?: [number, string];
};

export const emptyState = (): SyncState => ({ revision: 0, learned: [], grammar: {}, days: [], xp: {}, srs: {}, goals: [], session: null, wordLog: {} });

const PRACTICE = new Set(['word', 'review', 'score', 'xp']);

function newer(at: number, id: string, current: [number, string] | undefined) {
  if (!current) return true;
  return at !== current[0] ? at > current[0] : id > current[1];
}

/** `op` applied to `state`, as a new state (the input is not changed). */
export function apply(state: SyncState, op: Op): SyncState {
  const next: SyncState = { ...state };
  if (PRACTICE.has(op.kind) && !state.days.includes(op.day)) next.days = [...state.days, op.day].sort();

  switch (op.kind) {
    case 'word': {
      const log = state.wordLog[op.german];
      if (newer(op.at, op.id, log && [log[1], log[2]])) {
        next.wordLog = { ...state.wordLog, [op.german]: [op.learned, op.at, op.id] };
        const others = state.learned.filter(w => w !== op.german);
        next.learned = op.learned ? [...others, op.german] : others;
      }
      break;
    }
    case 'review': {
      const current = state.srs[op.german];
      if (newer(op.at, op.id, current && [current.at ?? 0, current.id ?? ''])) {
        next.srs = { ...state.srs, [op.german]: { box: op.box, due: op.due, at: op.at, id: op.id } };
      }
      break;
    }
    case 'score': {
      const best = state.grammar[op.lesson];
      if (best === undefined || op.score > best) next.grammar = { ...state.grammar, [op.lesson]: op.score };
      break;
    }
    case 'xp':
      next.xp = { ...state.xp, [op.day]: (state.xp[op.day] ?? 0) + op.amount };
      break;
    case 'goal':
      if (!state.goals.some(g => g[3] === op.id)) {
        next.goals = [...state.goals, [op.day, op.at, op.xp, op.id] as [string, number, number, string]].sort((a, b) =>
          a[1] !== b[1] ? a[1] - b[1] : a[3] < b[3] ? -1 : 1,
        );
      }
      break;
    case 'session': {
      const stamp: [number, string] | undefined = state.session?.at !== undefined ? [state.session.at, state.session.id ?? ''] : state.sessionStamp;
      if (newer(op.at, op.id, stamp)) {
        next.session = op.session ? { ...op.session, done: op.session.done ?? false, at: op.at, id: op.id } : null;
        next.sessionStamp = [op.at, op.id];
      }
      break;
    }
  }
  return next;
}

/** Operations applied in time order, each id once: what the server would arrive at. */
export function applyAll(state: SyncState, ops: Op[]): SyncState {
  const seen = new Set<string>();
  const unique = ops.filter(op => (seen.has(op.id) ? false : (seen.add(op.id), true)));
  return [...unique].sort((a, b) => (a.at !== b.at ? a.at - b.at : a.id < b.id ? -1 : 1)).reduce(apply, state);
}
