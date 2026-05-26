# Apple Health Shortcut Sync - Claude Implementation Instructions

Date: 2026-05-26, Australia/Melbourne.

Target live domain:

`https://gym-tracker-zeta-sable.vercel.app`

Target endpoint to implement:

`POST /api/apple-health/sync`

Full URL:

`https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync`

## Read First

Before editing code:

1. Read `AGENTS.md` and `CLAUDE.md`.
2. Read these local Next.js 16 docs because this repo is on Next.js `16.2.4` / React `19.2.4`:
   - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
   - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
   - `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`
3. Do not hardcode any token. A previous sync token was exposed. The user will rotate it separately in Vercel and in the iPhone Shortcut.
4. Never expose `APPLE_HEALTH_SYNC_TOKEN` to the frontend. Do not use a `NEXT_PUBLIC_` env var for this.
5. Do not reset profiles, wipe profiles, merge profiles, or run one-off recovery scripts.

## Codebase Findings

### Profile / User System

Relevant files:

- `app/select/page.tsx`
- `lib/actions.ts`
- `lib/auth.ts`
- `lib/store.tsx`
- `lib/uid-client.ts`
- `components/data-io.tsx`
- `components/backup-panel.tsx`

How profiles work:

- Profiles are rows in Neon table `users`.
- `users.id` is the profile id. It is generated from the display name slug in `createUser()`, with numeric suffixes if needed.
- `users.name` is the display name.
- Login uses `loginUser(userId, passcode)` and stores a signed httpOnly cookie `gym-session`.
- A public companion cookie `gt-uid` is set so the client can namespace localStorage cache and avoid cross-profile leakage.
- `verifySession()` in `lib/auth.ts` validates the signed cookie using `AUTH_SECRET`.
- `listUsers()` returns `{ id, name, passcodeLength }`.
- `getCurrentUser()` exists in `lib/actions.ts` and returns the active profile for UI use.

Profile isolation:

- Each profile has its own row in `user_state`.
- Server actions such as `saveState`, `restoreBackup`, `resetCurrentProfile`, and backup mutations filter by the active `userId`.
- `resetCurrentProfile()` deletes only the active user's `user_state` row.
- Backup restore filters by both `backupId` and `user_id`; it cannot restore another user's backup.
- The client cache key is `gym-tracker:cache:v4`; the value is an envelope `{ uid, state }`. `readCache()` ignores cache if `uid` does not match `gt-uid`.
- Other localStorage features such as carousel/leg-pick are uid-scoped with `uidStorageSuffix()`.

Important safety note for Apple Health:

- The Shortcut endpoint will not have a browser session cookie. It must authenticate with `Authorization: Bearer <token>` and then match the target profile by `profileId` first, falling back to `profileName`.
- Do not use `currentUserId()` for the Shortcut endpoint because the phone Shortcut is not signed into the web session.

### Storage / Data Layer

Relevant files:

- `lib/db.ts`
- `lib/migrate.ts`
- `lib/actions.ts`
- `lib/store.tsx`
- `lib/types.ts`
- `lib/defaults.ts`
- `components/data-io.tsx`

Current storage:

- Neon Postgres via `@neondatabase/serverless`.
- `getSql()` reads `process.env.DATABASE_URL`.
- `ensureSchema()` creates:
  - `users`
  - `user_state`
  - `push_subscriptions`
  - `app_state`
  - `user_state_backups`
- `user_state.data` is one JSONB `AppState` blob per profile.
- `saveState(state)` overwrites only the active user's `user_state.data`, then writes daily/weekly backup snapshots.
- `loadState()` returns `AppState` from the active user's row. It currently explicitly returns only `settings`, `workoutLogs`, `foodLogs`, and `weightLogs`.
- `StoreProvider` hydrates from uid-scoped localStorage, then server state, and autosaves after a 600 ms debounce. It currently also explicitly preserves only `settings`, `workoutLogs`, `foodLogs`, and `weightLogs` during hydration.
- `components/data-io.tsx` exports the whole client `state` JSON, but import currently rebuilds only `settings`, `workoutLogs`, `foodLogs`, and `weightLogs`.

Default / migration behavior:

- `DEFAULT_SETTINGS` contains starter defaults.
- `BLANK_SETTINGS` intentionally starts new profiles with no upper templates, no leg templates, and blank schedule.
- `createUser()` immediately writes `emptyAppState()` into `user_state`.
- `emptyAppState()` currently returns settings plus `workoutLogs`, `foodLogs`, and `weightLogs`.
- `migrateSettings()` handles template defaults and intentional empty profiles. Do not disturb it for Apple Health.

### Home Dashboard

Relevant file:

- `app/page.tsx`

Current Home behavior:

- `app/page.tsx` is a client component.
- It reads profile-specific state through `useStore()`.
- It uses `todayISO()` and `date` state to render a date-specific dashboard.
- Daily cards currently show workout, calories/protein, macros, streaks, weight/BMI, and secondary insight cards.
- `StatCard`, `MacroMini`, and `MiniCard` are local components in `app/page.tsx`.

Where Apple Health belongs:

- Add compact Apple Health cards/section in `app/page.tsx`, reading `state.appleHealthDaily?.[date]`.
- Show:
  - Steps today
  - Active calories today
  - Steps progress against a fixed daily goal of `10,000` steps
  - Active calories progress against a fixed daily goal of `500` kcal
  - Last synced time
- If no Apple Health data exists for the selected date, show `Apple Health not synced yet`.
- Keep the current dark premium UI style. Use existing `Card`, font-mono labels, and compact dashboard patterns.
- This should be an additive UI change only. Do not rewrite existing dashboard calculations, workout cards, nutrition cards, date selection, or store behavior unless strictly required to read `appleHealthDaily`.

### Settings

Relevant file:

- `app/settings/page.tsx`

Current Settings structure:

- Settings is a client component.
- Sections use the local `SettingsSection` accordion component.
- Existing sections include Profile, Goals, Display, Daily targets, Weekly schedule, Templates, Backups, Manual export/access, Profile, Danger zone.
- `BackupPanel` is in `components/backup-panel.tsx`.
- `DataIO` is in `components/data-io.tsx`.

Where Apple Health setup belongs:

- Add a new Settings section near `Backups` or `Manual export & access`, titled `Apple Health Sync`.
- The section should be informational/help UI only; it must not display the real token.
- It should show the current active profile id/name if available. Use `getCurrentUser()` in a client-safe way, similar to other server actions imported into client components.
- It should show latest Apple Health sync time if available from `state.appleHealthDaily`.

### API Route Structure

Existing route:

- `app/api/notify/route.ts`

Existing route pattern:

- Route handler file under `app/api/.../route.ts`.
- Uses `NextResponse`.
- Exports `runtime = "nodejs"` and `maxDuration = 60`.
- Reads a server-only env var (`CRON_SECRET`) and compares `Authorization: Bearer ...`.
- Calls `ensureSchema()` and `getSql()` server-side.

New route should be:

- `app/api/apple-health/sync/route.ts`
- `runtime = "nodejs"`
- `POST(req: Request)`
- Optional `GET` can return 405 or simple health info without secrets. Do not accept sync data over GET.

### Type Definitions

Relevant file:

- `lib/types.ts`

Current `AppState`:

```ts
export type AppState = {
  settings: Settings;
  workoutLogs: Record<string, WorkoutLog>;
  foodLogs: Record<string, FoodLog>;
  weightLogs: Record<string, WeightLog>;
};
```

Add Apple Health types without breaking old JSON:

```ts
export type AppleHealthDailyEntry = {
  source: "apple_shortcuts" | string;
  steps: number;
  activeEnergyKcal: number;
  syncedAt: string;
};

export type AppState = {
  settings: Settings;
  workoutLogs: Record<string, WorkoutLog>;
  foodLogs: Record<string, FoodLog>;
  weightLogs: Record<string, WeightLog>;
  appleHealthDaily?: Record<string, AppleHealthDailyEntry>;
};
```

Use `appleHealthDaily?: ...` so existing profiles and old imports load safely.

## Feature Requirements

### A. API Endpoint

Implement:

`POST /api/apple-health/sync`

Request body:

```json
{
  "profileName": "Shubham",
  "profileId": "optional-profile-id",
  "date": "2026-05-26",
  "source": "apple_shortcuts",
  "steps": 9350,
  "activeEnergyKcal": 548
}
```

Validation:

- `date` is required.
- `date` must be `yyyy-MM-dd`.
- `steps` is optional; default to `0`.
- `activeEnergyKcal` is optional; default to `0`.
- `steps` and `activeEnergyKcal` must be finite non-negative numbers.
- `source` is optional; default to `"apple_shortcuts"`.
- `profileId` is preferred if provided.
- `profileName` is fallback if `profileId` is missing.
- If neither `profileId` nor `profileName` is provided, return `400`.
- Invalid JSON or invalid payload returns `400`.
- Missing or wrong auth returns `401`.
- If the target profile is not found, return `404`.
- If `profileName` matches multiple users, return `409` and tell the caller to use `profileId`.

Authentication:

- Read `process.env.APPLE_HEALTH_SYNC_TOKEN`.
- Require request header: `Authorization: Bearer <token>`.
- Do not accept a token in query params or JSON body.
- If server env `APPLE_HEALTH_SYNC_TOKEN` is not configured, return a generic server error such as `500 { "ok": false, "error": "sync_not_configured" }`.
- Never log the token.
- Never commit a token.
- Prefer a timing-safe comparison helper using `node:crypto` `timingSafeEqual` for non-empty strings.

Success response:

```json
{
  "ok": true,
  "profileName": "Shubham",
  "date": "2026-05-26",
  "stored": {
    "steps": 9350,
    "activeEnergyKcal": 548
  }
}
```

### B. Profile-Safe Storage

Add profile-scoped field:

```ts
appleHealthDaily: {
  "2026-05-26": {
    "source": "apple_shortcuts",
    "steps": 9350,
    "activeEnergyKcal": 548,
    "syncedAt": "ISO_DATE"
  }
}
```

Rules:

- Store only under the matched profile's `user_state.data`.
- Shubham data must not go into RIYA.
- RIYA must not be touched unless payload explicitly targets RIYA by `profileId` or unambiguous `profileName`.
- Existing profiles without `appleHealthDaily` must load safely.
- Existing workout, food, weight, recipes, notes, settings, templates, history, cycle segments, and backups must not be overwritten.
- Do not break import/export.
- Do not break profile-specific reset.
- Do not create a separate global Apple Health table unless there is a compelling reason. The requested storage shape is inside the profile's `AppState` blob.

Server-side write guidance:

- Create a focused server helper, for example `lib/apple-health-sync.ts`, that is only imported by the route handler.
- The helper should call `ensureSchema()` and `getSql()`.
- Resolve target profile:
  - If `profileId` is supplied: query `users` by `id`.
  - Else query `users` by normalized display name. Use case-insensitive exact comparison, not partial matching.
  - If multiple rows match the name, reject with `409`.
- Load existing `user_state.data` for the matched `user_id`.
- If no row exists, build a blank state with the same shape as `emptyAppState()` / `BLANK_SETTINGS`.
- Merge shallowly:
  - Preserve every existing top-level field.
  - Preserve `settings`, `workoutLogs`, `foodLogs`, `weightLogs`.
  - Preserve any existing `appleHealthDaily`.
  - Only set `appleHealthDaily[date]`.
- Write the full merged blob back to `user_state` for that user only.
- Use one SQL update/insert scoped by the matched `user_id`.
- Consider creating a daily/weekly backup for this route write or at least document why not. Current automatic backups are tied to `saveState()`, so direct route writes otherwise bypass backup creation.

### C. Home Dashboard Apple Health Cards

Add compact dashboard UI in `app/page.tsx`:

- Read `const appleHealth = state.appleHealthDaily?.[date];`
- Show:
  - Steps today
  - Active calories today
  - Steps goal progress as `current / 10,000`
  - Active calories goal progress as `current / 500`
  - Last synced time
- If no data for selected date, show:

`Apple Health not synced yet`

UI guidance:

- Use existing `Card` and dark compact dashboard style.
- Do not make a large marketing-style panel.
- Suggested placement: after the workout CTA and before nutrition cards, or as a two-card row near other daily metrics.
- Use icons from `lucide-react`, for example `Footprints`, `Activity`, `Clock`, or available similar icons.
- Format steps with `toLocaleString()`.
- Format active calories as `548 kcal`.
- Use a fixed steps goal of `10,000` per day for this first version.
- Use a fixed active calories goal of `500` kcal per day for this first version.
- Show the goals clearly in the Home UI, for example `9,350 / 10,000 steps` and `548 / 500 kcal`.
- If using progress bars or rings, clamp display progress to `100%` but still show the real value when it is over goal.
- Format last synced as relative if simple, or a compact local time like `Synced 10:42 PM`.
- Old profiles with no `appleHealthDaily` must show the empty state without throwing.
- Do not change current Home page functions, dashboard business logic, workout summaries, food summaries, weight summaries, date navigation, or existing cards except for the smallest additive changes needed to include Apple Health.

### D. Settings Apple Health Sync Section

Add a Settings section titled `Apple Health Sync`.

The section must show:

- Endpoint URL:

```txt
https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync
```

- Required header:

```txt
Authorization: Bearer YOUR_SECRET_TOKEN
```

- Example payload:

```json
{
  "profileName": "Shubham",
  "date": "2026-05-26",
  "source": "apple_shortcuts",
  "steps": 9350,
  "activeEnergyKcal": 548
}
```

- Current active profile name/id if available.
- Last synced time if available from `state.appleHealthDaily`.
- A clear note that the real token is never shown in the app and must be stored only in Vercel env vars and the iPhone Shortcut.

Implementation guidance:

- Prefer creating `components/apple-health-sync-panel.tsx`.
- Use `getCurrentUser()` from `lib/actions.ts` in a `useEffect` to show active profile id/name.
- The component can receive/read `state.appleHealthDaily` via `useStore()`.
- Do not read `process.env.APPLE_HEALTH_SYNC_TOKEN` in this client component.
- Do not add any token input field unless the user explicitly asks later.

### E. iPhone Shortcut Setup Reminder

The Settings section should remind the user that the iPhone Shortcut request must use:

- Dictionary body
- Method: `POST`
- JSON request body
- Header: `Authorization: Bearer YOUR_SECRET_TOKEN`
- Header: `Content-Type: application/json`
- URL: `https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync`

Also mention:

- Current token must be rotated separately in Vercel and in the iPhone Shortcut.
- Do not paste the real token into GitHub, source files, screenshots, or chat logs.

## Implementation Plan

### 1. Types

Modify `lib/types.ts`:

- Add `AppleHealthDailyEntry`.
- Add optional `appleHealthDaily?: Record<string, AppleHealthDailyEntry>` to `AppState`.

Keep the field optional for backward compatibility.

### 2. State Defaults / Hydration / Import

Modify these files so `appleHealthDaily` is preserved:

- `lib/actions.ts`
  - `emptyAppState()` should include `appleHealthDaily: {}`.
  - `loadState()` should return `appleHealthDaily: data.appleHealthDaily ?? {}`.
- `lib/store.tsx`
  - `INITIAL_STATE` should include `appleHealthDaily: {}`.
  - cached hydration should preserve `cached.state.appleHealthDaily ?? {}`.
  - server hydration should keep `server.appleHealthDaily ?? {}`.
  - `resetAll()` will then reset Apple Health data only for the active profile through `INITIAL_STATE`.
- `components/data-io.tsx`
  - export already serializes the full state.
  - import merge must include `appleHealthDaily: parsed.appleHealthDaily ?? {}` so imports do not silently drop Apple Health data.

Do not modify template migration logic except where TypeScript requires `AppState` shape changes.

### 3. Server Helper

Create `lib/apple-health-sync.ts`.

Responsibilities:

- Validate/sanitize sync payload.
- Resolve target profile by `profileId` or `profileName`.
- Load existing profile state.
- Merge `appleHealthDaily[date]`.
- Write only that profile's `user_state` row.
- Return profile id/name/date/stored values.

Keep this helper server-only by only importing it from route handlers or server code.

Recommended exported API:

```ts
export type AppleHealthSyncPayload = {
  profileName?: string;
  profileId?: string;
  date?: string;
  source?: string;
  steps?: unknown;
  activeEnergyKcal?: unknown;
};

export async function syncAppleHealthDaily(payload: AppleHealthSyncPayload): Promise<{
  profileId: string;
  profileName: string;
  date: string;
  stored: { steps: number; activeEnergyKcal: number };
}>;
```

Use thrown typed errors or result objects so the route can map invalid payload to `400`, not found to `404`, and ambiguous profile name to `409`.

### 4. API Route

Create `app/api/apple-health/sync/route.ts`.

Requirements:

- `export const runtime = "nodejs";`
- `POST(req: Request)` only for sync.
- Parse JSON safely.
- Check `Authorization` before doing DB work.
- Use `process.env.APPLE_HEALTH_SYNC_TOKEN`.
- Call `syncAppleHealthDaily(payload)`.
- Return the exact success shape requested.

Do not expose secrets in responses.

### 5. Home UI

Modify `app/page.tsx`:

- Add Apple Health compact card/section reading profile state.
- The Home page must display the synced Apple Health data in the UI, not only store it.
- Display daily goal progress:
  - Steps: `steps / 10,000`
  - Active calories: `activeEnergyKcal / 500`
- Keep the goals fixed in code for now unless the user later asks for configurable goals.
- Preserve all existing dashboard data.
- Do not make the page dependent on Apple Health data.
- The selected `date` should control which `appleHealthDaily[date]` is displayed.
- Keep changes tightly scoped. Do not refactor unrelated Home page functions, components, or calculations.

### 6. Settings UI

Create `components/apple-health-sync-panel.tsx` and add it to `app/settings/page.tsx`.

Show:

- Endpoint URL.
- Header placeholder.
- Example payload.
- Current active profile id/name if available.
- Last synced value if available.
- Shortcut setup reminder.
- Token rotation warning.

Do not display or fetch the real token.

### 7. Tests / Manual Verification

There is no full test runner in `package.json`. Existing scripts include `scripts/cycle-test.mjs`.

At minimum run:

```bash
npm run lint
npm run build
```

If adding a focused script is useful, add something like `scripts/apple-health-sync-test.mjs` only if it can test pure validation/profile merge logic without real production DB writes.

Manual API tests:

Use placeholder token only; do not commit or paste real token.

Missing token header should return `401`:

```bash
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -d '{"profileName":"Shubham","date":"2026-05-26","steps":9350,"activeEnergyKcal":548}'
```

Wrong token should return `401`:

```bash
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer WRONG_TOKEN' \
  -d '{"profileName":"Shubham","date":"2026-05-26","steps":9350,"activeEnergyKcal":548}'
```

Valid token should store data under Shubham only:

```bash
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ROTATED_TOKEN' \
  -d '{"profileName":"Shubham","date":"2026-05-26","source":"apple_shortcuts","steps":9350,"activeEnergyKcal":548}'
```

Manual app checks:

- Missing token returns `401`.
- Wrong token returns `401`.
- Valid token stores data under Shubham only.
- RIYA remains unchanged.
- Home dashboard shows steps and active calories for the synced date.
- Home dashboard shows `Apple Health not synced yet` on dates without data.
- Old profiles without `appleHealthDaily` still load.
- Existing workout/food/weight data remains intact.
- Existing recipes, notes, templates, and cycle segments remain intact.
- Import/export still includes and restores Apple Health data.
- Reset current profile removes Apple Health data only from the active profile.

### 8. Git / Deployment

After implementation:

1. Run `git status --short`.
2. Review `git diff`.
3. Ensure no token or `.env` file is staged.
4. Run checks:
   - `npm run lint`
   - `npm run build`
5. Commit with a clear message, for example:

```bash
git add app/api/apple-health/sync/route.ts lib/apple-health-sync.ts lib/types.ts lib/actions.ts lib/store.tsx app/page.tsx app/settings/page.tsx components/apple-health-sync-panel.tsx components/data-io.tsx
git commit -m "feat: add Apple Health shortcut sync"
```

6. Push to GitHub.
7. Confirm whether Vercel deployment was triggered. If you cannot confirm from available tooling, say so clearly and tell the user to check Vercel.

Create a results file after implementation:

`results/apple-health-sync-implementation-results.md`

Include:

- Summary.
- Files changed.
- Exact API behavior.
- Data safety notes.
- Verification command outputs.
- Manual test results.
- Commit hash.
- Push result.
- Vercel deployment status or why it could not be confirmed.

## Strong Data Safety Warnings

Do not wipe profiles.

Do not migrate Shubham into RIYA.

Do not migrate RIYA into Shubham.

Do not reset profiles.

Do not hardcode secret tokens.

Do not expose env vars in frontend.

Do not break profile isolation.

Do not make destructive migrations.

Do not refactor or change existing Home/dashboard behavior while adding Apple Health UI.

Do not repeat the previous profile data loss mistake.

The sync route must update exactly one profile row and preserve all existing data in that row except for the single date under `appleHealthDaily`.

## Unknowns / Verify Before Editing

- Confirm the exact production profile ids from the `users` table if the user wants to target by `profileId`. Display names can collide, so profileId is safer.
- Confirm whether the user wants the API to accept profile names case-insensitively. Recommended: case-insensitive exact match with `409` on ambiguity.
- Confirm whether route writes should create backup snapshots. Recommended: yes or at least add a clear note, because route writes bypass `saveState()` backup creation unless you reuse/extract backup helpers.
- Confirm Vercel has `APPLE_HEALTH_SYNC_TOKEN` configured in the correct environment before production testing.
- Confirm the rotated token has been updated in the iPhone Shortcut before relying on live sync.
