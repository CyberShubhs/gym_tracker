// Maps exercise IDs that were removed/renamed between template versions,
// AND ids that the user wants to be treated as the same lift (e.g. they
// use a curl bar one day and a straight bar the next). Logged sets stay
// under their original keys (so import/export of old data stays
// byte-identical), but PR lookups, history views, last-session and the
// exercise card all resolve a current id to its full alias group so a
// shared movement counts together no matter which template it lives in.

export const EXERCISE_ALIASES: Record<string, string> = {
  // old/related id -> canonical id
  "wide-pullup": "wide-pulldown",
  "face-pull-2": "face-pull",
  "lateral-volume": "cable-lateral",
  "light-row": "seated-row",
  "arm-superset-curl": "barbell-curl",
  "arm-superset-pushdown": "rope-pushdown",
  // EZ-bar curl and barbell curl are the same movement for progression
  // purposes — user lifts the same arms either way, so PR/last-session
  // history should accumulate. Logged sets stay under their original ids
  // (no data rewrite), only lookups are unified via the alias group.
  "ez-bar-curl": "barbell-curl",
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

// Follow the alias chain until we hit an id with no further mapping.
// The seen-set defends against the (unlikely) cycle.
export function resolveExerciseId(id: string): string {
  let cur = id;
  const seen = new Set<string>();
  while (EXERCISE_ALIASES[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = EXERCISE_ALIASES[cur];
  }
  return cur;
}

// Every id that should be treated as the same exercise for lookups.
// Uses transitive resolution so chains like
//   arm-superset-curl -> ez-bar-curl -> barbell-curl
// all land in the same group regardless of which id the caller passed in.
export function exerciseIdGroup(id: string): string[] {
  const canonical = resolveExerciseId(id);
  const all = new Set<string>([canonical]);
  for (const oldId of Object.keys(EXERCISE_ALIASES)) {
    if (resolveExerciseId(oldId) === canonical) all.add(oldId);
  }
  return Array.from(all);
}
