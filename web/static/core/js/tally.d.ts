// Types for tally.js, the streak tally shared by the website and the app.

export type MarkState = 'met' | 'kept' | 'today' | 'frozen' | 'missed';
export type Mark = { day: string; state: MarkState; today: boolean };
export type GoalChange = [day: string, at: number, xp: number, id: string];

export type Timeline = {
  /** Days practised in the current streak (today counts once practised). */
  streak: number;
  /** Streak freezes held, each covering one missed day. */
  freezes: number;
  /** Today's daily goal, in XP. */
  goal: number;
  todayXp: number;
  todayMet: boolean;
  /** The current streak's days, oldest first, ending with today. */
  marks: Mark[];
  /** The day the last streak broke, while recent; drawn as one muted stick. */
  broken: string | null;
};

export type Size = { height: number; pitch: number; gap: number; stroke: number; strike: number; maxSticks: number; pad: number };
export type Layout = {
  width: number;
  height: number;
  sticks: { x: number; y1: number; y2: number; state: MarkState; day: string; today: boolean }[];
  strikes: { x1: number; y1: number; x2: number; y2: number; day: string }[];
  bands: { x1: number; x2: number; y: number }[];
  /** Days in older bundles not drawn (shown as "+n"). */
  hidden: number;
  size: Size;
};

export const BUNDLE: number;
export const MAX_FREEZES: number;
export const DEFAULT_GOAL: number;
export const SIZES: { full: Size; compact: Size };
export const COLOURS: { stick: string; today: string; missed: string; frozen: string; strike: string; band: string };
export const MOTION: { strikeMs: number; strikeStaggerMs: number; popMs: number; glowMs: number; ease: [number, number, number, number] };
export function today(date?: Date): string;
export function addDays(day: string, n: number): string;
export function goalOn(goals: GoalChange[], day: string, fallback: number): number;
export function timeline(input: { days?: string[]; xp?: Record<string, number>; goals?: GoalChange[]; today?: string; defaultGoal?: number }): Timeline;
export function layout(model: Timeline, size: 'full' | 'compact'): Layout;
