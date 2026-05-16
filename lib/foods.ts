export type FoodCategory =
  | "veg"
  | "fruit"
  | "egg"
  | "fat"
  | "protein"
  | "carb";

export type FoodUnit = "g" | "ml" | "piece";

export type FoodPreset = {
  id: string;
  name: string;
  emoji: string;
  unit: FoodUnit;
  defaultAmount: number;
  caloriesPer: number;
  proteinPer: number;
  // New macros (per unit). Optional for forward-compat with old serialized
  // overrides; treated as 0 when missing.
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
  category: FoodCategory;
  // Short citation for the macro numbers (e.g. "USDA FDC #171477"). Surfaced
  // in the food detail modal so users can sanity-check what's loaded.
  source?: string;
};

export type CustomFood = {
  id: string;
  name: string;
  emoji?: string;
  unit: FoodUnit;
  defaultAmount: number;
  caloriesPer: number;
  proteinPer: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
  source?: string;
};

export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  veg: "Veg",
  fruit: "Fruit",
  egg: "Eggs",
  fat: "Fats",
  protein: "Protein",
  carb: "Carbs",
};

export const CATEGORY_ORDER: FoodCategory[] = [
  "protein",
  "veg",
  "fruit",
  "carb",
  "fat",
];

// Macros per gram (or per piece for whole items). Reference numbers from
// USDA FoodData Central (FDC) and Indian Food Composition Tables (IFCT) for
// Indian-specific items. Sources are cited per-food so users can sanity-check
// the values via the food detail modal. Numbers are scaled to per-unit; UI
// rounds totals before display.
export const FOOD_PRESETS: FoodPreset[] = [
  // Veg (per gram)
  {
    id: "bell-red",
    name: "Bell pepper (red)",
    emoji: "🫑",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.31,
    proteinPer: 0.01,
    fiberPer: 0.021,
    carbsPer: 0.06,
    fatsPer: 0.003,
    category: "veg",
    source: "USDA FDC #170427 (red sweet pepper, raw)",
  },
  {
    id: "bell-green",
    name: "Bell pepper (green)",
    emoji: "🫑",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.2,
    proteinPer: 0.0086,
    fiberPer: 0.017,
    carbsPer: 0.047,
    fatsPer: 0.0017,
    category: "veg",
    source: "USDA FDC #170427 (green sweet pepper, raw)",
  },
  {
    id: "bell-yellow",
    name: "Bell pepper (yellow)",
    emoji: "🫑",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.27,
    proteinPer: 0.01,
    fiberPer: 0.009,
    carbsPer: 0.064,
    fatsPer: 0.0021,
    category: "veg",
    source: "USDA FDC #170427 (yellow sweet pepper, raw)",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    emoji: "🥒",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.15,
    proteinPer: 0.0065,
    fiberPer: 0.005,
    carbsPer: 0.036,
    fatsPer: 0.0011,
    category: "veg",
    source: "USDA FDC #168409 (cucumber with peel, raw)",
  },
  {
    id: "tomato",
    name: "Tomato",
    emoji: "🍅",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.18,
    proteinPer: 0.0088,
    fiberPer: 0.012,
    carbsPer: 0.039,
    fatsPer: 0.002,
    category: "veg",
    source: "USDA FDC #170457 (tomato, raw)",
  },
  {
    id: "broccoli",
    name: "Broccoli",
    emoji: "🥦",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.34,
    proteinPer: 0.0282,
    fiberPer: 0.026,
    carbsPer: 0.0664,
    fatsPer: 0.0037,
    category: "veg",
    source: "USDA FDC #170379 (broccoli, raw)",
  },
  {
    id: "spinach",
    name: "Spinach",
    emoji: "🥬",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.23,
    proteinPer: 0.0286,
    fiberPer: 0.022,
    carbsPer: 0.0363,
    fatsPer: 0.0039,
    category: "veg",
    source: "USDA FDC #168462 (spinach, raw)",
  },
  {
    id: "salad-mixed",
    name: "Mixed salad",
    emoji: "🥗",
    unit: "g",
    defaultAmount: 150,
    caloriesPer: 0.2,
    proteinPer: 0.012,
    fiberPer: 0.018,
    carbsPer: 0.035,
    fatsPer: 0.003,
    category: "veg",
    source: "Generic estimate, mixed greens + veg blend",
  },

  // Eggs (per gram — sizes vary too much to use pieces)
  {
    id: "egg-white",
    name: "Egg white",
    emoji: "🥚",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.52,
    proteinPer: 0.109,
    fiberPer: 0,
    carbsPer: 0.0073,
    fatsPer: 0.0017,
    category: "protein",
    source: "USDA FDC #748967 (egg white, raw, fresh)",
  },
  {
    id: "egg-yolk",
    name: "Egg yolk",
    emoji: "🟡",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 3.22,
    proteinPer: 0.1587,
    fiberPer: 0,
    carbsPer: 0.0364,
    fatsPer: 0.2654,
    category: "protein",
    source: "USDA FDC #172183 (egg yolk, raw, fresh)",
  },
  {
    id: "egg-whole",
    name: "Whole egg",
    emoji: "🥚",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 1.43,
    proteinPer: 0.1256,
    fiberPer: 0,
    carbsPer: 0.0072,
    fatsPer: 0.0951,
    category: "protein",
    source: "USDA FDC #748967 (whole egg, raw, fresh)",
  },

  // Fats (per gram)
  {
    id: "avocado",
    name: "Avocado",
    emoji: "🥑",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 1.6,
    proteinPer: 0.02,
    fiberPer: 0.067,
    carbsPer: 0.0853,
    fatsPer: 0.1466,
    category: "fat",
    source: "USDA FDC #171705 (avocado, raw, all varieties)",
  },
  {
    id: "almonds",
    name: "Almonds",
    emoji: "🌰",
    unit: "g",
    defaultAmount: 30,
    caloriesPer: 5.79,
    proteinPer: 0.2115,
    fiberPer: 0.125,
    carbsPer: 0.2161,
    fatsPer: 0.4993,
    category: "fat",
    source: "USDA FDC #170567 (almonds, raw)",
  },
  {
    id: "peanut-butter",
    name: "Peanut butter",
    emoji: "🥜",
    unit: "g",
    defaultAmount: 30,
    caloriesPer: 5.88,
    proteinPer: 0.2249,
    fiberPer: 0.06,
    carbsPer: 0.2189,
    fatsPer: 0.5036,
    category: "fat",
    source: "USDA FDC #172470 (peanut butter, smooth)",
  },
  {
    id: "olive-oil",
    name: "Olive oil",
    emoji: "🫒",
    unit: "ml",
    defaultAmount: 10,
    caloriesPer: 8.84,
    proteinPer: 0,
    fiberPer: 0,
    carbsPer: 0,
    fatsPer: 1,
    category: "fat",
    source: "USDA FDC #748608 (olive oil, ~0.92 g/ml density)",
  },

  // Fruits
  {
    id: "banana",
    name: "Banana (medium)",
    emoji: "🍌",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 105,
    proteinPer: 1.3,
    fiberPer: 3.1,
    carbsPer: 27,
    fatsPer: 0.4,
    category: "fruit",
    source: "USDA FDC #173944 (banana, raw, medium ~118 g)",
  },
  {
    id: "apple",
    name: "Apple (medium)",
    emoji: "🍎",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 95,
    proteinPer: 0.5,
    fiberPer: 4.4,
    carbsPer: 25,
    fatsPer: 0.3,
    category: "fruit",
    source: "USDA FDC #171688 (apple with skin, raw, medium ~182 g)",
  },
  {
    id: "orange",
    name: "Orange (medium)",
    emoji: "🍊",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 62,
    proteinPer: 1.2,
    fiberPer: 3.1,
    carbsPer: 15,
    fatsPer: 0.2,
    category: "fruit",
    source: "USDA FDC #169097 (orange, raw, medium ~131 g)",
  },
  {
    id: "mango",
    name: "Mango",
    emoji: "🥭",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.6,
    proteinPer: 0.0082,
    fiberPer: 0.016,
    carbsPer: 0.1498,
    fatsPer: 0.0038,
    category: "fruit",
    source: "USDA FDC #169910 (mango, raw)",
  },
  {
    id: "watermelon",
    name: "Watermelon",
    emoji: "🍉",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.3,
    proteinPer: 0.0061,
    fiberPer: 0.004,
    carbsPer: 0.0755,
    fatsPer: 0.0015,
    category: "fruit",
    source: "USDA FDC #167765 (watermelon, raw)",
  },
  {
    id: "strawberry",
    name: "Strawberries",
    emoji: "🍓",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.32,
    proteinPer: 0.0067,
    fiberPer: 0.02,
    carbsPer: 0.0768,
    fatsPer: 0.003,
    category: "fruit",
    source: "USDA FDC #167762 (strawberries, raw)",
  },
  {
    id: "pineapple",
    name: "Pineapple",
    emoji: "🍍",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.5,
    proteinPer: 0.0054,
    fiberPer: 0.014,
    carbsPer: 0.131,
    fatsPer: 0.0012,
    category: "fruit",
    source: "USDA FDC #169124 (pineapple, raw)",
  },

  // Protein
  {
    id: "chicken-breast",
    name: "Chicken breast (cooked)",
    emoji: "🍗",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 1.65,
    proteinPer: 0.31,
    fiberPer: 0,
    carbsPer: 0,
    fatsPer: 0.0357,
    category: "protein",
    source: "USDA FDC #171477 (chicken breast, roasted)",
  },
  {
    id: "fish-salmon",
    name: "Salmon (cooked)",
    emoji: "🐟",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 2.06,
    proteinPer: 0.2235,
    fiberPer: 0,
    carbsPer: 0,
    fatsPer: 0.1235,
    category: "protein",
    source: "USDA FDC #175168 (Atlantic salmon, cooked, dry heat)",
  },
  {
    id: "paneer",
    name: "Paneer",
    emoji: "🧀",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 2.96,
    proteinPer: 0.2486,
    fiberPer: 0,
    carbsPer: 0.062,
    fatsPer: 0.207,
    category: "protein",
    source: "IFCT 2017 (paneer, full-fat cow milk)",
  },
  {
    id: "greek-yogurt",
    name: "Greek yogurt (non-fat)",
    emoji: "🥣",
    unit: "g",
    defaultAmount: 150,
    caloriesPer: 0.59,
    proteinPer: 0.1019,
    fiberPer: 0,
    carbsPer: 0.0364,
    fatsPer: 0.0039,
    category: "protein",
    source: "USDA FDC #173304 (Greek yogurt, plain, non-fat)",
  },
  {
    id: "milk",
    name: "Milk (full cream)",
    emoji: "🥛",
    unit: "ml",
    defaultAmount: 200,
    caloriesPer: 0.61,
    proteinPer: 0.032,
    fiberPer: 0,
    carbsPer: 0.048,
    fatsPer: 0.0333,
    category: "protein",
    source: "USDA FDC #171265 (whole milk, 3.25 % fat) · ~1.03 g/ml",
  },
  {
    id: "whey",
    name: "Whey protein scoop",
    emoji: "💪",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 120,
    proteinPer: 24,
    fiberPer: 0.5,
    carbsPer: 3,
    fatsPer: 1.5,
    category: "protein",
    source: "Generic isolate/concentrate label (~30 g scoop)",
  },
  {
    id: "tofu",
    name: "Tofu (firm)",
    emoji: "🧈",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.76,
    proteinPer: 0.0808,
    fiberPer: 0.009,
    carbsPer: 0.0188,
    fatsPer: 0.0478,
    category: "protein",
    source: "USDA FDC #172476 (tofu, firm, prepared with calcium sulfate)",
  },

  // Carbs
  {
    id: "rice-cooked",
    name: "Rice (cooked, white)",
    emoji: "🍚",
    unit: "g",
    defaultAmount: 150,
    caloriesPer: 1.3,
    proteinPer: 0.0269,
    fiberPer: 0.004,
    carbsPer: 0.2817,
    fatsPer: 0.0028,
    category: "carb",
    source: "USDA FDC #169757 (rice, white, long-grain, cooked)",
  },
  {
    id: "oats-dry",
    name: "Oats (dry, rolled)",
    emoji: "🥣",
    unit: "g",
    defaultAmount: 40,
    caloriesPer: 3.79,
    proteinPer: 0.1369,
    fiberPer: 0.101,
    carbsPer: 0.6759,
    fatsPer: 0.0689,
    category: "carb",
    source: "USDA FDC #173904 (oats, raw)",
  },
  {
    id: "roti",
    name: "Roti / chapati (~40 g)",
    emoji: "🫓",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 120,
    proteinPer: 3.5,
    fiberPer: 2.0,
    carbsPer: 18,
    fatsPer: 3.0,
    category: "carb",
    source:
      "IFCT 2017 + typical home recipe (whole wheat flour ~40 g + a tsp oil)",
  },
  {
    id: "bread",
    name: "Bread slice (whole wheat)",
    emoji: "🍞",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 81,
    proteinPer: 4,
    fiberPer: 2,
    carbsPer: 13.8,
    fatsPer: 1.1,
    category: "carb",
    source: "USDA FDC #172684 (whole-wheat bread, commercial, ~30 g slice)",
  },

  // Drinks (no category target — these live under My foods via search)
];

export const UNIT_LABEL: Record<FoodUnit, string> = {
  g: "g",
  ml: "ml",
  piece: "pc",
};

export type MacroSource = {
  caloriesPer: number;
  proteinPer: number;
  fiberPer?: number;
  carbsPer?: number;
  fatsPer?: number;
};

export type Macros = {
  calories: number;
  protein: number;
  fiber: number;
  carbs: number;
  fats: number;
};

export function calcMacros(food: MacroSource, amount: number): Macros {
  return {
    calories: Math.round(food.caloriesPer * amount),
    protein: Math.round(food.proteinPer * amount * 10) / 10,
    fiber: Math.round((food.fiberPer ?? 0) * amount * 10) / 10,
    carbs: Math.round((food.carbsPer ?? 0) * amount * 10) / 10,
    fats: Math.round((food.fatsPer ?? 0) * amount * 10) / 10,
  };
}
