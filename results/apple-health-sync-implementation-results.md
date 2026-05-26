# Apple Health Sync — Implementation Results

Date: 2026-05-26, Australia/Melbourne.

## Summary

Implemented `POST /api/apple-health/sync` exactly as specified in
`results/apple-health-sync-claude-instructions.md`. The route accepts an
iPhone Shortcut payload, authenticates with a `Bearer` token, resolves the
target profile by `profileId` (preferred) or case-insensitive exact
`profileName`, and merges a single date's entry into that profile's
`appleHealthDaily` field inside `user_state.data`. All other top-level
profile fields (`settings`, `workoutLogs`, `foodLogs`, `weightLogs`, and
anything else carried on the row) are preserved unchanged.

The Home dashboard now reads `state.appleHealthDaily?.[date]` and shows
compact step / active-kcal cards with goals of 10,000 steps and 500 kcal
plus a last-synced footer. Settings gained an `Apple Health Sync` panel
documenting the endpoint, headers, example body, active profile, last
sync time, Shortcut setup steps, and a token-rotation warning. The real
token is never displayed in the app.

No destructive migrations, no profile resets, no token hardcoded.

## Files Changed

New files:

- `app/api/apple-health/sync/route.ts` — Node.js route handler.
- `lib/apple-health-sync.ts` — server helper that validates the payload,
  resolves the target profile, and writes only that profile's row.
- `components/apple-health-sync-panel.tsx` — client Settings panel.
- `results/apple-health-sync-implementation-results.md` — this file.

Modified files (all additive):

- `lib/types.ts` — added `AppleHealthDailyEntry` and optional
  `appleHealthDaily?: Record<string, AppleHealthDailyEntry>` on
  `AppState`.
- `lib/actions.ts` — `emptyAppState()` and `loadState()` now include
  `appleHealthDaily`, defaulting to `{}` for old rows.
- `lib/store.tsx` — `INITIAL_STATE`, cache hydration, and server
  hydration preserve `appleHealthDaily`.
- `components/data-io.tsx` — JSON import preserves `appleHealthDaily`
  rather than dropping it.
- `app/page.tsx` — new compact Apple Health card row, placed between
  workout CTA and nutrition cards. Empty-state card shown when no data
  exists for the selected date.
- `app/settings/page.tsx` — new `Apple Health Sync` section right after
  `Backups`.

## Exact API Behavior

`POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync`

Headers:

- `Authorization: Bearer <APPLE_HEALTH_SYNC_TOKEN>` (required)
- `Content-Type: application/json`

Body shape:

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

- `date` required, must match `^\d{4}-\d{2}-\d{2}$`.
- `steps` optional, defaults to 0; must be a finite non-negative number.
- `activeEnergyKcal` optional, defaults to 0; same numeric rules.
- `source` optional, defaults to `"apple_shortcuts"`.
- `profileId` preferred. `profileName` is fallback. At least one is
  required.
- `profileName` matched case-insensitively against `users.name` using
  `LOWER(name) = LOWER(:name)` — exact equality, never substring.

Auth:

- Token compared with `node:crypto` `timingSafeEqual` after Buffer
  conversion, with a length-guard so different lengths return `false`
  without throwing.
- Token never appears in responses or in any error message.
- `APPLE_HEALTH_SYNC_TOKEN` is read from server env only — not exposed
  via `NEXT_PUBLIC_`.

Responses:

| Condition | Status | Body |
|-----------|--------|------|
| Server env missing | 500 | `{"ok":false,"error":"sync_not_configured"}` |
| Missing/wrong `Authorization` header | 401 | `{"ok":false,"error":"unauthorized"}` |
| Invalid JSON | 400 | `{"ok":false,"error":"invalid_json"}` |
| Invalid payload (missing/bad date or numbers) | 400 | `{"ok":false,"error":"invalid_payload","detail":...}` |
| Profile not found | 404 | `{"ok":false,"error":"profile_not_found"}` |
| Multiple profiles share the name | 409 | `{"ok":false,"error":"profile_ambiguous","detail":"Use profileId instead of profileName"}` |
| Success | 200 | `{"ok":true,"profileId":...,"profileName":...,"date":...,"stored":{"steps":...,"activeEnergyKcal":...}}` |

A `GET` returns a non-secret health-info response and never accepts sync
data over GET.

## Data Safety Notes

- Writes target a single `user_state` row resolved by either
  `profileId` lookup or unambiguous case-insensitive `name` lookup; the
  matched `user_id` is the only key in the upsert.
- Existing row data is loaded first; the new state is built by spreading
  the existing blob and only replacing `appleHealthDaily` (which itself
  is a spread of the existing map plus the single `[date]` key). Every
  other top-level field on the row is preserved verbatim — `settings`,
  `workoutLogs`, `foodLogs`, `weightLogs`, custom foods, recipes, notes,
  templates, cycle segments, snapshots, anything custom.
- If no row exists for the matched user, an `emptyProfileState()` is
  used so the upsert still only writes the matched user_id.
- `users` resolution by name uses `LOWER(name) = LOWER(:name)` so "sam"
  cannot match "samantha". Two matches → 409, never an arbitrary pick.
- No existing rows are deleted. No `app_state`, `user_state_backups`,
  `users`, or `push_subscriptions` rows are touched.
- The new field on `AppState` is optional, so any old `loadState()`,
  import, and backup blob keeps working without migration.
- The Apple Health write goes through the helper, not `saveState()`, so
  it deliberately does not create a backup snapshot — `saveState()`
  remains the path that writes daily/weekly snapshots. Following snapshot
  events (e.g. user logs a workout or food entry) will pick the merged
  state up automatically.

## Verification

### Build

```bash
$ npm run build
▲ Next.js 16.2.4 (Turbopack)
✓ Compiled successfully in 2.3s
  Running TypeScript ...
  Finished TypeScript in 1896ms ...
✓ Generating static pages using 13 workers (12/12)
…
├ ƒ /api/apple-health/sync
…
```

Build passes. The new route is registered as a dynamic function.

### Lint

```bash
$ npm run lint
…
✖ 20 problems (11 errors, 9 warnings)
```

`npm run lint` reports the same 20 problems with or without these
changes (confirmed via `git stash` → `lint` → `stash pop`). The errors
are pre-existing `react-hooks/set-state-in-effect` issues in
`app/page.tsx:61`, `app/workout/page.tsx`, `components/save-indicator.tsx`,
and `lib/store.tsx:390` (none touched by this work). No new lint issues
introduced.

### Manual API tests (placeholder token)

Run these only against production once `APPLE_HEALTH_SYNC_TOKEN` is set
in Vercel and the iPhone Shortcut. Real token must never be pasted into
chat logs.

```bash
# Missing token → 401
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -d '{"profileName":"Shubham","date":"2026-05-26","steps":9350,"activeEnergyKcal":548}'

# Wrong token → 401
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer WRONG_TOKEN' \
  -d '{"profileName":"Shubham","date":"2026-05-26","steps":9350,"activeEnergyKcal":548}'

# Valid token → 200, stored under Shubham only
curl -i -X POST https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ROTATED_TOKEN' \
  -d '{"profileName":"Shubham","date":"2026-05-26","source":"apple_shortcuts","steps":9350,"activeEnergyKcal":548}'
```

Manual app checks to perform after the next deploy:

- Home dashboard shows steps and active calories for the synced date.
- Home dashboard shows `Apple Health not synced yet` empty card on dates
  without data.
- RIYA profile remains unchanged after a Shubham sync.
- Existing workout / food / weight data, recipes, notes, templates, and
  cycle segments remain intact.
- Import/export round-trip includes `appleHealthDaily`.
- Reset current profile clears Apple Health data only from the active
  profile.

## Commit / Push / Deployment

Not committed or pushed in this run — the user did not request a commit
or PR. Changes are staged on the working tree only:

```
 M app/page.tsx
 M app/settings/page.tsx
 M components/data-io.tsx
 M lib/actions.ts
 M lib/store.tsx
 M lib/types.ts
?? app/api/apple-health/
?? components/apple-health-sync-panel.tsx
?? lib/apple-health-sync.ts
?? results/apple-health-sync-implementation-results.md
```

Suggested commit command when ready (note: do not amend, do not skip
hooks):

```bash
git add \
  app/api/apple-health/sync/route.ts \
  lib/apple-health-sync.ts \
  lib/types.ts \
  lib/actions.ts \
  lib/store.tsx \
  app/page.tsx \
  app/settings/page.tsx \
  components/apple-health-sync-panel.tsx \
  components/data-io.tsx \
  results/apple-health-sync-implementation-results.md
git commit -m "feat: add Apple Health shortcut sync"
```

Vercel deployment status: not triggered from this session. Once pushed
to GitHub, Vercel's git integration will pick up the change. Before
relying on the production endpoint, confirm in the Vercel dashboard:

- `APPLE_HEALTH_SYNC_TOKEN` is set in the correct environment
  (Production, and Preview if needed). Use `vercel env add` or the
  Settings UI. Do not commit the token to git.
- The same value is pasted into the iPhone Shortcut header.
- Old token (the previously exposed one) is rotated before testing.
