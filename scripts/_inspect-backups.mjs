// READ-ONLY inspection of user_state + user_state_backups. SELECT only.
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

const sql = neon(process.env.DATABASE_URL);

const live = await sql`
  SELECT user_id, pg_column_size(data) AS bytes, updated_at,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'workoutLogs','{}'::jsonb))) AS workouts,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'foodLogs','{}'::jsonb))) AS foods,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'weightLogs','{}'::jsonb))) AS weights
  FROM user_state ORDER BY user_id`;
console.log("=== LIVE user_state ===");
for (const r of live) {
  console.log(
    `  ${r.user_id}: bytes=${r.bytes} workouts=${r.workouts} foods=${r.foods} weights=${r.weights} updated_at=${new Date(r.updated_at).toISOString()}`
  );
}

const backups = await sql`
  SELECT id, user_id, kind, period_key, source, protected, created_at,
    pg_column_size(data) AS bytes,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'workoutLogs','{}'::jsonb))) AS workouts,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'foodLogs','{}'::jsonb))) AS foods,
    (SELECT count(*) FROM jsonb_object_keys(coalesce(data->'weightLogs','{}'::jsonb))) AS weights
  FROM user_state_backups
  ORDER BY user_id, created_at DESC`;
console.log(`\n=== BACKUPS (${backups.length} rows) ===`);
for (const r of backups) {
  console.log(
    `  [#${r.id}] ${r.user_id} ${r.kind}/${r.period_key} bytes=${r.bytes} W=${r.workouts} F=${r.foods} Wt=${r.weights} prot=${r.protected} src=${r.source} at=${new Date(r.created_at).toISOString()}`
  );
}
