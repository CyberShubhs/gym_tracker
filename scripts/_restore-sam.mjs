// One-off recovery for the `sam` profile. Restores from the user's
// 2026-06-07 export, but ONLY after:
//   1) saving the current live row to a local file (off-DB safety net),
//   2) snapshotting the current live row into a PROTECTED manual backup,
//   3) protecting every rich historical backup so nothing can be trimmed.
// Everything is scoped to user_id = 'sam'. No other profile is touched.
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";
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

const USER_ID = "sam";
const EXPORT_PATH =
  "/Users/shubham/.claude/uploads/ab6bd6f0-996a-4f4a-a164-ff97c916eb6f/e41f1913-gymtracker20260607.json";

const sql = neon(process.env.DATABASE_URL);

function counts(d) {
  return {
    workouts: Object.keys(d?.workoutLogs ?? {}).length,
    foods: Object.keys(d?.foodLogs ?? {}).length,
    weights: Object.keys(d?.weightLogs ?? {}).length,
  };
}
function looksLikeAppState(v) {
  return (
    v &&
    typeof v === "object" &&
    v.settings &&
    v.workoutLogs &&
    v.foodLogs &&
    v.weightLogs
  );
}

const exportState = JSON.parse(readFileSync(EXPORT_PATH, "utf8"));
if (!looksLikeAppState(exportState)) {
  throw new Error("Export does not look like a valid AppState — aborting.");
}
console.log("Export to restore:", counts(exportState));

// 1) Read + locally save the current live row.
const cur = await sql`SELECT data, updated_at FROM user_state WHERE user_id = ${USER_ID}`;
const currentData = cur[0]?.data ?? null;
console.log(
  "Current live row:",
  currentData ? counts(currentData) : "(none)",
  "updated_at:",
  cur[0]?.updated_at
);
const localPath = resolve(here, "_sam-current-before-restore.json");
writeFileSync(localPath, JSON.stringify(currentData ?? null, null, 2));
console.log("Saved current live row to", localPath);

// 2) Snapshot the current live row into a PROTECTED manual backup.
if (currentData) {
  await sql`
    INSERT INTO user_state_backups (user_id, kind, period_key, data, source, protected)
    VALUES (${USER_ID}, 'manual', ${"pre-recovery-" + new Date().toISOString()},
            ${JSON.stringify(currentData)}::jsonb, 'recovery:pre-restore-current', true)
    ON CONFLICT (user_id, kind, period_key) DO NOTHING`;
  console.log("Protected backup of current live row written.");
}

// 3) Protect every rich historical backup (data > 20 KB column size).
const prot = await sql`
  UPDATE user_state_backups SET protected = true
  WHERE user_id = ${USER_ID} AND pg_column_size(data) > 20000
  RETURNING id`;
console.log("Protected rich historical backups:", prot.map((r) => r.id));

// 4) Store the export itself as a PROTECTED manual backup (recovery source).
await sql`
  INSERT INTO user_state_backups (user_id, kind, period_key, data, source, protected)
  VALUES (${USER_ID}, 'manual', 'recovery-export-2026-06-07',
          ${JSON.stringify(exportState)}::jsonb, 'recovery:export-2026-06-07', true)
  ON CONFLICT (user_id, kind, period_key) DO UPDATE SET
    data = EXCLUDED.data, source = EXCLUDED.source, protected = true, created_at = now()`;
console.log("Stored export as protected recovery backup.");

// 5) Restore: write the export to the live row, preserving any Apple Health
//    daily data already on the current row.
const restored = {
  ...exportState,
  appleHealthDaily: {
    ...(exportState.appleHealthDaily ?? {}),
    ...(currentData?.appleHealthDaily ?? {}),
  },
};
await sql`
  INSERT INTO user_state (user_id, data, updated_at)
  VALUES (${USER_ID}, ${JSON.stringify(restored)}, now())
  ON CONFLICT (user_id) DO UPDATE SET
    data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;

// 6) Verify.
const after = await sql`
  SELECT pg_column_size(data) AS bytes, updated_at,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'workoutLogs','{}'::jsonb))) AS workouts,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'foodLogs','{}'::jsonb))) AS foods,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'weightLogs','{}'::jsonb))) AS weights
  FROM user_state WHERE user_id = ${USER_ID}`;
console.log("\n=== RESTORED sam user_state ===");
console.log(JSON.stringify(after[0], null, 2));
