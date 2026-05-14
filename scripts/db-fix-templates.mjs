// One-off: re-apply the canonical templates / schedule / templatesVersion
// to every user_state row without touching workout, food or weight logs.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(here, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let value = m[2];
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  if (!process.env[m[1]]) process.env[m[1]] = value;
}

const TEMPLATES_VERSION = 3;
const DEFAULT_TEMPLATES = [
  {
    id: "push-strength",
    name: "Push A — Strength",
    category: "push",
    focus:
      "Heavy push day. Prioritise progressive overload on pressing while keeping clean form.",
    exercises: [
      { id: "bench", name: "Barbell Bench Press", sets: 4, repsLow: 5, repsHigh: 8, equipment: "barbell" },
      { id: "incline-db", name: "Incline Dumbbell Press", sets: 3, repsLow: 8, repsHigh: 10, equipment: "dumbbell" },
      { id: "ohp", name: "Overhead Barbell Press", sets: 3, repsLow: 6, repsHigh: 8, equipment: "barbell" },
      { id: "cable-lateral", name: "Cable Lateral Raise", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "tricep-dips", name: "Assisted Dips / Tricep Dips", sets: 3, repsLow: 8, repsHigh: 12, equipment: "bodyweight" },
      { id: "rope-pushdown", name: "Rope Pushdowns", sets: 3, repsLow: 10, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "pull-strength",
    name: "Pull A — Strength",
    category: "pull",
    focus:
      "Heavy pull day. Strong back contraction, controlled rows, progressive overload.",
    exercises: [
      { id: "lat-pulldown", name: "Lat Pulldown / Assisted Pull-up", sets: 4, repsLow: 6, repsHigh: 10, equipment: "machine" },
      { id: "barbell-row", name: "Barbell Row", sets: 3, repsLow: 6, repsHigh: 10, equipment: "barbell" },
      { id: "seated-row", name: "Seated Cable Row", sets: 3, repsLow: 8, repsHigh: 12, equipment: "cable" },
      { id: "face-pull", name: "Face Pull", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "barbell-curl", name: "Barbell Curl", sets: 3, repsLow: 8, repsHigh: 10, equipment: "barbell" },
      { id: "hammer-curl", name: "Hammer Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "dumbbell" },
    ],
  },
  {
    id: "rest-light",
    name: "Rest / Physio / Walking",
    category: "rest",
    focus:
      "ACL physio, light walking, mobility, recovery. No extra upper-body lifting.",
    exercises: [],
  },
  {
    id: "push-hyper",
    name: "Push B — Hypertrophy",
    category: "push",
    focus:
      "Controlled reps, full range of motion, chest/shoulder/tricep volume.",
    exercises: [
      { id: "incline-bb", name: "Incline Barbell Press OR Machine Chest Press", sets: 4, repsLow: 8, repsHigh: 12, equipment: "barbell" },
      { id: "flat-db-press", name: "Flat Dumbbell Press", sets: 3, repsLow: 8, repsHigh: 12, equipment: "dumbbell" },
      { id: "db-shoulder-press", name: "Seated Dumbbell Shoulder Press", sets: 3, repsLow: 8, repsHigh: 10, equipment: "dumbbell" },
      { id: "lateral-slow", name: "Lateral Raise — Slow Tempo", sets: 4, repsLow: 12, repsHigh: 20, equipment: "dumbbell" },
      { id: "oh-tricep-ext", name: "Overhead Tricep Extension", sets: 3, repsLow: 10, repsHigh: 15, equipment: "dumbbell" },
      { id: "cable-pushdown", name: "Cable Pushdown", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "pull-width",
    name: "Pull B — Hypertrophy",
    category: "pull",
    focus: "Back width, rear delts, clean curls, controlled tempo.",
    exercises: [
      { id: "wide-pulldown", name: "Wide-Grip Lat Pulldown", sets: 4, repsLow: 8, repsHigh: 12, equipment: "machine" },
      { id: "chest-supported-row", name: "Chest-Supported Row", sets: 3, repsLow: 8, repsHigh: 12, equipment: "machine" },
      { id: "single-arm-row", name: "Single-Arm Dumbbell Row", sets: 3, repsLow: 10, repsHigh: 12, equipment: "dumbbell" },
      { id: "rear-delt", name: "Rear Delt Fly", sets: 3, repsLow: 12, repsHigh: 20, equipment: "cable" },
      { id: "preacher-curl", name: "Preacher Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "machine" },
      { id: "cable-curl", name: "Cable Curl", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
    ],
  },
  {
    id: "upper-pump",
    name: "Upper Pump — Chest, Shoulders, Arms",
    category: "upper",
    focus:
      "Pump-based upper-body session. Keep form clean and avoid over-fatiguing.",
    exercises: [
      { id: "chest-fly", name: "Cable Chest Fly", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "machine-press", name: "Machine Chest Press", sets: 3, repsLow: 10, repsHigh: 15, equipment: "machine" },
      { id: "cable-lateral", name: "Cable Lateral Raise", sets: 4, repsLow: 12, repsHigh: 20, equipment: "cable" },
      { id: "rear-delt-pump", name: "Rear Delt Fly / Face Pull", sets: 3, repsLow: 15, repsHigh: 20, equipment: "cable" },
      { id: "ez-bar-curl", name: "EZ Bar Curl / Barbell Curl", sets: 3, repsLow: 10, repsHigh: 12, equipment: "barbell" },
      { id: "rope-pushdown", name: "Rope Pushdown", sets: 3, repsLow: 12, repsHigh: 15, equipment: "cable" },
      { id: "hammer-curl-optional", name: "Optional Hammer Curl", sets: 2, repsLow: 12, repsHigh: 15, equipment: "dumbbell", notes: "Optional — only if recovery is good." },
    ],
  },
  {
    id: "rest-full",
    name: "Full Rest",
    category: "rest",
    focus: "Complete rest. Sleep, eat, recover.",
    exercises: [],
  },
];
const DEFAULT_SCHEDULE = {
  0: "rest-full",
  1: "push-strength",
  2: "pull-strength",
  3: "rest-light",
  4: "push-hyper",
  5: "pull-width",
  6: "upper-pump",
};

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT user_id, data FROM user_state`;
for (const row of rows) {
  const data = row.data;
  const oldNames = (data?.settings?.templates ?? []).map((t) => t.name);
  const next = {
    ...data,
    settings: {
      ...(data.settings ?? {}),
      templates: DEFAULT_TEMPLATES,
      schedule: DEFAULT_SCHEDULE,
      templatesVersion: TEMPLATES_VERSION,
      cycle: undefined,
      cycleAnchor: undefined,
    },
  };
  delete next.settings.cycle;
  delete next.settings.cycleAnchor;
  await sql`
    UPDATE user_state
       SET data = ${JSON.stringify(next)},
           updated_at = now()
     WHERE user_id = ${row.user_id}
  `;
  console.log(`updated ${row.user_id}: was [${oldNames.join(", ")}]`);
}
console.log("done");
