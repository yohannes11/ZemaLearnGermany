/**
 * The game's rules in one place. XP rewards effort and progress; levels grow a little further apart each
 * time, so early levels come quickly and later ones still feel earned.
 */

export const XP = {
  /** A word marked as known for the first time. */
  newWord: 10,
  /** A review card answered right / wrong (trying still counts a little). */
  reviewRight: 5,
  reviewWrong: 1,
  /** A quiz or listening question answered right. */
  answerRight: 10,
  /** Completing a lesson quiz (6 of 8 or better), and getting every question right. */
  lessonPassed: 25,
  perfect: 15,
} as const;

/** Daily goals the learner can pick, in XP per day. */
export const DAILY_GOALS = [
  { xp: 30, name: 'Casual', time: '5 min a day' },
  { xp: 50, name: 'Regular', time: '10 min a day' },
  { xp: 100, name: 'Serious', time: '15 min a day' },
  { xp: 150, name: 'Intense', time: '20 min a day' },
] as const;

/** XP needed to reach `level` (level 1 starts at 0): 100, 300, 600, 1000, … */
export function levelStart(level: number) {
  return 50 * level * (level - 1);
}

export function levelFor(totalXp: number) {
  let level = 1;
  while (levelStart(level + 1) <= totalXp) level += 1;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, intoLevel: totalXp - start, span: next - start, toNext: next - totalXp, share: (totalXp - start) / (next - start) };
}

export function totalXp(xp: Record<string, number>) {
  return Object.values(xp).reduce((sum, points) => sum + points, 0);
}
