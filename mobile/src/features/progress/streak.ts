/** Days are the learner's own calendar days, YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function previousDay(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

/**
 * Days in a row with practice, ending today, or yesterday while today is still open: the streak only
 * breaks once a whole day passes without practice.
 */
export function currentStreak(days: string[], today = dayKey()) {
  const practised = new Set(days);
  let day = practised.has(today) ? today : previousDay(today);
  let streak = 0;
  while (practised.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}
