import type { AppState, FoodLog, WeightLog, WorkoutLog } from "./types";
import { addDays } from "./utils";

const DAY_MS = 86_400_000;

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export type WeightTrend = {
  // Smoothed series aligned to the input dates (a ±windowDays moving average
  // over actual weigh-ins, so noisy day-to-day swings don't hide the trend).
  ma: Array<{ date: string; value: number }>;
  // Average change per week across the smoothed series, or null if there
  // isn't enough spread to estimate.
  ratePerWeek: number | null;
};

// Date-windowed moving average (±windowDays) + weekly rate of change. Window
// is by calendar distance, not entry count, so irregular weigh-in cadence
// still smooths correctly.
export function weightTrend(
  logs: WeightLog[],
  windowDays = 3
): WeightTrend {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) return { ma: [], ratePerWeek: null };
  const ms = sorted.map((l) => isoToUtcMs(l.date));
  const ma = sorted.map((l, i) => {
    let sum = 0;
    let n = 0;
    for (let j = 0; j < sorted.length; j++) {
      if (Math.abs(ms[j] - ms[i]) <= windowDays * DAY_MS) {
        sum += sorted[j].weight;
        n += 1;
      }
    }
    return { date: l.date, value: sum / n };
  });
  const first = ma[0];
  const last = ma[ma.length - 1];
  const spanDays = (isoToUtcMs(last.date) - isoToUtcMs(first.date)) / DAY_MS;
  const ratePerWeek =
    spanDays >= 1 ? ((last.value - first.value) / spanDays) * 7 : null;
  return { ma, ratePerWeek };
}

export function workoutDone(log: WorkoutLog | undefined): boolean {
  if (!log) return false;
  if (log.completedRest) return true;
  return Object.values(log.entries).some((sets) => sets.length > 0);
}

export function foodDone(
  log: FoodLog | undefined,
  targets: { waterMl: number; proteinG: number; calories: number }
): boolean {
  if (!log) return false;
  return (
    log.waterMl >= targets.waterMl * 0.8 ||
    log.proteinG >= targets.proteinG * 0.8 ||
    log.calories > 0
  );
}

export function workoutStreak(state: AppState, today: string): number {
  let streak = 0;
  let cursor = today;
  // Don't penalize "today" if not yet logged — start counting from yesterday if today is empty
  if (!workoutDone(state.workoutLogs[cursor])) {
    cursor = addDays(cursor, -1);
  }
  while (workoutDone(state.workoutLogs[cursor])) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function foodStreak(state: AppState, today: string): number {
  let streak = 0;
  let cursor = today;
  const t = state.settings.targets;
  if (!foodDone(state.foodLogs[cursor], t)) {
    cursor = addDays(cursor, -1);
  }
  while (foodDone(state.foodLogs[cursor], t)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function lastNDayFlags(
  state: AppState,
  today: string,
  n: number,
  kind: "workout" | "food"
): boolean[] {
  const flags: boolean[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    if (kind === "workout") flags.push(workoutDone(state.workoutLogs[d]));
    else flags.push(foodDone(state.foodLogs[d], state.settings.targets));
  }
  return flags;
}

export function avgCaloriesLastN(
  state: AppState,
  date: string,
  n: number
): { avg: number | null; daysCounted: number } {
  let sum = 0;
  let days = 0;
  for (let i = 1; i <= n; i++) {
    const d = addDays(date, -i);
    const log = state.foodLogs[d];
    if (log && log.calories > 0) {
      sum += log.calories;
      days += 1;
    }
  }
  if (days === 0) return { avg: null, daysCounted: 0 };
  return { avg: Math.round(sum / days), daysCounted: days };
}

export function daysSinceLastWorkout(
  state: AppState,
  today: string
): number | null {
  // Walk backwards from today, return how many full days since the most
  // recent committed workout (any non-rest log with set entries).
  for (let i = 0; i <= 60; i++) {
    const d = addDays(today, -i);
    const log = state.workoutLogs[d];
    if (log && Object.keys(log.entries).length > 0) {
      return i;
    }
  }
  return null;
}

export function weightDelta(
  state: AppState,
  today: string,
  daysBack: number
): { current: number | null; past: number | null; delta: number | null } {
  const dates = Object.keys(state.weightLogs).sort();
  if (dates.length === 0) return { current: null, past: null, delta: null };

  const findOnOrBefore = (target: string): number | null => {
    let best: string | null = null;
    for (const d of dates) {
      if (d <= target) best = d;
      else break;
    }
    return best ? state.weightLogs[best].weight : null;
  };

  const current = findOnOrBefore(today);
  const past = findOnOrBefore(addDays(today, -daysBack));
  const delta = current !== null && past !== null ? current - past : null;
  return { current, past, delta };
}
