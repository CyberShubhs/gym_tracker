"use server";

import { cookies } from "next/headers";
import { getSql } from "./db";
import type { AppState } from "./types";
import { DEFAULT_SETTINGS } from "./defaults";
import {
  SESSION_COOKIE,
  hashPasscode,
  signSession,
  verifySession,
} from "./auth";
import { ensureSchema } from "./migrate";
import { pickMessage } from "./messages";
import {
  pushStatusCode,
  sendPush,
  type StoredSubscription,
} from "./push-server";

export type UserCard = {
  id: string;
  name: string;
  passcodeLength: number;
};

let seeded = false;

async function migrate() {
  await ensureSchema();
  if (seeded) return;
  const sql = getSql();

  const userCount = (await sql`
    SELECT COUNT(*)::int AS n FROM users
  `) as Array<{ n: number }>;

  if (userCount[0].n === 0) {
    const seedPw = (process.env.APP_PASSWORD ?? "865989").trim();
    await sql`
      INSERT INTO users (id, name, passcode_hash, passcode_length)
      VALUES ('sam', 'Sam', ${hashPasscode("sam", seedPw)}, ${seedPw.length})
    `;
    const oldRows = (await sql`
      SELECT data FROM app_state WHERE id = 'me'
    `) as Array<{ data: unknown }>;
    if (oldRows.length > 0) {
      await sql`
        INSERT INTO user_state (user_id, data)
        VALUES ('sam', ${JSON.stringify(oldRows[0].data)})
        ON CONFLICT DO NOTHING
      `;
    }
  }

  // One-shot: seed Sam's profile defaults if missing (info supplied by user)
  const samState = (await sql`
    SELECT data FROM user_state WHERE user_id = 'sam'
  `) as Array<{ data: { settings?: Record<string, unknown> } }>;
  if (samState.length > 0) {
    const settings = (samState[0].data?.settings ?? {}) as Record<
      string,
      unknown
    >;
    const needsSeed =
      !settings.dob || !settings.sex || !settings.lifestyleFactor;
    if (needsSeed) {
      const updated = {
        ...samState[0].data,
        settings: {
          ...settings,
          dob: settings.dob ?? "2004-08-23",
          sex: settings.sex ?? "male",
          lifestyleFactor: settings.lifestyleFactor ?? 1.31,
        },
      };
      await sql`
        UPDATE user_state SET data = ${JSON.stringify(updated)},
          updated_at = now()
        WHERE user_id = 'sam'
      `;
    }
  }

  seeded = true;
}

export async function listUsers(): Promise<UserCard[]> {
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, passcode_length FROM users ORDER BY created_at
  `) as Array<{ id: string; name: string; passcode_length: number }>;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    passcodeLength: r.passcode_length,
  }));
}

export async function loginUser(
  userId: string,
  passcode: string
): Promise<{ ok: boolean }> {
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT passcode_hash FROM users WHERE id = ${userId}
  `) as Array<{ passcode_hash: string }>;
  if (rows.length === 0) return { ok: false };
  if (rows[0].passcode_hash !== hashPasscode(userId, passcode.trim())) {
    return { ok: false };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true };
}

export async function createUser(
  name: string,
  passcode: string
): Promise<{ ok: boolean; error?: string; userId?: string }> {
  await migrate();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name required" };
  if (trimmed.length > 40) return { ok: false, error: "Name too long" };
  const code = passcode.trim();
  if (!/^\d{4,8}$/.test(code))
    return { ok: false, error: "Passcode must be 4–8 digits" };

  const baseId =
    trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user";

  const sql = getSql();
  let attemptId = baseId;
  for (let i = 1; i <= 50; i++) {
    const existing = (await sql`
      SELECT 1 FROM users WHERE id = ${attemptId} LIMIT 1
    `) as Array<unknown>;
    if (existing.length === 0) break;
    attemptId = `${baseId}-${i + 1}`;
    if (i === 50) return { ok: false, error: "Name unavailable" };
  }

  await sql`
    INSERT INTO users (id, name, passcode_hash, passcode_length)
    VALUES (${attemptId}, ${trimmed}, ${hashPasscode(attemptId, code)}, ${code.length})
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(attemptId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true, userId: attemptId };
}

export async function logout(): Promise<{ ok: true }> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return { ok: true };
}

async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  return verifySession(cookie);
}

export async function loadState(): Promise<AppState> {
  await migrate();
  const userId = await currentUserId();
  if (!userId) {
    return {
      settings: DEFAULT_SETTINGS,
      workoutLogs: {},
      foodLogs: {},
      weightLogs: {},
    };
  }
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;

  if (rows.length === 0) {
    return {
      settings: DEFAULT_SETTINGS,
      workoutLogs: {},
      foodLogs: {},
      weightLogs: {},
    };
  }
  const data = rows[0].data as Partial<AppState>;
  return {
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
    workoutLogs: data.workoutLogs ?? {},
    foodLogs: data.foodLogs ?? {},
    weightLogs: data.weightLogs ?? {},
  };
}

export async function saveState(state: AppState): Promise<{ ok: true }> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized");
  await migrate();
  const sql = getSql();
  await sql`
    INSERT INTO user_state (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(state)}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;
  return { ok: true };
}

export async function savePushSubscription(
  subscriptionJson: string
): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await migrate();
  let parsed: { endpoint?: string };
  try {
    parsed = JSON.parse(subscriptionJson) as { endpoint?: string };
  } catch {
    return { ok: false };
  }
  if (!parsed.endpoint) return { ok: false };
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (user_id, endpoint, subscription)
    VALUES (${userId}, ${parsed.endpoint}, ${subscriptionJson}::jsonb)
    ON CONFLICT (endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      subscription = EXCLUDED.subscription
  `;
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string
): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await migrate();
  const sql = getSql();
  await sql`
    DELETE FROM push_subscriptions
    WHERE user_id = ${userId} AND endpoint = ${endpoint}
  `;
  return { ok: true };
}

export async function hasPushSubscription(
  endpoint: string
): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT 1 FROM push_subscriptions
    WHERE user_id = ${userId} AND endpoint = ${endpoint}
    LIMIT 1
  `) as Array<unknown>;
  return rows.length > 0;
}

export async function sendTestPush(): Promise<{
  ok: boolean;
  error?: string;
  sent?: number;
}> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await ensureSchema();
  const sql = getSql();
  const subs = (await sql`
    SELECT subscription FROM push_subscriptions WHERE user_id = ${userId}
  `) as Array<{ subscription: StoredSubscription }>;
  if (subs.length === 0) {
    return {
      ok: false,
      error:
        "No active subscription. Toggle Hardcore mode off, then on again from inside the home-screen app.",
    };
  }

  let sent = 0;
  let lastError: string | undefined;
  for (const s of subs) {
    try {
      await sendPush(s.subscription, pickMessage(), "Gym Tracker · Test");
      sent += 1;
    } catch (err) {
      const code = pushStatusCode(err);
      const msg = err instanceof Error ? err.message : String(err);
      lastError = `${code ?? "?"}: ${msg}`;
    }
  }
  if (sent === 0) return { ok: false, error: lastError ?? "Push failed" };
  return { ok: true, sent };
}

export async function getCurrentUser(): Promise<UserCard | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, passcode_length FROM users WHERE id = ${userId}
  `) as Array<{ id: string; name: string; passcode_length: number }>;
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    name: rows[0].name,
    passcodeLength: rows[0].passcode_length,
  };
}
