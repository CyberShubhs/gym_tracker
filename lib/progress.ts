import type { AppState, FoodLog, WorkoutLog } from "./types";
import { addDays } from "./utils";

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
