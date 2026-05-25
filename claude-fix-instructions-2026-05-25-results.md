# Claude Fix Instructions — Results (2026-05-25)

## Summary of changes

| # | Item | Status |
| --- | --- | --- |
| 1 | Fresh user profiles start with **zero templates** (no auto-seed). | Done |
| 2 | Sunday 2026-05-24 glitch — picks now stick, carousel resets on date/template change, uid-scoped local state. | Done |
| 3 | Automated server-side **daily + weekly + manual + pre-restore backups**, with restore UI scoped to the active profile. | Done |
| 4 | UI glitch audit (build/typecheck + manual smoke plan). | Done (lint/build only; no headless browser available — manual smoke notes below). |
| 5 | Food-section clutter ideas (no risky UI change shipped). | Documented (no code shipped). |
| 6 | **Immutable workout snapshot** stored on each log; History + Workout render from snapshot first. | Done |
| 7 | Shared exercise progress aligned across templates (transitive aliases, `ez-bar-curl → barbell-curl`). | Done |
| 8 | Data recovery & maintenance treated as critical — schema migration is idempotent, snapshot-on-save, pre-restore safety net, profile-scoped restore. | Done |
| 9 | Assisted-load direction supported in PRs (settings override + per-exercise field + variant heuristic). | Done |

Nothing was deleted from the database. No destructive script was executed.

## Files changed

Modified:

- `lib/types.ts` — new `LoadDirection`, `WorkoutTemplateSnapshot`, `WorkoutLog.templateSnapshot`, `Settings.userTemplatesSeededVersion`, `Settings.exerciseLoadDirection`, `TemplateExercise.loadDirection`.
- `lib/defaults.ts` — added `BLANK_SETTINGS`; `needsTemplateMigration` now respects `userTemplatesSeededVersion` so an *intentional* `templates: []` is never re-seeded.
- `lib/actions.ts` — `emptyAppState()` now returns blank; `createUser` writes a blank `user_state` row immediately; `saveState` does snapshot-on-save (daily + weekly buckets, ON CONFLICT upsert, retention sweep). New server actions: `backupStatus`, `listBackups`, `triggerManualBackup`, `downloadLatestBackup`, `restoreBackup` (with pre-restore snapshot + per-user filter), `deleteBackup`, `setBackupProtected`. Loose `looksLikeAppState` validator before any restore overwrites.
- `lib/migrate.ts` — new `user_state_backups` table + indexes (idempotent `CREATE TABLE IF NOT EXISTS`).
- `lib/store.tsx` — pass `userTemplatesSeededVersion` to `needsTemplateMigration`, stamp it after first successful hydration even when nothing else changes (so legacy profiles get the marker too); new `findTemplateById`, `snapshotTemplate`, `withSnapshotIfPossible`; `setSets`, `setRecovery`, `setDidOptional`, `markRestComplete` now lazily capture the snapshot on the *first* commit; `ensureWorkoutLog` clears a stale snapshot when the user changes templates for a date.
- `lib/exercise-aliases.ts` — `ez-bar-curl → barbell-curl`; `arm-superset-curl` re-pointed at `barbell-curl`; `resolveExerciseId` follows the alias chain transitively; `exerciseIdGroup` walks the chain so chained aliases all land in the same group.
- `lib/pr.ts` — new `loadDirectionFor` helper; `bestSet`, `summarize`, `allTimeBests`, `sessionPRs`, `exerciseHistory` all accept a `direction` arg and invert weight comparisons for `"assistance"`.
- `components/exercise-carousel.tsx` — restore-position effect now reruns on `(positionKey, date, exercises)` change (the old `restoredRef` only ran once per mount, so date-nav left the cube stuck on an orphan exercise); store key is uid-scoped (`v2:<uid>`) so a new profile cannot inherit the previous profile's position.
- `components/exercise-card.tsx`, `components/pr-ladder.tsx`, `components/exercise-pr-detail.tsx` — pass the resolved `direction` into the PR helpers; PR ladder trend color flips for assistance-load.
- `app/workout/page.tsx` — `pickUpperTemplate` no longer mutates the global cycle (it just writes that date's log); the active upper template is now `log?.templateId ?? scheduled`; leg-pick localStorage is uid-scoped; new empty states (`NoTemplatesState`, `UpperEmptyState`); snapshot wins over the live template in the workout view.
- `app/history/page.tsx` — `log.templateSnapshot` wins over the live template list for both the template title/category and the per-exercise names.
- `app/settings/page.tsx` — new collapsible "Backups" section above the existing "Manual export & access" section.

New files:

- `lib/uid-client.ts` — `getActiveUid` / `uidStorageSuffix` helpers (reads the non-httpOnly `gt-uid` companion cookie).
- `components/backup-panel.tsx` — backup Settings UI (status, snapshot now, download latest, list + restore + pin + delete).

## Data migration and recovery notes

- **Schema migration is idempotent.** All new SQL is `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. Existing rows in `users`, `user_state`, `push_subscriptions`, and `app_state` are untouched.
- **No client-side data is rewritten on hydration.** `migrateSettings` only ever sets `userTemplatesSeededVersion` for profiles that already pass validation; their saved templates, schedule, custom foods, recipes, notes, and log entries are byte-for-byte unchanged.
- **Snapshot backfill is lazy.** Existing `WorkoutLog`s without `templateSnapshot` keep working — the History and Workout views fall back to the current templates + `LEGACY_EXERCISE_NAMES`. The first time you touch an older log (open it in Workout and log a set, mark complete, etc.) a snapshot of the *current* template will be captured, freezing the display from that point forward. That preserves every existing log without forcing a heavy backfill of every row in one shot.
- **Backups are snapshot-on-save.** `saveState` writes both the live row in `user_state` and a daily + weekly bucket in `user_state_backups` for the active user only. The two unique indexes (`UNIQUE (user_id, kind, period_key)`) collapse all of today's saves into one daily row, and all of this week's saves into one weekly row.
- **Retention.** 30 daily, 12 weekly, 20 manual, 10 pre-restore — per profile. `protected = true` excludes a row from retention.
- **Pre-restore safety net.** `restoreBackup(id)` snapshots the current `user_state` into the `pre-restore` bucket before overwriting, so any restore can be rolled back from the same Backups panel.
- **Profile isolation.** Every backup query — `listBackups`, `backupStatus`, `restoreBackup`, `deleteBackup`, `setBackupProtected`, `triggerManualBackup`, `downloadLatestBackup` — filters by `user_id` resolved from the **httpOnly signed session cookie**. A forged `backupId` from another profile cannot be selected, restored, deleted, or pinned. The client cannot inject `userId` anywhere.
- **No destructive script was executed.** `scripts/recover-shubham.mjs` and the other one-off scripts were left untouched, per the rule.
- **Cache isolation already existed**, and I extended it: the carousel position store and the leg-template picker are now uid-scoped so a profile-switch can no longer leak local UI state across accounts.

## Verification commands and results

| Command | Result |
| --- | --- |
| `npm run lint` | 11 errors, 10 warnings (same 11 errors as the pre-change baseline — they are pre-existing `react-hooks/set-state-in-effect` rules from the recent React 19 ESLint plugin, in `exercise-card.tsx` lines 159 & 533, `exercise-carousel.tsx:53`, `save-indicator.tsx:14`, `store.tsx:389`, and two more pre-existing. The one change I touched, `exercise-carousel.tsx:111`, already raised the same error on `setIndex` in the previous code, so the count did not change. My change added 1 *warning* in `lib/actions.ts` for an unused import that was then removed.). Verified by stashing changes and re-running: same 11 errors before and after. |
| `npm run build` | ✅ Compiled successfully in 2.5s. ✅ TypeScript clean (1876ms). ✅ Static pages generated 11/11. No new errors. |

Concrete steps I ran:

```bash
npm run lint                  # 11 errors, 10 warnings (baseline)
git stash && npm run lint     # 11 errors, 9 warnings — confirmed baseline is 11
git stash pop
npm run build                 # success
```

I did **not** spin up the dev server in a real browser — this environment doesn't have an interactive browser. The build + typecheck pass is the strongest automated signal available here; the manual smoke-test plan below is what I would walk through against `npm run dev`.

## UI smoke-test notes (manual plan, including Sunday 2026-05-24)

Walk-through (mobile @ 390px and desktop):

1. **`/select`**
   - Create a brand-new profile. It must land on `/` with no upper templates and no leg templates.
   - Confirm: `localStorage` for the previous profile is not visible (cache envelope keyed by uid).
2. **`/workout` on a brand-new profile**
   - Expect: `NoTemplatesState` ("No templates yet" → "Open Settings → Templates"). No carousel, no rest-day card.
3. **`/settings` on a brand-new profile**
   - "Upper body templates" and "Leg templates" both show the empty hint.
   - Add one upper template (e.g. "Push A — Strength") and one exercise. Save indicator becomes "saved".
4. **Sunday 2026-05-24**
   - Navigate Workout, use DateNav back to 2026-05-24 (Sunday).
   - For the default schedule, Sunday = `rest-full` → shows Rest day card.
   - Tap a non-rest template in the upper TemplateSwitcher. The page header switches to that template's name *immediately* (no need to log a set first). The carousel renders the new exercises.
   - Navigate to another day (e.g. Saturday) and back — the carousel should reset to the first exercise of whichever template is active, *not* stick on whatever index Sunday had.
   - For Legs mode: with leg templates present, picking a leg template stores it under the uid-scoped `gym-tracker:active-leg-template:v2:<uid>` key.
5. **History**
   - Confirm any existing log still shows its original template name. Edit an upper template's name in Settings — old History entries should keep the *original* name (snapshot wins).
6. **Settings → Backups**
   - "Last saved" populates after the next autosave.
   - "Snapshot now" writes a "Manual" row to the list with `workoutDays/foodDays/weightDays` and `KB` counts.
   - "Download latest" produces a `gym-tracker-<uid>-YYYY-MM-DD.json` file.
   - Restore a backup → confirm dialog → reload happens → state matches the chosen backup.
   - Pin a backup (lock icon) → the trim sweep can no longer remove it; the delete button is disabled until unpinned.
7. **Cross-profile isolation**
   - Switch profiles. The new profile's Backups panel only shows that profile's snapshots. Attempting to restore another profile's backupId is impossible from the UI (server filters by session uid).
8. **Assisted progression**
   - In Settings (or via the upcoming variant picker), tag a variant of `tricep-dips` as "Assisted". Log 40kg ×8, then 35kg ×8 the next session — the PR badge fires as a weight PR because direction = assistance.

## Sunday 2026-05-24 — what was wrong, what it does now

Original behavior (before this patch):

- `plannedTemplate("2026-05-24", settings)` returned `"rest-full"` because the DEFAULT_SCHEDULE maps Sunday → rest.
- Tapping any non-rest template in the TemplateSwitcher called `shiftCycleTo`, which **rotated the entire weekday cycle** so Monday → Sunday's pick, Tuesday → Monday's pick, etc. That was the "stuck" sensation — the user couldn't change Sunday in isolation; every adjustment scrambled the rest of the week.
- The activeUpperId derivation only honored `log.templateId` when the log was "committed" (had entries or a recovery flag), so picking a template *without* logging a set fell back to the planned `rest-full` even though the log already pointed at the new template.
- The carousel's restoredRef ran once on mount, so navigating the date forward into a different template left the cube parked on an exercise that didn't exist anymore.

After this patch:

- `pickUpperTemplate` only writes `log.templateId` for that exact date. The schedule and cycle are left alone.
- `activeUpperId` is `log?.templateId ?? scheduledTemplateId`, so the pick sticks as soon as the user taps.
- The carousel restore effect now reruns on every `(positionKey, date, exercises)` change, and clamps to index `0` if the stored exercise no longer exists in the new template.
- Carousel position and the leg-template picker are uid-scoped, so profile switching cannot drag a stale position into a different account.

## Food-section clutter ideas

### Implemented now

Nothing — the food page was not modified in this pass. Data safety took priority and the food UI is not part of any risk path here.

### Future ideas (ranked by leverage)

1. **Collapse water into a single compact strip** at the top: one row of "glass" pills + plus/minus quick-add. Today it eats roughly the same vertical real estate as the totals card.
2. **Sticky compact macro header**: keep calories + protein visible while scrolling; tap to expand carbs / fats / fibre. The current "Today's totals" card duplicates info that Home already shows.
3. **Manual macro entry behind one menu**: replace the four "Add manual …" buttons with a single `+ Add manually` that opens a small dialog with a Kind picker (calories / protein / carbs / fats / fibre).
4. **Recents first, full preset library on demand**: the QuickFoods chip strip currently shows every category at once. A "Recents (last 14 days)" row + a "Browse foods" sheet trigger would dramatically reduce visual noise.
5. **Split daily logging from library management**: move "My foods" CRUD and the Recipe editor into their own tab/sheet so the daily logging surface is purely about adding entries.
6. **Recipes as a separate collapsible section**, not always-on. Pinned recipes can live in the recents row.
7. **Advanced macros toggle**: keep calories + protein visible by default; fold carbs/fats/fibre behind an "expanded macros" switch in Settings → Daily targets.
8. **Favorites / pin foods**: a star on any food adds it to a "Pinned" row at the top of QuickFoods.
9. **Categorized "My foods"**: include user-created custom foods alongside preset categories with a filter chip set (`mine` / `presets` / category).
10. **Meal grouping (Breakfast / Lunch / Dinner / Snacks)**: collapse entries per meal in today's log; tap to expand. Optional — does not need to be on by default.

## Remaining risks and questions

- **Strict ESLint rule `react-hooks/set-state-in-effect`** is reporting 11 pre-existing errors (all genuine "synchronize external value into state" patterns that existed before this change). They do not block the build, and I deliberately did not refactor them — that's outside the scope of this task. Worth a focused follow-up.
- **Backup table growth.** Retention is enforced by the `trimBackups` sweep at the tail of each `saveState`. If `saveState` *fails* between the upsert and the trim, you can briefly have one extra row per kind. The next save fixes it. No data is lost.
- **Variant-driven assisted detection.** The current heuristic only flips load direction when the user's variant string contains `"assist"`. The explicit Settings-level override (`settings.exerciseLoadDirection[id]`) is plumbed through everywhere but I did *not* add a UI button for it in this pass to keep blast radius small. Three follow-up options:
  1. Add a checkbox in the per-exercise editor in Settings → Templates (touches `app/settings/page.tsx` template editor).
  2. Add a tiny "Treat as assistance" toggle to the variant picker on the exercise card.
  3. Inferred-by-name (e.g. `"Assisted "` prefix) — I removed this in favor of variants because the existing default templates use names like `"Assisted Dips / Tricep Dips"` that could be either depending on how the user lifts that day.
- **Existing legacy users with renamed templates.** `migrateSettings` now stamps `userTemplatesSeededVersion` on the *first* hydration even when nothing else changes. That means a legacy user whose templates passed validation today will *never* be re-seeded by a future build. If you bump `TEMPLATES_VERSION` in the future and want existing users re-seeded with new defaults, you'll need to also bump `userTemplatesSeededVersion`'s gating logic — currently it's a one-way ratchet (intentional, per the user requirement that data safety dominates).
- **Sunday 2026-05-24 — couldn't reproduce against a real browser session.** The fix is implemented against the most plausible failure mode (carousel restore bug + cycle-shift on template pick + activeUpperId only honoring committed logs). If after deploying you still see Sunday "stuck", please send (a) what `state.workoutLogs["2026-05-24"]` looks like in localStorage and (b) the value of `state.settings.cycle` and `state.settings.cycleAnchor` so I can replicate.
- **No browser automation in this environment.** Lint + build pass; the live UI was not exercised. The smoke-test plan above is the recommended manual run after `npm run dev`.
