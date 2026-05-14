export const DEFAULT_BARBELL_KG = 20;
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
export const DEFAULT_PLATES_LB = [45, 35, 25, 10, 5, 2.5];

export type PlateRow = { plate: number; count: number };

export function platesPerSide(
  totalWeight: number,
  barbell: number,
  available: number[]
): { perSide: PlateRow[]; remainder: number } {
  const target = Math.max(0, (totalWeight - barbell) / 2);
  const perSide: PlateRow[] = [];
  let remaining = target;
  const sorted = [...available].sort((a, b) => b - a);
  for (const p of sorted) {
    if (p <= 0) continue;
    let count = 0;
    while (remaining >= p - 1e-9) {
      remaining = +(remaining - p).toFixed(4);
      count += 1;
    }
    if (count > 0) perSide.push({ plate: p, count });
  }
  return { perSide, remainder: remaining };
}
