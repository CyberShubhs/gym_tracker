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
  initialized = true;
}
