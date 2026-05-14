import type { WorkoutTemplate } from "./types";

export const LEGS_TEMPLATE: WorkoutTemplate = {
  id: "legs-day",
  name: "Legs",
  category: "legs",
  focus: "Drive through heels. Full ROM beats heavy partials.",
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
      id: "leg-curl",
      name: "Leg Curl",
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
};
