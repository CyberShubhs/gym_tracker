// Maps exercise IDs that were removed/renamed between template versions.
// Logged sets stay under their original keys (so import/export of old data
// stays byte-identical), but PR lookups, history views, and the exercise
// card all resolve a current id to its full alias group so historical logs
// continue to count.

export const EXERCISE_ALIASES: Record<string, string> = {
  // old id -> current id
  "wide-pullup": "wide-pulldown",
  "face-pull-2": "face-pull",
  "lateral-volume": "cable-lateral",
  "light-row": "seated-row",
  "arm-superset-curl": "ez-bar-curl",
  "arm-superset-pushdown": "rope-pushdown",
};

// Names for ids that are no longer present in any default template, used
// when rendering the history view so an old entry never shows a bare slug.
export const LEGACY_EXERCISE_NAMES: Record<string, string> = {
  "wide-pullup": "Wide-Grip Pull-up / Lat Pulldown",
  "face-pull-2": "Face Pull",
  "lateral-volume": "Lateral Raises (high volume)",
  "light-row": "Light Cable Row",
  "arm-superset-curl": "Arm Superset — Curl",
  "arm-superset-pushdown": "Arm Superset — Pushdown",
};

export function resolveExerciseId(id: string): string {
  return EXERCISE_ALIASES[id] ?? id;
}

// Every id that should be treated as the same exercise for lookups.
export function exerciseIdGroup(id: string): string[] {
  const canonical = resolveExerciseId(id);
  const all = new Set<string>([canonical]);
  for (const [oldId, newId] of Object.entries(EXERCISE_ALIASES)) {
    if (newId === canonical) all.add(oldId);
  }
  return Array.from(all);
}
