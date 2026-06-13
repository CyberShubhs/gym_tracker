import type { AppState } from "./types";
import { LEGACY_EXERCISE_NAMES } from "./exercise-aliases";

// Spreadsheet-friendly export. One CSV, with a `record` column that flags
// each row as a workout set or a food entry, so a single file opens cleanly
// in Sheets/Excel and can be filtered by type. The full JSON export remains
// the lossless backup; this is for analysis.

const COLUMNS = [
  "record",
  "date",
  "time",
  "name",
  "variant",
  "set",
  "weight",
  "reps",
  "amount",
  "unit",
  "calories",
  "protein_g",
  "carbs_g",
  "fats_g",
  "fiber_g",
] as const;

function csvField(value: string | number | undefined | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Local 24h HH:MM from epoch ms — comma-free so it never breaks a CSV cell.
function hhmm(ts: number | undefined): string {
  if (typeof ts !== "number") return "";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

// Resolve the display name for an exercise id: the day's snapshot wins (so a
// since-renamed exercise still exports under the name it had), then live
// templates, then legacy aliases, then the raw id.
function buildNameResolver(state: AppState) {
  const live: Record<string, string> = { ...LEGACY_EXERCISE_NAMES };
  for (const t of state.settings.templates) {
    for (const e of t.exercises) live[e.id] = e.name;
  }
  for (const t of state.settings.legTemplates ?? []) {
    for (const e of t.exercises) live[e.id] = e.name;
  }
  return live;
}

export function buildCsv(state: AppState, weightUnit: string): string {
  const liveNames = buildNameResolver(state);
  const rows: string[] = [COLUMNS.join(",")];

  // Workout sets, oldest day first.
  for (const date of Object.keys(state.workoutLogs).sort()) {
    const log = state.workoutLogs[date];
    if (!log?.entries) continue;
    const snapNames: Record<string, string> = {};
    for (const e of log.templateSnapshot?.exercises ?? []) {
      snapNames[e.id] = e.name;
    }
    for (const [exId, sets] of Object.entries(log.entries)) {
      const name = snapNames[exId] ?? liveNames[exId] ?? exId;
      sets.forEach((s, i) => {
        rows.push(
          [
            "workout",
            date,
            hhmm(s.ts),
            name,
            s.variant ?? "",
            i + 1,
            s.weight,
            s.reps,
            "",
            weightUnit,
            "",
            "",
            "",
            "",
            "",
          ]
            .map(csvField)
            .join(",")
        );
      });
    }
  }

  // Food entries, oldest day first then by log time.
  for (const date of Object.keys(state.foodLogs).sort()) {
    const entries = state.foodLogs[date]?.entries;
    if (!entries) continue;
    for (const e of [...entries].sort((a, b) => a.ts - b.ts)) {
      rows.push(
        [
          "food",
          date,
          hhmm(e.ts),
          e.name,
          "",
          "",
          "",
          "",
          e.amount,
          e.unit,
          e.calories,
          e.proteinG,
          e.carbsG ?? 0,
          e.fatsG ?? 0,
          e.fiberG ?? 0,
        ]
          .map(csvField)
          .join(",")
      );
    }
  }

  return rows.join("\n");
}
