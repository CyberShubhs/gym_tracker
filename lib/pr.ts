import type {
  AppState,
  Equipment,
  LoadDirection,
  SetEntry,
  Settings,
  TemplateExercise,
  Unit,
  WorkoutLog,
} from "./types";
import { exerciseIdGroup, resolveExerciseId } from "./exercise-aliases";

// "normal" — higher weight is better (default). "assistance" — lower
// weight is better, because the logged value represents how much the
// machine is taking off you (assisted dips, assisted pulldown).
export type Direction = LoadDirection;

// Resolve the effective load direction for an exercise. Priority:
//   1) Settings-level override (`settings.exerciseLoadDirection[id]`) so a
//      user can flag any exercise as assistance-load without editing
//      templates. Also checked under the canonical alias id so it covers
//      the whole group (ez-bar-curl → barbell-curl, etc.).
//   2) The per-exercise `loadDirection` field on the template.
//   3) Variant string: "assist" => assistance; an explicit "weighted" /
//      "bodyweight" / "bw" variant pins the lift to normal even when the
//      exercise name says "Assisted".
//   4) Exercise name containing "assist" — so "Assisted Dips / Tricep
//      Dips" and "Lat Pulldown / Assisted Pull-up" behave as assistance
//      lifts out of the box, without the user having to tag a variant or
//      flip a setting first.
// Otherwise "normal" (higher weight = better).
export function loadDirectionFor(
  exerciseId: string,
  options?: {
    exercise?: Partial<Pick<TemplateExercise, "name" | "loadDirection">>;
    variant?: string;
    settings?: Pick<Settings, "exerciseLoadDirection">;
  }
): Direction {
  const map = options?.settings?.exerciseLoadDirection;
  const override =
    map?.[exerciseId] ?? map?.[resolveExerciseId(exerciseId)];
  if (override) return override;
  const fromTemplate = options?.exercise?.loadDirection;
  if (fromTemplate) return fromTemplate;
  const variant = (options?.variant ?? "").toLowerCase();
  if (variant.includes("assist")) return "assistance";
  if (/weighted|bodyweight|\bbw\b/.test(variant)) return "normal";
  const name = (options?.exercise?.name ?? "").toLowerCase();
  if (name.includes("assist")) return "assistance";
  return "normal";
}

export function epley1RM(set: SetEntry): number {
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return 0;
  if (set.reps <= 0) return 0;
  return set.weight * (1 + set.reps / 30);
}

function setVolume(s: SetEntry): number {
  return s.weight * s.reps;
}

// Best set in a list, ranked by estimated 1RM, then weight, then reps.
// For assistance-load exercises we invert the ranking — fewer kg of
// assistance is the real progress.
export function bestSet(
  sets: SetEntry[],
  direction: Direction = "normal"
): SetEntry | null {
  let best: SetEntry | null = null;
  const weightBetter = (a: number, b: number) =>
    direction === "assistance" ? a < b : a > b;
  // For assisted lifts, more reps at LESS assistance is what we want.
  // We score each set as (weight, reps) and pick the one where weight
  // beats the current best (per direction), tie-broken by reps.
  for (const s of sets) {
    if (!best) {
      best = s;
      continue;
    }
    if (weightBetter(s.weight, best.weight)) {
      best = s;
    } else if (s.weight === best.weight && s.reps > best.reps) {
      best = s;
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

function summarize(
  date: string,
  sets: SetEntry[],
  direction: Direction = "normal"
): SessionSummary {
  let totalReps = 0;
  let totalVolume = 0;
  // For "assistance", `maxWeight` is the BEST (lowest) assistance value
  // used in the session, not the literal numerical max — that's the
  // number the user thinks of as "the load I beat today".
  let maxWeight = direction === "assistance" ? Infinity : 0;
  let best1RM = 0;
  for (const s of sets) {
    totalReps += s.reps;
    totalVolume += setVolume(s);
    if (direction === "assistance") {
      if (s.weight < maxWeight) maxWeight = s.weight;
    } else if (s.weight > maxWeight) {
      maxWeight = s.weight;
    }
    const e = epley1RM(s);
    if (e > best1RM) best1RM = e;
  }
  if (!Number.isFinite(maxWeight)) maxWeight = 0;
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
    bestSet: bestSet(sets, direction),
    best1RM,
    bestRepsAtMaxWeight,
  };
}

// Normalise variant strings so missing/empty values group together as
// "default" for filtering and grouping.
export function normalizeVariant(v: string | undefined): string {
  const t = (v ?? "").trim().toLowerCase();
  return t.length === 0 ? "default" : t;
}

// Reads all sessions for the given exercise across the alias group.
// Sessions are returned in chronological order. When `variant` is supplied,
// only sets matching that variant are included (so PR/chart views compare
// like-for-like across the same machine).
export function exerciseHistory(
  state: AppState,
  exerciseId: string,
  variant?: string,
  direction: Direction = "normal"
): SessionSummary[] {
  const ids = exerciseIdGroup(exerciseId);
  const wantVariant = variant != null ? normalizeVariant(variant) : null;
  const out: SessionSummary[] = [];
  const dates = Object.keys(state.workoutLogs).sort();
  for (const d of dates) {
    const entries = state.workoutLogs[d]?.entries;
    if (!entries) continue;
    const combined: SetEntry[] = [];
    for (const id of ids) {
      const sets = entries[id];
      if (!sets || sets.length === 0) continue;
      for (const s of sets) {
        if (wantVariant == null || normalizeVariant(s.variant) === wantVariant) {
          combined.push(s);
        }
      }
    }
    if (combined.length === 0) continue;
    out.push(summarize(d, combined, direction));
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

export function allTimeBests(
  sessions: SessionSummary[],
  direction: Direction = "normal"
): AllTimeBests {
  const repsAtWeight = new Map<number, number>();
  // `maxWeight` semantically means "the best weight ever lifted". For
  // assistance loads the best is the LOWEST weight (least machine help).
  let maxWeight = direction === "assistance" ? Infinity : 0;
  let best1RM = 0;
  let bestVolume = 0;
  let bestRepsAtMaxWeight = 0;
  const isBetterWeight = (a: number, b: number) =>
    direction === "assistance" ? a < b : a > b;
  for (const s of sessions) {
    if (s.totalVolume > bestVolume) bestVolume = s.totalVolume;
    if (s.best1RM > best1RM) best1RM = s.best1RM;
    for (const set of s.sets) {
      if (isBetterWeight(set.weight, maxWeight)) {
        maxWeight = set.weight;
        bestRepsAtMaxWeight = set.reps;
      } else if (set.weight === maxWeight && set.reps > bestRepsAtMaxWeight) {
        bestRepsAtMaxWeight = set.reps;
      }
      const prev = repsAtWeight.get(set.weight) ?? 0;
      if (set.reps > prev) repsAtWeight.set(set.weight, set.reps);
    }
  }
  if (!Number.isFinite(maxWeight)) maxWeight = 0;
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
// then compares the session on `date` against them. When `variant` is
// supplied, the comparison is scoped to that variant so swapping machines
// doesn't blank out hard-earned PRs. `direction` flips the weight PR
// comparison for assistance-load exercises so lowering assistance counts
// as progress.
export function sessionPRs(
  state: AppState,
  exerciseId: string,
  date: string,
  variant?: string,
  direction: Direction = "normal"
): {
  today: SessionSummary | null;
  previous: SessionSummary | null;
  flags: PRFlags;
  bestsBefore: AllTimeBests;
} {
  const history = exerciseHistory(state, exerciseId, variant, direction);
  const past = history.filter((s) => s.date < date);
  const todaySessions = history.filter((s) => s.date === date);
  const today = todaySessions[0] ?? null;
  const previous = past.length > 0 ? past[past.length - 1] : null;
  const bests = allTimeBests(past, direction);
  const flags: PRFlags = {
    isAnyPR: false,
    weightPR: false,
    repPR: false,
    e1rmPR: false,
    volumePR: false,
  };
  if (today) {
    // Weight PR direction: assistance => lower than best is better.
    const beatsWeight =
      direction === "assistance"
        ? past.length > 0 && today.maxWeight < bests.maxWeight - 1e-6
        : today.maxWeight > bests.maxWeight + 1e-6;
    if (beatsWeight) flags.weightPR = true;
    // e1RM and volume both grow with raw weight, which for assistance
    // loads means MORE machine help — never celebrate that as a PR.
    if (direction !== "assistance") {
      if (today.best1RM > bests.best1RM + 1e-6) flags.e1rmPR = true;
      if (today.totalVolume > bests.bestVolume + 1e-6) flags.volumePR = true;
    }
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

// Smallest sensible load jump for the equipment, in the user's unit. Used
// to turn "ready to progress" into a concrete number.
function loadIncrement(equipment: Equipment | undefined, unit: Unit): number {
  if (unit === "lb") return 5;
  if (equipment === "dumbbell") return 2;
  if (equipment === "machine" || equipment === "cable") return 5;
  return 2.5;
}

// Concrete next-session load once every prescribed set hit the top of the
// rep range. Direction-aware: assistance lifts progress by REMOVING help,
// down to fully unassisted at 0.
export function nextLoadSuggestion(
  direction: Direction,
  equipment: Equipment | undefined,
  topWeight: number,
  unit: Unit
): { weight: number; label: string } | null {
  if (!Number.isFinite(topWeight) || topWeight < 0) return null;
  const inc = loadIncrement(equipment, unit);
  if (direction === "assistance") {
    if (topWeight <= 0) return null; // already unassisted
    const next = Math.max(0, Math.round((topWeight - inc) * 2) / 2);
    return {
      weight: next,
      label:
        next === 0
          ? "Try it unassisted next time."
          : `Try ${next} ${unit} assistance next time.`,
    };
  }
  const next = Math.round((topWeight + inc) * 2) / 2;
  return { weight: next, label: `Try ${next} ${unit} next time.` };
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
