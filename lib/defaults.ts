import type { Category, Settings, WorkoutTemplate } from "./types";

export const CATEGORY_LABEL: Record<Category, string> = {
  push: "Push",
  pull: "Pull",
  upper: "Upper",
  legs: "Legs",
  rest: "Rest",
};

export const CATEGORY_ACCENT: Record<Category, string> = {
  push: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  pull: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  upper: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  legs: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rest: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "push-strength",
    name: "Push A — Strength",
    category: "push",
    focus:
      "Heavy push day. Prioritise progressive overload on pressing while keeping clean form.",
    exercises: [
      { id: "bench", name: "Barbell Bench Press", sets: 4, repsLow: 5, repsHigh: 8, equipment: "barbell" },
      { id: "incline-db", name: "Incline Dumbbell Press", sets: 3, repsLow: 8, repsHigh: 10, equipment: "dumbbell" },
      { id: "ohp", name: "Overhead Barbell Press", sets: 3, repsLow: 6, repsHigh: 8, equipment: "barbell" },
      { id: "cable-lateral", name: "Cable Lateral Raise", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "tricep-dips", name: "Assisted Dips / Tricep Dips", sets: 3, repsLow: 8, repsHigh: 12, equipment: "bodyweight" },
      { id: "rope-pushdown", name: "Rope Pushdowns", sets: 3, repsLow: 10, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "pull-strength",
    name: "Pull A — Strength",
    category: "pull",
    focus:
      "Heavy pull day. Strong back contraction, controlled rows, progressive overload.",
    exercises: [
      { id: "lat-pulldown", name: "Lat Pulldown / Assisted Pull-up", sets: 4, repsLow: 6, repsHigh: 10, equipment: "machine" },
      { id: "barbell-row", name: "Barbell Row", sets: 3, repsLow: 6, repsHigh: 10, equipment: "barbell" },
      { id: "seated-row", name: "Seated Cable Row", sets: 3, repsLow: 8, repsHigh: 12, equipment: "cable" },
      { id: "face-pull", name: "Face Pull", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "barbell-curl", name: "Barbell Curl", sets: 3, repsLow: 8, repsHigh: 10, equipment: "barbell" },
      { id: "hammer-curl", name: "Hammer Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "dumbbell" },
    ],
  },
  {
    id: "rest-light",
    name: "Rest / Physio / Walking",
    category: "rest",
    focus:
      "ACL physio, light walking, mobility, recovery. No extra upper-body lifting.",
    exercises: [],
  },
  {
    id: "push-hyper",
    name: "Push B — Hypertrophy",
    category: "push",
    focus:
      "Controlled reps, full range of motion, chest/shoulder/tricep volume.",
    exercises: [
      { id: "incline-bb", name: "Incline Barbell Press OR Machine Chest Press", sets: 4, repsLow: 8, repsHigh: 12, equipment: "barbell" },
      { id: "flat-db-press", name: "Flat Dumbbell Press", sets: 3, repsLow: 8, repsHigh: 12, equipment: "dumbbell" },
      { id: "db-shoulder-press", name: "Seated Dumbbell Shoulder Press", sets: 3, repsLow: 8, repsHigh: 10, equipment: "dumbbell" },
      { id: "lateral-slow", name: "Lateral Raise — Slow Tempo", sets: 4, repsLow: 12, repsHigh: 20, equipment: "dumbbell" },
      { id: "oh-tricep-ext", name: "Overhead Tricep Extension", sets: 3, repsLow: 10, repsHigh: 15, equipment: "dumbbell" },
      { id: "cable-pushdown", name: "Cable Pushdown", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "pull-width",
    name: "Pull B — Hypertrophy",
    category: "pull",
    focus: "Back width, rear delts, clean curls, controlled tempo.",
    exercises: [
      { id: "wide-pulldown", name: "Wide-Grip Lat Pulldown", sets: 4, repsLow: 8, repsHigh: 12, equipment: "machine" },
      { id: "chest-supported-row", name: "Chest-Supported Row", sets: 3, repsLow: 8, repsHigh: 12, equipment: "machine" },
      { id: "single-arm-row", name: "Single-Arm Dumbbell Row", sets: 3, repsLow: 10, repsHigh: 12, equipment: "dumbbell" },
      { id: "rear-delt", name: "Rear Delt Fly", sets: 3, repsLow: 12, repsHigh: 20, equipment: "cable" },
      { id: "preacher-curl", name: "Preacher Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "machine" },
      { id: "cable-curl", name: "Cable Curl", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "upper-pump",
    name: "Upper Pump — Chest, Shoulders, Arms",
    category: "upper",
    focus:
      "Pump-based upper-body session. Keep form clean and avoid over-fatiguing.",
    exercises: [
      { id: "chest-fly", name: "Cable Chest Fly", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "machine-press", name: "Machine Chest Press", sets: 3, repsLow: 10, repsHigh: 15, equipment: "machine" },
      { id: "cable-lateral", name: "Cable Lateral Raise", sets: 4, repsLow: 12, repsHigh: 20, equipment: "cable" },
      { id: "rear-delt-pump", name: "Rear Delt Fly / Face Pull", sets: 3, repsLow: 15, repsHigh: 20, equipment: "cable" },
      { id: "ez-bar-curl", name: "EZ Bar Curl / Barbell Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "barbell" },
      { id: "rope-pushdown", name: "Rope Pushdown", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "hammer-curl-optional", name: "Optional Hammer Curl", sets: 2, repsLow: 12, repsHigh: 15, equipment: "dumbbell", notes: "Optional — only if recovery is good." },
    ],
  },
  {
    id: "legs",
    name: "Legs",
    category: "legs",
    focus:
      "Lower body + core — quads, hamstrings, glutes, calves. The biggest muscles for shape, strength and calorie burn. (Uses your own leg templates if you've made any.)",
    exercises: [
      { id: "leg-press", name: "Leg Press", sets: 4, repsLow: 8, repsHigh: 12, equipment: "machine" },
      { id: "rdl", name: "Romanian Deadlift", sets: 3, repsLow: 8, repsHigh: 12, equipment: "barbell" },
      { id: "leg-curl", name: "Leg Curl", sets: 3, repsLow: 10, repsHigh: 15, equipment: "machine" },
      { id: "calf-raise", name: "Calf Raise", sets: 4, repsLow: 12, repsHigh: 20, equipment: "machine" },
      { id: "hanging-leg-raise", name: "Hanging Leg Raise", sets: 3, repsLow: 10, repsHigh: 15, equipment: "bodyweight" },
    ],
  },
  {
    id: "rest-full",
    name: "Full Rest",
    category: "rest",
    focus: "Complete rest. Sleep, eat, recover.",
    exercises: [],
  },
];

// Weekday the Legs day is scheduled on (Saturday). Replaces the old
// Saturday "upper-pump" so the week is Push / Pull / rest / Push / Pull /
// Legs / rest — a balanced split with a dedicated lower-body day.
export const LEG_DAY_DOW = 6;

export const DEFAULT_SCHEDULE: Record<number, string> = {
  0: "rest-full",
  1: "push-strength",
  2: "pull-strength",
  3: "rest-light",
  4: "push-hyper",
  5: "pull-width",
  6: "legs",
};

export const DEFAULT_TARGETS = {
  waterMl: 2500,
  proteinG: 150,
  calories: 2400,
  fiberG: 30,
  carbsG: 280,
  fatsG: 70,
};

// Bump whenever DEFAULT_TEMPLATES or DEFAULT_SCHEDULE changes meaningfully.
// Existing user state is migrated to the new plan on next hydration; their
// workout / food / weight logs are preserved unchanged.
//
// v4: added the dedicated Legs day (Saturday). Existing profiles get it via
// the ADDITIVE merge in the store (maybeAddLegDay) which preserves their
// templates, schedule and planning rather than resetting them.
export const TEMPLATES_VERSION = 4;

// One-time additive merge that inserts the Legs day into existing profiles
// without wiping any data. Bump only if the additive step itself changes.
export const LEG_DAY_MERGE_VERSION = 1;

// Independent version for the leg-template seed. Seeded only when missing
// AND the profile has no leg templates yet — deleting a default does NOT
// bring it back.
export const LEG_TEMPLATES_SEED_VERSION = 1;

export const DEFAULT_LEG_TEMPLATES: WorkoutTemplate[] = [
  {
    id: "legs-press-day",
    name: "Leg Press Day",
    category: "legs",
    focus:
      "Quad-led leg day. Drive through heels, full range of motion, controlled tempo.",
    exercises: [
      {
        id: "leg-press",
        name: "Leg Press",
        sets: 4,
        repsLow: 8,
        repsHigh: 12,
        equipment: "machine",
      },
      {
        id: "leg-extension",
        name: "Leg Extension",
        sets: 3,
        repsLow: 10,
        repsHigh: 15,
        equipment: "machine",
      },
      {
        id: "calf-raise",
        name: "Calf Raises",
        sets: 4,
        repsLow: 12,
        repsHigh: 20,
        equipment: "machine",
      },
    ],
  },
  {
    id: "legs-glute-squat-day",
    name: "Glute / Squat Day",
    category: "legs",
    focus:
      "Posterior chain focus. Brace hard, keep ribs down on thrusts and box squats.",
    exercises: [
      {
        id: "hip-thrust",
        name: "Hip Thrusts",
        sets: 4,
        repsLow: 8,
        repsHigh: 12,
        equipment: "barbell",
      },
      {
        id: "hip-adduction",
        name: "Hip Adduction",
        sets: 3,
        repsLow: 12,
        repsHigh: 20,
        equipment: "machine",
      },
      {
        id: "box-squat",
        name: "Barbell Box Squats",
        sets: 3,
        repsLow: 6,
        repsHigh: 10,
        equipment: "barbell",
      },
    ],
  },
];

// Canonical id → display name. Used at hydration time to defensively detect
// stale templates (e.g. from importing an old JSON export) even when
// templatesVersion looks current.
export const REQUIRED_TEMPLATE_NAMES: Record<string, string> = {
  "push-strength": "Push A — Strength",
  "pull-strength": "Pull A — Strength",
  "rest-light": "Rest / Physio / Walking",
  "push-hyper": "Push B — Hypertrophy",
  "pull-width": "Pull B — Hypertrophy",
  "upper-pump": "Upper Pump — Chest, Shoulders, Arms",
  "legs": "Legs",
  "rest-full": "Full Rest",
};

export const REQUIRED_SCHEDULE: Record<number, string> = {
  0: "rest-full",
  1: "push-strength",
  2: "pull-strength",
  3: "rest-light",
  4: "push-hyper",
  5: "pull-width",
  6: "legs",
};

// Old display names that should never be visible in the UI. Used by the
// validator to catch stale imports.
export const FORBIDDEN_TEMPLATE_NAMES = new Set<string>([
  "Push — Strength",
  "Pull — Strength",
  "Push — Hypertrophy",
  "Pull — Width & Detail",
  "Upper Hypertrophy (Optional)",
  "Upper Hypertrophy",
  "Rest / Light Walking",
]);

type ValidationIssue = { code: string; detail: string };

export function validateTemplates(
  templates: WorkoutTemplate[],
  schedule: Record<number, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, WorkoutTemplate>();
  for (const t of templates) {
    if (seen.has(t.id)) {
      issues.push({
        code: "duplicate-id",
        detail: `Duplicate template id "${t.id}"`,
      });
      continue;
    }
    seen.set(t.id, t);
    if (FORBIDDEN_TEMPLATE_NAMES.has(t.name)) {
      issues.push({
        code: "forbidden-name",
        detail: `Template "${t.id}" still uses old name "${t.name}"`,
      });
    }
  }
  for (const [id, requiredName] of Object.entries(REQUIRED_TEMPLATE_NAMES)) {
    const t = seen.get(id);
    if (!t) {
      issues.push({
        code: "missing-template",
        detail: `Required template "${id}" missing`,
      });
      continue;
    }
    if (t.name !== requiredName) {
      issues.push({
        code: "wrong-name",
        detail: `Template "${id}" name "${t.name}" must be "${requiredName}"`,
      });
    }
  }
  for (let dow = 0; dow < 7; dow++) {
    const expected = REQUIRED_SCHEDULE[dow];
    if (schedule?.[dow] !== expected) {
      issues.push({
        code: "wrong-schedule",
        detail: `schedule[${dow}] is "${schedule?.[dow]}" — must be "${expected}"`,
      });
    }
  }
  return issues;
}

export function needsTemplateMigration(
  templates: WorkoutTemplate[] | undefined,
  schedule: Record<number, string> | undefined,
  version: number | undefined,
  userTemplatesSeededVersion?: number
): boolean {
  // A profile that has explicitly been seeded — including the brand-new
  // empty seed — is *intentional*. Never auto-overwrite its templates
  // even when the templates array is empty.
  if (
    (userTemplatesSeededVersion ?? 0) >= TEMPLATES_VERSION &&
    Array.isArray(templates) &&
    schedule
  ) {
    return false;
  }
  if ((version ?? 0) < TEMPLATES_VERSION) return true;
  if (!templates || !schedule) return true;
  return validateTemplates(templates, schedule).length > 0;
}

export const DEFAULT_SETTINGS: Settings = {
  unit: "kg",
  heightCm: 183,
  targets: DEFAULT_TARGETS,
  schedule: DEFAULT_SCHEDULE,
  templates: DEFAULT_TEMPLATES,
  // Fresh profiles get the two starter leg templates. We do NOT preset
  // `legTemplatesSeededVersion` here — the store's maybeSeedLegTemplates
  // sets it after the seed runs. Keeping the marker out of DEFAULT_SETTINGS
  // ensures that profiles that were saved with `legTemplates: []` (older
  // builds, manual edits) still get seeded on their next load.
  legTemplates: DEFAULT_LEG_TEMPLATES,
  templatesVersion: TEMPLATES_VERSION,
  goalWeightKg: 85,
};

// A brand-new profile starts here. No upper templates, no leg templates,
// empty weekday schedule, no copied custom foods / recipes / notes. The
// seed-version markers are set so neither maybeSeedLegTemplates nor
// needsTemplateMigration will re-fill anything behind the user's back —
// they are expected to build their own plan in Settings or click the
// starter button.
export const BLANK_SETTINGS: Settings = {
  unit: "kg",
  heightCm: 183,
  targets: DEFAULT_TARGETS,
  schedule: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" },
  templates: [],
  legTemplates: [],
  templatesVersion: TEMPLATES_VERSION,
  legTemplatesSeededVersion: LEG_TEMPLATES_SEED_VERSION,
  userTemplatesSeededVersion: TEMPLATES_VERSION,
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
