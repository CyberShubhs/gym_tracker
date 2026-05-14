import type { Sex } from "./types";

export function computeAge(
  dob: string | undefined,
  reference: string
): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [ry, rm, rd] = reference.split("-").map(Number);
  let age = ry - y;
  if (rm < m || (rm === m && rd < d)) age--;
  return age;
}

export function computeBmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  return (
    10 * weightKg +
    6.25 * heightCm -
    5 * age +
    (sex === "male" ? 5 : -161)
  );
}

export function computeMaintenance(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex,
  lifestyleFactor: number
): number {
  return Math.round(
    computeBmr(weightKg, heightCm, age, sex) * lifestyleFactor
  );
}

export const LIFESTYLE_OPTIONS: Array<{
  factor: number;
  label: string;
  hint: string;
}> = [
  { factor: 1.2, label: "Sedentary", hint: "desk + no exercise" },
  { factor: 1.31, label: "Desk + 5× lift", hint: "office job, 5 sessions/wk" },
  { factor: 1.375, label: "Light", hint: "1–3 sessions/wk" },
  { factor: 1.55, label: "Moderate", hint: "moderately active + lifts" },
  { factor: 1.725, label: "Very active", hint: "active + lifts daily" },
];
