import { getSql } from "./db";

let initialized = false;

export async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      passcode_hash TEXT NOT NULL,
      passcode_length INT NOT NULL DEFAULT 6,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Automated backup history. Every save can write a daily/weekly
  // snapshot here (snapshotForBackup in lib/actions.ts), plus explicit
  // manual + pre-restore snapshots. The (user_id, kind, period_key)
  // uniqueness lets us idempotently upsert the latest snapshot per
  // day/week without growing one row per save.
  await sql`
    CREATE TABLE IF NOT EXISTS user_state_backups (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      period_key TEXT NOT NULL,
      data JSONB NOT NULL,
      source TEXT,
      protected BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_state_backups_period_uniq
    ON user_state_backups (user_id, kind, period_key)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS user_state_backups_user_created_idx
    ON user_state_backups (user_id, created_at DESC)
  `;
  initialized = true;
}
