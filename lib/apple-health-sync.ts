// Server-only helper. Reads DATABASE_URL and writes to user_state. Must
// never be imported from a client component or Server Component that ships
// data to the browser; only the API route at app/api/apple-health/sync
// should consume this module.
import { getSql } from "./db";
import { ensureSchema } from "./migrate";
import { BLANK_SETTINGS } from "./defaults";
import type {
  AppState,
  AppleHealthDailyEntry,
} from "./types";

export type AppleHealthSyncPayload = {
  profileName?: unknown;
  profileId?: unknown;
  date?: unknown;
  source?: unknown;
  steps?: unknown;
  activeEnergyKcal?: unknown;
};

export type AppleHealthSyncErrorCode =
  | "invalid_payload"
  | "profile_not_found"
  | "profile_ambiguous";

export class AppleHealthSyncError extends Error {
  readonly code: AppleHealthSyncErrorCode;
  constructor(code: AppleHealthSyncErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AppleHealthSyncError";
  }
}

export type AppleHealthSyncResult = {
  profileId: string;
  profileName: string;
  date: string;
  stored: { steps: number; activeEnergyKcal: number };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asNonNegativeFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null) return 0;
  const n = typeof value === "string" ? Number(value) : (value as number);
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return n;
}

function trimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function emptyProfileState(): AppState {
  return {
    settings: BLANK_SETTINGS,
    workoutLogs: {},
    foodLogs: {},
    weightLogs: {},
    appleHealthDaily: {},
  };
}

export async function syncAppleHealthDaily(
  payload: AppleHealthSyncPayload
): Promise<AppleHealthSyncResult> {
  // ---- Payload validation -------------------------------------------------
  const date = trimmedString(payload.date);
  if (!date || !DATE_RE.test(date)) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "date is required and must match yyyy-MM-dd"
    );
  }
  const steps = asNonNegativeFiniteNumber(payload.steps);
  if (steps === null) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "steps must be a finite non-negative number"
    );
  }
  const activeEnergyKcal = asNonNegativeFiniteNumber(payload.activeEnergyKcal);
  if (activeEnergyKcal === null) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "activeEnergyKcal must be a finite non-negative number"
    );
  }
  const sourceRaw = trimmedString(payload.source);
  const source = sourceRaw ?? "apple_shortcuts";

  const profileId = trimmedString(payload.profileId);
  const profileName = trimmedString(payload.profileName);
  if (!profileId && !profileName) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "profileId or profileName is required"
    );
  }

  // ---- Resolve target profile --------------------------------------------
  await ensureSchema();
  const sql = getSql();

  let matchedId: string | null = null;
  let matchedName: string | null = null;

  if (profileId) {
    const rows = (await sql`
      SELECT id, name FROM users WHERE id = ${profileId}
    `) as Array<{ id: string; name: string }>;
    if (rows.length === 0) {
      throw new AppleHealthSyncError(
        "profile_not_found",
        `No profile with id ${profileId}`
      );
    }
    matchedId = rows[0].id;
    matchedName = rows[0].name;
  } else if (profileName) {
    // Case-insensitive exact match — never a prefix or substring search,
    // so "Sam" can never match "Samantha". Ambiguity always yields 409.
    const rows = (await sql`
      SELECT id, name FROM users WHERE LOWER(name) = LOWER(${profileName})
    `) as Array<{ id: string; name: string }>;
    if (rows.length === 0) {
      throw new AppleHealthSyncError(
        "profile_not_found",
        `No profile with name ${profileName}`
      );
    }
    if (rows.length > 1) {
      throw new AppleHealthSyncError(
        "profile_ambiguous",
        `Multiple profiles match name ${profileName}; use profileId`
      );
    }
    matchedId = rows[0].id;
    matchedName = rows[0].name;
  }

  if (!matchedId || !matchedName) {
    // Defensive — earlier branches always assign both or throw.
    throw new AppleHealthSyncError(
      "profile_not_found",
      "Profile resolution failed"
    );
  }

  // ---- Load existing state for THIS profile only -------------------------
  const stateRows = (await sql`
    SELECT data FROM user_state WHERE user_id = ${matchedId}
  `) as Array<{ data: unknown }>;

  const existing: AppState =
    stateRows.length > 0 && stateRows[0].data && typeof stateRows[0].data === "object"
      ? ({ ...emptyProfileState(), ...(stateRows[0].data as Partial<AppState>) } as AppState)
      : emptyProfileState();

  // ---- Shallow merge — preserve every other top-level field -------------
  const entry: AppleHealthDailyEntry = {
    source,
    steps,
    activeEnergyKcal,
    syncedAt: new Date().toISOString(),
  };
  const nextDaily: Record<string, AppleHealthDailyEntry> = {
    ...(existing.appleHealthDaily ?? {}),
    [date]: entry,
  };
  const merged: AppState = {
    ...existing,
    appleHealthDaily: nextDaily,
  };

  // ---- Persist scoped strictly to matchedId ------------------------------
  await sql`
    INSERT INTO user_state (user_id, data, updated_at)
    VALUES (${matchedId}, ${JSON.stringify(merged)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;

  return {
    profileId: matchedId,
    profileName: matchedName,
    date,
    stored: { steps, activeEnergyKcal },
  };
}
