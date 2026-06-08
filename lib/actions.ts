"use server";

import { cookies } from "next/headers";
import { getSql } from "./db";
import type { AppState, AppleHealthDailyEntry } from "./types";
import { BLANK_SETTINGS, DEFAULT_SETTINGS } from "./defaults";
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

// Non-httpOnly companion to SESSION_COOKIE so the client can namespace its
// localStorage cache by the active profile. Holds only the public user_id —
// authentication still lives in the signed httpOnly session cookie.
const ACTIVE_UID_COOKIE = "gt-uid";

function setActiveUidCookie(
  jar: Awaited<ReturnType<typeof cookies>>,
  userId: string
) {
  jar.set(ACTIVE_UID_COOKIE, userId, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
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
  setActiveUidCookie(jar, userId);
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

  // Write an explicit blank state row immediately. Two reasons:
  //   1) The first hydration sees a row that already has
  //      `userTemplatesSeededVersion: TEMPLATES_VERSION` and
  //      `templates: []`, so the client-side migrator leaves it alone
  //      instead of silently re-seeding default templates.
  //   2) Brand-new profiles can never accidentally render whatever was
  //      cached from a previous profile during the request → response gap.
  await sql`
    INSERT INTO user_state (user_id, data, updated_at)
    VALUES (${attemptId}, ${JSON.stringify(emptyAppState())}, now())
    ON CONFLICT (user_id) DO NOTHING
  `;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(attemptId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  setActiveUidCookie(jar, attemptId);
  return { ok: true, userId: attemptId };
}

export async function logout(): Promise<{ ok: true }> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(ACTIVE_UID_COOKIE);
  return { ok: true };
}

// Reset the active profile's data on the server. Other profiles are not
// touched; default templates remain available via the client-side
// `migrateSettings` / DEFAULT_TEMPLATES.
export async function resetCurrentProfile(): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await migrate();
  const sql = getSql();
  // Safeguard: snapshot the existing profile into a PROTECTED backup before
  // the destructive delete, so an accidental/unintended reset is always
  // recoverable from Settings → Backups.
  const existing = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (existing.length > 0 && looksLikeAppState(existing[0].data)) {
    try {
      await writeBackup(
        userId,
        existing[0].data as AppState,
        "manual",
        "auto:pre-reset-guard",
        `pre-reset-${new Date().toISOString()}`,
        true
      );
      await trimBackups(userId, "manual", 40);
    } catch {
      // Never let a backup hiccup block the user-requested reset.
    }
  }
  await sql`
    DELETE FROM user_state WHERE user_id = ${userId}
  `;
  return { ok: true };
}

async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const cookie = jar.get(SESSION_COOKIE)?.value;
  return verifySession(cookie);
}

export type LoadedState = {
  userId: string | null;
  state: AppState;
};

// Returned for users who have never saved any state — and for the brand-new
// row written during createUser(). New profiles intentionally start without
// upper or leg templates, schedule entries, custom foods, recipes, notes, or
// active variants. This is what guarantees fresh profiles do not silently
// inherit the previous profile's plan (or the global defaults).
function emptyAppState(): AppState {
  return {
    settings: BLANK_SETTINGS,
    workoutLogs: {},
    foodLogs: {},
    weightLogs: {},
    appleHealthDaily: {},
  };
}

export async function loadState(): Promise<LoadedState> {
  await migrate();
  const userId = await currentUserId();
  if (!userId) {
    return { userId: null, state: emptyAppState() };
  }
  // Re-set the public uid cookie defensively in case it was cleared
  // (e.g. user cleared site data) so the client cache stays namespaced.
  const jar = await cookies();
  if (!jar.get(ACTIVE_UID_COOKIE)?.value) {
    setActiveUidCookie(jar, userId);
  }
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;

  if (rows.length === 0) {
    return { userId, state: emptyAppState() };
  }
  const data = rows[0].data as Partial<AppState>;
  return {
    userId,
    state: {
      settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
      workoutLogs: data.workoutLogs ?? {},
      foodLogs: data.foodLogs ?? {},
      weightLogs: data.weightLogs ?? {},
      // Preserve Apple Health daily snapshots if present; old rows without
      // this field load as an empty map.
      appleHealthDaily: data.appleHealthDaily ?? {},
    },
  };
}

// Read-only loader for the active profile's Apple Health daily snapshots.
// Strictly scoped to the signed-in session user — never touches other
// profiles, never writes, never migrates, never resets. Returns {} when
// nobody is signed in or the profile has no Apple Health data yet.
export async function loadAppleHealthDaily(): Promise<
  Record<string, AppleHealthDailyEntry>
> {
  const userId = await currentUserId();
  if (!userId) return {};
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (rows.length === 0) return {};
  const data = rows[0].data as Partial<AppState> | null;
  return data?.appleHealthDaily ?? {};
}

// Compute the calendar-day key (YYYY-MM-DD) for the daily backup bucket.
// We use UTC so the same wall-clock instant always lands in the same
// bucket — handy when the user travels.
function dailyKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// ISO-week key (YYYY-Www) for the weekly bucket. Different from the date
// string above so daily and weekly snapshots never collide.
function weeklyKey(now: Date = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // ISO 8601: Thursday in the target week decides the year+week.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Upsert a snapshot row. The (user_id, kind, period_key) unique index
// means re-saving on the same day overwrites the day's daily snapshot
// instead of producing 50 rows per day. For "manual" and "pre-restore"
// snapshots we use a timestamp so each one is preserved.
async function writeBackup(
  userId: string,
  state: AppState,
  kind: "daily" | "weekly" | "manual" | "pre-restore",
  source: string,
  periodKey?: string,
  protectedFlag = false
): Promise<void> {
  const sql = getSql();
  const key = periodKey ?? new Date().toISOString();
  // `protected` is only set on INSERT — the ON CONFLICT path deliberately
  // leaves it alone so re-saving a daily/weekly bucket never un-protects a
  // snapshot the user (or a safeguard) pinned.
  await sql`
    INSERT INTO user_state_backups (user_id, kind, period_key, data, source, protected)
    VALUES (${userId}, ${kind}, ${key}, ${JSON.stringify(state)}::jsonb, ${source}, ${protectedFlag})
    ON CONFLICT (user_id, kind, period_key) DO UPDATE SET
      data = EXCLUDED.data,
      source = EXCLUDED.source,
      created_at = now()
  `;
}

// Total number of logged days across the three histories — used by the
// data-loss safeguards to detect a sudden collapse to (near-)empty.
function countLogDays(state: Partial<AppState> | null | undefined): number {
  if (!state) return 0;
  return (
    Object.keys(state.workoutLogs ?? {}).length +
    Object.keys(state.foodLogs ?? {}).length +
    Object.keys(state.weightLogs ?? {}).length
  );
}

// Retention sweep — keep the last N unprotected snapshots per (user, kind).
// Protected snapshots are never auto-deleted so the user can pin a known
// good state and rely on it surviving the next 30 days of activity.
async function trimBackups(
  userId: string,
  kind: "daily" | "weekly" | "manual" | "pre-restore",
  keep: number
): Promise<void> {
  const sql = getSql();
  await sql`
    DELETE FROM user_state_backups
    WHERE id IN (
      SELECT id FROM user_state_backups
      WHERE user_id = ${userId} AND kind = ${kind} AND protected = false
      ORDER BY created_at DESC
      OFFSET ${keep}
    )
  `;
}

// Validate a backup blob loosely before letting it overwrite user state.
// We don't enforce a strict schema — just enough sanity to reject obvious
// garbage (e.g. accidental empty JSON imported from clipboard).
function looksLikeAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (!v.settings || typeof v.settings !== "object") return false;
  if (!v.workoutLogs || typeof v.workoutLogs !== "object") return false;
  if (!v.foodLogs || typeof v.foodLogs !== "object") return false;
  if (!v.weightLogs || typeof v.weightLogs !== "object") return false;
  return true;
}

export async function saveState(state: AppState): Promise<{ ok: true }> {
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized");
  await migrate();
  const sql = getSql();
  // Safeguard: if this save would collapse a substantial profile down to
  // (near-)empty, snapshot the EXISTING row into a PROTECTED backup first.
  // The save still proceeds — we never block a legitimate edit — but the
  // pre-collapse state is always recoverable. This is the defence the
  // earlier silent wipe lacked.
  const incomingLogDays = countLogDays(state);
  const existingRows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (existingRows.length > 0 && looksLikeAppState(existingRows[0].data)) {
    const prev = existingRows[0].data as AppState;
    const prevLogDays = countLogDays(prev);
    if (prevLogDays >= 10 && incomingLogDays < prevLogDays / 2) {
      try {
        await writeBackup(
          userId,
          prev,
          "manual",
          "auto:pre-shrink-guard",
          `pre-shrink-${new Date().toISOString()}`,
          true
        );
        await trimBackups(userId, "manual", 40);
      } catch {
        // Best-effort — must never block the user's save.
      }
    }
  }
  await sql`
    INSERT INTO user_state (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(state)}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;
  // Snapshot-on-save: the daily/weekly snapshot for THIS user is upserted
  // on every save. The ON CONFLICT path means we only ever have one row
  // per (user, kind, period_key) — saving 200 times today produces 1
  // daily backup, not 200. This deliberately doesn't depend on cron or a
  // browser being open at midnight.
  try {
    const now = new Date();
    await writeBackup(userId, state, "daily", "auto:save", dailyKey(now));
    await writeBackup(
      userId,
      state,
      "weekly",
      "auto:save",
      weeklyKey(now)
    );
    await trimBackups(userId, "daily", 30);
    await trimBackups(userId, "weekly", 12);
    await trimBackups(userId, "manual", 20);
    await trimBackups(userId, "pre-restore", 10);
  } catch {
    // Backup failures must never block the primary save — the user_state
    // row is the source of truth and was already updated above.
  }
  return { ok: true };
}

export type BackupSummary = {
  id: number;
  kind: "daily" | "weekly" | "manual" | "pre-restore";
  periodKey: string;
  source: string | null;
  createdAt: string;
  protected: boolean;
  bytes: number;
  workoutDays: number;
  foodDays: number;
  weightDays: number;
};

function summarizeBackupRow(row: {
  id: number | string;
  kind: string;
  period_key: string;
  data: unknown;
  source: string | null;
  protected: boolean;
  created_at: Date | string;
}): BackupSummary {
  const serialized = JSON.stringify(row.data ?? {});
  const data = row.data as Partial<AppState> | null;
  return {
    id: Number(row.id),
    kind: row.kind as BackupSummary["kind"],
    periodKey: row.period_key,
    source: row.source ?? null,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    protected: !!row.protected,
    bytes: serialized.length,
    workoutDays: Object.keys(data?.workoutLogs ?? {}).length,
    foodDays: Object.keys(data?.foodLogs ?? {}).length,
    weightDays: Object.keys(data?.weightLogs ?? {}).length,
  };
}

export async function listBackups(): Promise<BackupSummary[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, kind, period_key, data, source, protected, created_at
    FROM user_state_backups
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 100
  `) as Array<{
    id: number | string;
    kind: string;
    period_key: string;
    data: unknown;
    source: string | null;
    protected: boolean;
    created_at: Date | string;
  }>;
  return rows.map(summarizeBackupRow);
}

export type BackupStatus = {
  lastSavedAt: string | null;
  lastDaily: BackupSummary | null;
  lastWeekly: BackupSummary | null;
  totalBackups: number;
};

export async function backupStatus(): Promise<BackupStatus> {
  const userId = await currentUserId();
  if (!userId) {
    return {
      lastSavedAt: null,
      lastDaily: null,
      lastWeekly: null,
      totalBackups: 0,
    };
  }
  await migrate();
  const sql = getSql();
  const stateRow = (await sql`
    SELECT updated_at FROM user_state WHERE user_id = ${userId}
  `) as Array<{ updated_at: Date | string }>;
  const daily = (await sql`
    SELECT id, kind, period_key, data, source, protected, created_at
    FROM user_state_backups
    WHERE user_id = ${userId} AND kind = 'daily'
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{
    id: number | string;
    kind: string;
    period_key: string;
    data: unknown;
    source: string | null;
    protected: boolean;
    created_at: Date | string;
  }>;
  const weekly = (await sql`
    SELECT id, kind, period_key, data, source, protected, created_at
    FROM user_state_backups
    WHERE user_id = ${userId} AND kind = 'weekly'
    ORDER BY created_at DESC LIMIT 1
  `) as typeof daily;
  const total = (await sql`
    SELECT COUNT(*)::int AS n FROM user_state_backups WHERE user_id = ${userId}
  `) as Array<{ n: number }>;
  const lastSavedAt = stateRow[0]
    ? typeof stateRow[0].updated_at === "string"
      ? stateRow[0].updated_at
      : stateRow[0].updated_at.toISOString()
    : null;
  return {
    lastSavedAt,
    lastDaily: daily[0] ? summarizeBackupRow(daily[0]) : null,
    lastWeekly: weekly[0] ? summarizeBackupRow(weekly[0]) : null,
    totalBackups: total[0]?.n ?? 0,
  };
}

export async function triggerManualBackup(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (rows.length === 0 || !looksLikeAppState(rows[0].data)) {
    return { ok: false, error: "No saved state to back up yet." };
  }
  await writeBackup(
    userId,
    rows[0].data as AppState,
    "manual",
    "manual:user"
  );
  await trimBackups(userId, "manual", 20);
  return { ok: true };
}

export async function downloadLatestBackup(): Promise<{
  ok: boolean;
  filename?: string;
  payload?: string;
  error?: string;
}> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await migrate();
  const sql = getSql();
  const rows = (await sql`
    SELECT data, created_at FROM user_state_backups
    WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 1
  `) as Array<{ data: unknown; created_at: Date | string }>;
  if (rows.length === 0) {
    // No backup row yet — fall back to the live state so the user can
    // still get a JSON download from this server action.
    const live = (await sql`
      SELECT data FROM user_state WHERE user_id = ${userId}
    `) as Array<{ data: unknown }>;
    if (live.length === 0) {
      return { ok: false, error: "Nothing to back up yet." };
    }
    return {
      ok: true,
      filename: `gym-tracker-${userId}-${dailyKey()}.json`,
      payload: JSON.stringify(live[0].data, null, 2),
    };
  }
  return {
    ok: true,
    filename: `gym-tracker-${userId}-${dailyKey()}.json`,
    payload: JSON.stringify(rows[0].data, null, 2),
  };
}

export async function restoreBackup(
  backupId: number
): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await migrate();
  const sql = getSql();
  // Critical: filter the restore lookup by user_id so a forged backupId
  // from another profile can never pull data into this account. The
  // server is the only authority here — the client cannot inject userId.
  const rows = (await sql`
    SELECT data FROM user_state_backups
    WHERE id = ${backupId} AND user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (rows.length === 0) {
    return { ok: false, error: "Backup not found for this profile." };
  }
  const blob = rows[0].data;
  if (!looksLikeAppState(blob)) {
    return { ok: false, error: "Backup is unreadable." };
  }
  // Snapshot the current state as a pre-restore safety net BEFORE we
  // overwrite — gives the user one-click rollback if they realize they
  // restored the wrong backup.
  const current = (await sql`
    SELECT data FROM user_state WHERE user_id = ${userId}
  `) as Array<{ data: unknown }>;
  if (current.length > 0 && looksLikeAppState(current[0].data)) {
    try {
      await writeBackup(
        userId,
        current[0].data as AppState,
        "pre-restore",
        `pre-restore:from-${backupId}`
      );
      await trimBackups(userId, "pre-restore", 10);
    } catch {
      // Pre-restore snapshot is best-effort; the requested restore still
      // proceeds because the user explicitly asked for it.
    }
  }
  await sql`
    INSERT INTO user_state (user_id, data, updated_at)
    VALUES (${userId}, ${JSON.stringify(blob)}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;
  return { ok: true };
}

export async function deleteBackup(
  backupId: number
): Promise<{ ok: boolean; error?: string }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not signed in" };
  await migrate();
  const sql = getSql();
  const result = (await sql`
    DELETE FROM user_state_backups
    WHERE id = ${backupId} AND user_id = ${userId} AND protected = false
    RETURNING id
  `) as Array<{ id: number }>;
  if (result.length === 0) {
    return { ok: false, error: "Backup is protected or not found." };
  }
  return { ok: true };
}

export async function setBackupProtected(
  backupId: number,
  isProtected: boolean
): Promise<{ ok: boolean }> {
  const userId = await currentUserId();
  if (!userId) return { ok: false };
  await migrate();
  const sql = getSql();
  await sql`
    UPDATE user_state_backups
    SET protected = ${isProtected}
    WHERE id = ${backupId} AND user_id = ${userId}
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
