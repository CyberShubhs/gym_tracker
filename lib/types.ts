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

export type TemplateExercise = {
  id: string;
  name: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  notes?: string;
  equipment?: Equipment;
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
};

export type WorkoutLog = {
  date: string;
  templateId: string;
  entries: Record<string, SetEntry[]>;
  recovery?: Recovery;
  didOptional?: boolean;
  completedRest?: boolean;
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
  | "carb";

export type CustomFood = {
  id: string;
  name: string;
  emoji?: string;
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
  // Bumped on every templates rewrite so existing user state migrates to
  // the new plan on next hydration without wiping logs.
  templatesVersion?: number;
  cycle?: string[];
  cycleAnchor?: string;
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

export type AppState = {
  settings: Settings;
  workoutLogs: Record<string, WorkoutLog>;
  foodLogs: Record<string, FoodLog>;
  weightLogs: Record<string, WeightLog>;
};
