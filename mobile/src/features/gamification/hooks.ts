import * as tally from '@shared/tally';

import { useSyncState } from '@/core/sync/engine';
import { dayKey } from '@/features/progress/streak';

import { levelFor, totalXp } from './xp';

/**
 * Everything the game shows, from the synced progress: the streak tally (computed by the same code as on the
 * website, web/static/core/js/tally.js), XP, level and today's goal.
 */
export function useGame() {
  const { xp, days, goals } = useSyncState();
  const today = dayKey();
  const timeline = tally.timeline({ days, xp, goals, today });
  const total = totalXp(xp);
  return {
    tally: timeline,
    streak: timeline.streak,
    freezes: timeline.freezes,
    practisedToday: days.includes(today),
    totalXp: total,
    todayXp: timeline.todayXp,
    dailyGoal: timeline.goal,
    level: levelFor(total),
    days,
  };
}
