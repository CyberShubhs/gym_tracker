export type Category = "push" | "pull" | "upper" | "legs" | "rest";

export type Recovery = "good" | "okay" | "poor";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "physio"
  | "cardio";

export type LoadDirection = "normal" | "assistance";

export type TemplateExercise = {
  id: string;
  name: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  notes?: string;
  equipment?: Equipment;
  // "normal" (default) treats higher weight as progress.
  // "assistance" treats lower (assistance) weight as progress — for
  // assisted dips / pull-ups where the logged value represents how much
  // weight the machine takes off you.
  loadDirection?: LoadDirection;
};

export type WorkoutTemplate = {
  id: string;
  name: string;
  category: Category;
  focus?: string;
  optional?: boolean;
  exercises: TemplateExercise[];
};

export type SetEntry = {
  weight: number;
  reps: number;
  // Optional machine/cable-stack variant tag (e.g. "technogym",
  // "lifefitness", "cable-a"). Missing => "default". Used by PR/last-session
  // lookups so logs from different machines don't mix.
  variant?: string;
};

// Snapshot of the template and exercise definitions that were in effect when
// a workout log was first committed. Stored alongside the log so editing
// the template in Settings (rename, exercise add/remove, rep range tweak)
// never silently rewrites how an older session is displayed in History or
// reopened in Workout. Old logs without a snapshot fall back to current
// templates + LEGACY_EXERCISE_NAMES, preserving full backwards-compat.
export type WorkoutTemplateSnapshot = {
  id: string;
  name: string;
  category: Category;
  focus?: string;
  exercises: TemplateExercise[];
  // Filled when the snapshot is first written. Useful for forensics — not
  // surfaced in the UI.
  capturedAt?: string;
};

export type WorkoutLog = {
  date: string;
  templateId: string;
  entries: Record<string, SetEntry[]>;
  recovery?: Recovery;
  didOptional?: boolean;
  completedRest?: boolean;
  // Immutable snapshot — see WorkoutTemplateSnapshot above. Optional on read
  // so logs predating this field still load.
  templateSnapshot?: WorkoutTemplateSnapshot;
};

export type FoodEntrySource = "preset" | "custom" | "manual" | "recipe";

export type FoodEntry = {
  id: string;
  date: string;
  ts: number;
  source: FoodEntrySource;
  sourceFoodId?: string;
  name: string;
  emoji?: string;
  amount: number;
  unit: "g" | "ml" | "piece" | "kcal";
  calories: number;
  proteinG: number;
  // New macros — optional on read for backwards-compat. Defaults to 0 on
  // computation paths if missing on older saved entries.
  fiberG?: number;
  carbsG?: number;
  fatsG?: number;
};

export type FoodLog = {
  date: string;
  waterMl: number;
  proteinG: number;
  calories: number;
  fiberG?: number;
  carbsG?: number;
  fatsG?: number;
  entries?: FoodEntry[];
};

export type WeightLog = {
  date: string;
  weight: number;
  bodyFatPct?: number;
};

export type Unit = "kg" | "lb";

export type NutritionTargets = {
  waterMl: number;
  proteinG: number;
  calories: number;
  fiberG?: number;
  carbsG?: number;
  fatsG?: number;
};

export type FoodCategoryRef =
  | "veg"
  | "fruit"
  | "egg"
  | "fat"
  | "protein"
  | "carb"
  | "dairy"
  | "sauce";

export type CustomFood = {
  id: string;
  name: string;
  emoji?: string;
  // Optional locally-stored icon image (a small, square, compressed data
  // URL) used in place of the emoji. Privacy-safe: produced entirely in the
  // browser and persisted inside settings.customFoods, so it round-trips
  // through JSON export/import with the rest of the profile. Kept small
  // (≈96px JPEG) so storage and load speed are unaffected.
  iconImageDataUrl?: string;
  unit: "g" | "ml" | "piece";
  defaultAmount: number;
  caloriesPer: number;
  proteinPer: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
  category?: FoodCategoryRef;
  source?: string;
};

export type Sex = "male" | "female";

export type FoodOverride = {
  name?: string;
  emoji?: string;
  unit?: "g" | "ml" | "piece";
  defaultAmount?: number;
  caloriesPer?: number;
  proteinPer?: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
};

// Reference to another saved food (preset or custom) consumed inside a recipe.
// Manual ingredients (no underlying food id) store macros directly.
export type RecipeIngredient = {
  // Stable id so React can key the row.
  id: string;
  // Optional pointer to a preset or custom food. Missing for "manual" rows.
  foodId?: string;
  // Snapshot fields — kept so recipes survive deletion of the source food.
  name: string;
  emoji?: string;
  unit: "g" | "ml" | "piece";
  amount: number;
  // Per-unit macros. For a manual ingredient, the "per" values are the same
  // as the absolute amounts divided by `amount`.
  caloriesPer: number;
  proteinPer: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
};

export type Recipe = {
  id: string;
  name: string;
  emoji?: string;
  ingredients: RecipeIngredient[];
};

export type Settings = {
  unit: Unit;
  heightCm: number;
  targets: NutritionTargets;
  schedule: Record<number, string>;
  templates: WorkoutTemplate[];
  // Leg-day templates live alongside (not inside) the upper-body templates
  // array so editing or selecting one cannot affect the other. Optional on
  // read for backwards-compatibility with profiles created before the
  // leg-templates feature shipped; the store defaults missing values to
  // an empty array so the user starts blank and builds their own.
  legTemplates?: WorkoutTemplate[];
  // Marks that the leg-template defaults have already been seeded for this
  // profile. The seed only runs when this flag is missing AND the user has
  // zero leg templates — so deleting a default doesn't bring it back.
  legTemplatesSeededVersion?: number;
  // Set to the current TEMPLATES_VERSION the moment a profile's
  // templates+schedule pass through migration successfully OR a brand-new
  // profile is created blank. While this is missing, the store treats the
  // state as legacy and may re-seed defaults. While this is >= the current
  // version, an intentional empty `templates: []` is left alone (so new
  // profiles do not get the default starter plan poured back in).
  userTemplatesSeededVersion?: number;
  // Per-exercise-id override for load direction. Takes precedence over
  // the per-template `exercise.loadDirection` so the user can flag an
  // exercise as assistance-load without editing the template.
  exerciseLoadDirection?: Record<string, LoadDirection>;
  // Per-exercise: which machine/equipment variant the user picked last,
  // applied to new sets. Default if missing.
  activeVariantByExercise?: Record<string, string>;
  // User-defined extra variants per exercise (on top of the built-in list).
  customVariantsByExercise?: Record<string, string[]>;
  // Bumped on every templates rewrite so existing user state migrates to
  // the new plan on next hydration without wiping logs.
  templatesVersion?: number;
  cycle?: string[];
  cycleAnchor?: string;
  // Date-scoped history of (cycle, anchor) pairs. Each entry takes effect
  // for dates >= effectiveFrom and remains in effect until the next entry.
  // Picking a template on date D appends/overwrites the entry at D so
  // future planned dates shift, while dates before D continue to resolve
  // against earlier entries — past planned days never silently change.
  cycleSegments?: Array<{
    effectiveFrom: string;
    cycle: string[];
    anchor: string;
    createdAt?: string;
  }>;
  customFoods?: CustomFood[];
  foodOverrides?: Record<string, FoodOverride>;
  recipes?: Recipe[];
  exerciseNotes?: Record<string, string>;
  maintenanceCalories?: number;
  goalWeightKg?: number;
  dob?: string;
  sex?: Sex;
  lifestyleFactor?: number;
};

export type AppleHealthDailyEntry = {
  source: "apple_shortcuts" | string;
  steps: number;
  activeEnergyKcal: number;
  syncedAt: string;
};

export type AppState = {
  settings: Settings;
  workoutLogs: Record<string, WorkoutLog>;
  foodLogs: Record<string, FoodLog>;
  weightLogs: Record<string, WeightLog>;
  // Apple Health daily snapshots, keyed by yyyy-MM-dd. Optional so older
  // profiles, exports, and backup blobs continue to load without migration.
  appleHealthDaily?: Record<string, AppleHealthDailyEntry>;
};
