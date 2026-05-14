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

// Macros per gram (or per piece for whole items). For brevity, sources are
// USDA / standard nutrition databases. Numbers rounded to keep the file
// readable — log totals get rounded again at the UI layer.
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
    fatsPer: 0.002,
    category: "veg",
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
    fatsPer: 0.002,
    category: "veg",
  },
  {
    id: "cucumber",
    name: "Cucumber",
    emoji: "🥒",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.15,
    proteinPer: 0.007,
    fiberPer: 0.005,
    carbsPer: 0.036,
    fatsPer: 0.001,
    category: "veg",
  },
  {
    id: "tomato",
    name: "Tomato",
    emoji: "🍅",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.18,
    proteinPer: 0.009,
    fiberPer: 0.012,
    carbsPer: 0.039,
    fatsPer: 0.002,
    category: "veg",
  },
  {
    id: "broccoli",
    name: "Broccoli",
    emoji: "🥦",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.34,
    proteinPer: 0.028,
    fiberPer: 0.026,
    carbsPer: 0.067,
    fatsPer: 0.004,
    category: "veg",
  },
  {
    id: "spinach",
    name: "Spinach",
    emoji: "🥬",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.23,
    proteinPer: 0.029,
    fiberPer: 0.022,
    carbsPer: 0.036,
    fatsPer: 0.004,
    category: "veg",
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
    carbsPer: 0.007,
    fatsPer: 0.002,
    category: "protein",
  },
  {
    id: "egg-yolk",
    name: "Egg yolk",
    emoji: "🟡",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 3.22,
    proteinPer: 0.159,
    fiberPer: 0,
    carbsPer: 0.036,
    fatsPer: 0.267,
    category: "protein",
  },
  {
    id: "egg-whole",
    name: "Whole egg",
    emoji: "🥚",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 1.55,
    proteinPer: 0.126,
    fiberPer: 0,
    carbsPer: 0.011,
    fatsPer: 0.106,
    category: "protein",
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
    carbsPer: 0.085,
    fatsPer: 0.147,
    category: "fat",
  },
  {
    id: "almonds",
    name: "Almonds",
    emoji: "🌰",
    unit: "g",
    defaultAmount: 30,
    caloriesPer: 5.79,
    proteinPer: 0.21,
    fiberPer: 0.125,
    carbsPer: 0.216,
    fatsPer: 0.499,
    category: "fat",
  },
  {
    id: "peanut-butter",
    name: "Peanut butter",
    emoji: "🥜",
    unit: "g",
    defaultAmount: 30,
    caloriesPer: 5.88,
    proteinPer: 0.25,
    fiberPer: 0.06,
    carbsPer: 0.2,
    fatsPer: 0.5,
    category: "fat",
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
  },
  {
    id: "mango",
    name: "Mango",
    emoji: "🥭",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.6,
    proteinPer: 0.008,
    fiberPer: 0.016,
    carbsPer: 0.15,
    fatsPer: 0.004,
    category: "fruit",
  },
  {
    id: "watermelon",
    name: "Watermelon",
    emoji: "🍉",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.3,
    proteinPer: 0.006,
    fiberPer: 0.004,
    carbsPer: 0.076,
    fatsPer: 0.002,
    category: "fruit",
  },
  {
    id: "strawberry",
    name: "Strawberries",
    emoji: "🍓",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.32,
    proteinPer: 0.007,
    fiberPer: 0.02,
    carbsPer: 0.077,
    fatsPer: 0.003,
    category: "fruit",
  },
  {
    id: "pineapple",
    name: "Pineapple",
    emoji: "🍍",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.5,
    proteinPer: 0.005,
    fiberPer: 0.014,
    carbsPer: 0.131,
    fatsPer: 0.001,
    category: "fruit",
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
    fatsPer: 0.036,
    category: "protein",
  },
  {
    id: "fish-salmon",
    name: "Salmon (cooked)",
    emoji: "🐟",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 2.06,
    proteinPer: 0.22,
    fiberPer: 0,
    carbsPer: 0,
    fatsPer: 0.13,
    category: "protein",
  },
  {
    id: "paneer",
    name: "Paneer",
    emoji: "🧀",
    unit: "g",
    defaultAmount: 50,
    caloriesPer: 2.96,
    proteinPer: 0.25,
    fiberPer: 0,
    carbsPer: 0.062,
    fatsPer: 0.207,
    category: "protein",
  },
  {
    id: "greek-yogurt",
    name: "Greek yogurt",
    emoji: "🥣",
    unit: "g",
    defaultAmount: 150,
    caloriesPer: 0.59,
    proteinPer: 0.1,
    fiberPer: 0,
    carbsPer: 0.036,
    fatsPer: 0.004,
    category: "protein",
  },
  {
    id: "milk",
    name: "Milk (whole)",
    emoji: "🥛",
    unit: "ml",
    defaultAmount: 200,
    caloriesPer: 0.61,
    proteinPer: 0.032,
    fiberPer: 0,
    carbsPer: 0.048,
    fatsPer: 0.033,
    category: "protein",
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
  },
  {
    id: "tofu",
    name: "Tofu",
    emoji: "🧈",
    unit: "g",
    defaultAmount: 100,
    caloriesPer: 0.76,
    proteinPer: 0.08,
    fiberPer: 0.009,
    carbsPer: 0.019,
    fatsPer: 0.048,
    category: "protein",
  },

  // Carbs
  {
    id: "rice-cooked",
    name: "Rice (cooked)",
    emoji: "🍚",
    unit: "g",
    defaultAmount: 150,
    caloriesPer: 1.3,
    proteinPer: 0.027,
    fiberPer: 0.004,
    carbsPer: 0.28,
    fatsPer: 0.003,
    category: "carb",
  },
  {
    id: "oats-dry",
    name: "Oats (dry)",
    emoji: "🥣",
    unit: "g",
    defaultAmount: 40,
    caloriesPer: 3.89,
    proteinPer: 0.169,
    fiberPer: 0.106,
    carbsPer: 0.663,
    fatsPer: 0.069,
    category: "carb",
  },
  {
    id: "roti",
    name: "Roti / chapati",
    emoji: "🫓",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 100,
    proteinPer: 3.5,
    fiberPer: 2,
    carbsPer: 18,
    fatsPer: 2.5,
    category: "carb",
  },
  {
    id: "bread",
    name: "Bread slice",
    emoji: "🍞",
    unit: "piece",
    defaultAmount: 1,
    caloriesPer: 70,
    proteinPer: 3,
    fiberPer: 1.2,
    carbsPer: 13,
    fatsPer: 1,
    category: "carb",
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
