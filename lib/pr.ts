import type { AppState, SetEntry, TemplateExercise, WorkoutLog } from "./types";
import { exerciseIdGroup } from "./exercise-aliases";

export function epley1RM(set: SetEntry): number {
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0;
  if (set.reps <= 0) return 0;
  return set.weight * (1 + set.reps / 30);
}

function setVolume(s: SetEntry): number {
  return s.weight * s.reps;
}

// Best set in a list, ranked by estimated 1RM, then weight, then reps.
export function bestSet(sets: SetEntry[]): SetEntry | null {
  let best: SetEntry | null = null;
  for (const s of sets) {
    if (!best) {
      best = s;
      continue;
    }
    const a = epley1RM(s);
    const b = epley1RM(best);
    if (a > b) best = s;
    else if (a === b) {
      if (s.weight > best.weight) best = s;
      else if (s.weight === best.weight && s.reps > best.reps) best = s;
    }
  }
  return best;
}

export type SessionSummary = {
  date: string;
  sets: SetEntry[];
  totalSets: number;
  completedSets: number;
  totalReps: number;
  totalVolume: number;
  maxWeight: number;
  bestSet: SetEntry | null;
  best1RM: number;
  // Best reps achieved at any weight that was ever used previously (used
  // alongside per-weight tracking elsewhere).
  bestRepsAtMaxWeight: number;
};

function summarize(date: string, sets: SetEntry[]): SessionSummary {
  let totalReps = 0;
  let totalVolume = 0;
  let maxWeight = 0;
  let best1RM = 0;
  for (const s of sets) {
    totalReps += s.reps;
    totalVolume += setVolume(s);
    if (s.weight > maxWeight) maxWeight = s.weight;
    const e = epley1RM(s);
    if (e > best1RM) best1RM = e;
  }
  let bestRepsAtMaxWeight = 0;
  for (const s of sets) {
    if (s.weight === maxWeight && s.reps > bestRepsAtMaxWeight) {
      bestRepsAtMaxWeight = s.reps;
    }
  }
  return {
    date,
    sets,
    totalSets: sets.length,
    completedSets: sets.filter((s) => s.reps > 0).length,
    totalReps,
    totalVolume,
    maxWeight,
    bestSet: bestSet(sets),
    best1RM,
    bestRepsAtMaxWeight,
  };
}

// Reads all sessions for the given exercise across the alias group.
// Sessions are returned in chronological order.
export function exerciseHistory(
  state: AppState,
  exerciseId: string
): SessionSummary[] {
  const ids = exerciseIdGroup(exerciseId);
  const out: SessionSummary[] = [];
  const dates = Object.keys(state.workoutLogs).sort();
  for (const d of dates) {
    const entries = state.workoutLogs[d]?.entries;
    if (!entries) continue;
    const combined: SetEntry[] = [];
    for (const id of ids) {
      const sets = entries[id];
      if (sets && sets.length > 0) combined.push(...sets);
    }
    if (combined.length === 0) continue;
    out.push(summarize(d, combined));
  }
  return out;
}

export type AllTimeBests = {
  maxWeight: number;
  best1RM: number;
  bestVolume: number;
  bestRepsAtMaxWeight: number;
  // For every weight ever used, the best reps achieved at that weight.
  repsAtWeight: Map<number, number>;
};

export function allTimeBests(sessions: SessionSummary[]): AllTimeBests {
  const repsAtWeight = new Map<number, number>();
  let maxWeight = 0;
  let best1RM = 0;
  let bestVolume = 0;
  let bestRepsAtMaxWeight = 0;
  for (const s of sessions) {
    if (s.totalVolume > bestVolume) bestVolume = s.totalVolume;
    if (s.best1RM > best1RM) best1RM = s.best1RM;
    for (const set of s.sets) {
      if (set.weight > maxWeight) {
        maxWeight = set.weight;
        bestRepsAtMaxWeight = set.reps;
      } else if (set.weight === maxWeight && set.reps > bestRepsAtMaxWeight) {
        bestRepsAtMaxWeight = set.reps;
      }
      const prev = repsAtWeight.get(set.weight) ?? 0;
      if (set.reps > prev) repsAtWeight.set(set.weight, set.reps);
    }
  }
  return {
    maxWeight,
    best1RM,
    bestVolume,
    bestRepsAtMaxWeight,
    repsAtWeight,
  };
}

export type PRFlags = {
  isAnyPR: boolean;
  weightPR: boolean;
  repPR: boolean;
  e1rmPR: boolean;
  volumePR: boolean;
};

// Computes the cumulative bests across all sessions strictly BEFORE `date`,
// then compares the session on `date` against them.
export function sessionPRs(
  state: AppState,
  exerciseId: string,
  date: string
): {
  today: SessionSummary | null;
  previous: SessionSummary | null;
  flags: PRFlags;
  bestsBefore: AllTimeBests;
} {
  const history = exerciseHistory(state, exerciseId);
  const past = history.filter((s) => s.date < date);
  const todaySessions = history.filter((s) => s.date === date);
  const today = todaySessions[0] ?? null;
  const previous = past.length > 0 ? past[past.length - 1] : null;
  const bests = allTimeBests(past);
  const flags: PRFlags = {
    isAnyPR: false,
    weightPR: false,
    repPR: false,
    e1rmPR: false,
    volumePR: false,
  };
  if (today) {
    if (today.maxWeight > bests.maxWeight + 1e-6) flags.weightPR = true;
    if (today.best1RM > bests.best1RM + 1e-6) flags.e1rmPR = true;
    if (today.totalVolume > bests.bestVolume + 1e-6) flags.volumePR = true;
    // Rep PR at a previously used weight: any set today beat the previous
    // best reps at that exact weight.
    for (const set of today.sets) {
      const prev = bests.repsAtWeight.get(set.weight) ?? 0;
      if (prev > 0 && set.reps > prev) {
        flags.repPR = true;
        break;
      }
    }
    flags.isAnyPR =
      flags.weightPR || flags.repPR || flags.e1rmPR || flags.volumePR;
  }
  return { today, previous, flags, bestsBefore: bests };
}

// Legacy shape kept for any caller still importing checkPR — the new code
// uses sessionPRs directly. Returns `isPR` true on ANY PR type so existing
// PR badges still light up.
export function checkPR(
  state: AppState,
  exerciseId: string,
  date: string
): { isPR: boolean; previousBest: SetEntry | null; todayBest: SetEntry | null } {
  const { today, previous, flags } = sessionPRs(state, exerciseId, date);
  return {
    isPR: flags.isAnyPR,
    previousBest: previous?.bestSet ?? null,
    todayBest: today?.bestSet ?? null,
  };
}

export type ProgressionAdvice = {
  status: "ready" | "hold" | "incomplete" | "no-data";
  message: string;
  detail: string;
  hits: number; // sets that hit repsHigh
  needed: number; // total prescribed sets
};

// Recommends adding weight only when EVERY prescribed working set hit the
// top of the rep range. Mixed-rep exercises use the exercise's repsHigh.
// Optional exercises only count if the user did at least the prescribed
// number of sets.
export function progressionAdvice(
  exercise: Pick<TemplateExercise, "sets" | "repsHigh">,
  sets: SetEntry[] | undefined
): ProgressionAdvice {
  const needed = exercise.sets;
  const explainer =
    "Progression is based on completing all prescribed sets at the top of the rep range, not just one strong set.";
  if (!sets || sets.length === 0) {
    return {
      status: "no-data",
      message: "Log today's sets to get a recommendation.",
      detail: explainer,
      hits: 0,
      needed,
    };
  }
  if (sets.length < needed) {
    return {
      status: "incomplete",
      message: `Complete all ${needed} sets to get a recommendation.`,
      detail: explainer,
      hits: sets.filter((s) => s.reps >= exercise.repsHigh).length,
      needed,
    };
  }
  // Only the first `needed` sets are counted as prescribed; extra sets are
  // bonus work and don't gate progression.
  const prescribed = sets.slice(0, needed);
  const hits = prescribed.filter((s) => s.reps >= exercise.repsHigh).length;
  if (hits === needed) {
    return {
      status: "ready",
      message: "Ready to increase weight next time.",
      detail: explainer,
      hits,
      needed,
    };
  }
  return {
    status: "hold",
    message: `Keep the same weight until all ${needed} sets reach ${exercise.repsHigh} reps.`,
    detail: explainer,
    hits,
    needed,
  };
}

// Helper for callers that already have the workout log for a date.
export function progressionAdviceForLog(
  exercise: Pick<TemplateExercise, "id" | "sets" | "repsHigh">,
  log: WorkoutLog | undefined
): ProgressionAdvice {
  const sets = log?.entries[exercise.id];
  return progressionAdvice(exercise, sets);
}
