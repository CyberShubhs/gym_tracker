// Machine / cable-stack variants for exercise logging. Variants let users
// distinguish "same exercise, different machine" so PR charts and
// last-session lookups don't unfairly merge incompatible loads.
//
// Storage shape:
//   - Each SetEntry can carry `variant?: string`. Missing => "default".
//   - settings.activeVariantByExercise: exerciseId -> last picked variant.
//   - settings.customVariantsByExercise: exerciseId -> extra labels the
//     user added on top of the built-in list.

export type VariantOption = { id: string; label: string };

// Compact built-in list. Keep this short — long lists are friction.
export const BUILTIN_VARIANTS: VariantOption[] = [
  { id: "default", label: "Default" },
  { id: "technogym", label: "Technogym" },
  { id: "lifefitness", label: "Life Fitness" },
  { id: "hammer", label: "Hammer Strength" },
  { id: "cable-a", label: "Cable Stack A" },
  { id: "cable-b", label: "Cable Stack B" },
];

export function normalizeVariantId(v: string | undefined | null): string {
  const t = (v ?? "").trim().toLowerCase();
  return t.length === 0 ? "default" : t;
}

export function variantIdFromLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "-");
}

export function variantLabelFor(
  id: string,
  customLabels?: string[]
): string {
  const norm = normalizeVariantId(id);
  const builtin = BUILTIN_VARIANTS.find((v) => v.id === norm);
  if (builtin) return builtin.label;
  if (customLabels) {
    for (const label of customLabels) {
      if (variantIdFromLabel(label) === norm) return label;
    }
  }
  // Fall back to a humanised version of the slug.
  return norm
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function allVariantsFor(
  exerciseId: string,
  customMap?: Record<string, string[]>
): VariantOption[] {
  const custom = customMap?.[exerciseId] ?? [];
  const out: VariantOption[] = [...BUILTIN_VARIANTS];
  const seen = new Set(out.map((o) => o.id));
  for (const label of custom) {
    const id = variantIdFromLabel(label);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}
