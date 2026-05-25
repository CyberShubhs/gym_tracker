# Claude Fix Instructions - 2026-05-25

Date context: Today is Monday, 2026-05-25 in Australia/Melbourne. The specific broken Sunday reported by the user is Sunday, 2026-05-24.

When you finish, create an output file with this same base name ending in `-results.md`:

`claude-fix-instructions-2026-05-25-results.md`

The results file must include:

- Summary of changes.
- Files changed.
- Data migration and recovery notes.
- Exact verification commands run and their results.
- UI smoke-test notes, including the Sunday 2026-05-24 workout check.
- Food-section clutter improvement ideas, separated into "implemented now" and "future ideas".
- Any remaining risks or questions.

## Project Rules

- Read `AGENTS.md` and `CLAUDE.md` first.
- This project uses Next.js `16.2.4` and React `19.2.4`. This is not the older Next.js behavior you may remember. Before editing code, read the relevant local docs under `node_modules/next/dist/docs/`, especially:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Do not run destructive DB scripts or write to production data without explicit user approval.
- Data safety is the highest priority. Any schema/data migration must be idempotent, preserve existing user data, and snapshot before changing rows.
- Existing users, especially the current main profile, must not lose workout, food, weight, recipe, custom food, note, template, or settings data.
- If a change touches persistence, add a recovery path and verification.
- Avoid broad refactors. Keep fixes focused and testable.

## Codebase Findings From Read-Only Inspection

- App state lives as one JSON blob per user in Neon table `user_state`, created in `lib/migrate.ts`.
- `lib/actions.ts` has `emptyAppState()`, and it currently returns `DEFAULT_SETTINGS`.
- `lib/defaults.ts` has `DEFAULT_SETTINGS` with `DEFAULT_TEMPLATES`, `DEFAULT_LEG_TEMPLATES`, `DEFAULT_SCHEDULE`, and `templatesVersion`.
- `lib/store.tsx` hydrates from a uid-scoped localStorage cache and then from `loadState()`. It auto-saves the full `AppState` after a 600 ms debounce.
- `migrateSettings()` in `lib/store.tsx` calls `needsTemplateMigration()` and can overwrite `settings.templates` and `settings.schedule` with defaults.
- New profile creation in `app/select/page.tsx` only creates the user row. The first state load gets the empty default app state from `loadState()`.
- Manual JSON export/import is in `components/data-io.tsx`; there is currently no automated backup/restore UI.
- Vercel cron already exists in `vercel.json` for `/api/notify`, so route handlers and cron are already in use.
- Workout rendering is mainly `app/workout/page.tsx`, `components/exercise-carousel.tsx`, and `components/exercise-card.tsx`.
- `ExerciseCarousel` stores position in `localStorage` under `gym-tracker:carousel-position:v1` and is not uid-scoped. It also restores only once via `restoredRef`, so date/template changes may not reset/restore cleanly.
- `WorkoutLog` currently stores `date`, `templateId`, `entries`, and flags. It does not snapshot the template or exercise definitions used on that date.
- `app/history/page.tsx` reconstructs old workout names from current templates plus `LEGACY_EXERCISE_NAMES`, so editing current templates can change how old logs display.
- `TemplateEditor` in `app/settings/page.tsx` edits `settings.templates` directly. That affects future display and can affect historical display because old logs reference only IDs.
- `lib/exercise-aliases.ts` already has an alias system for renamed exercise IDs. Use or extend that pattern.
- `lib/pr.ts` treats higher weight as better for all exercises. Assisted dips and assisted pull-ups need lower assistance to count as progress.
- Food UI is in `components/food-tracker.tsx`, `components/quick-foods.tsx`, `components/recipes-panel.tsx`, and `lib/foods.ts`. It currently shows water, all macro totals, today's log, recipes, recents, tabbed food presets, custom food controls, and recipe controls on one page.

## Required Fixes

### 1. Fresh User Profiles Must Start With Zero User Templates

User requirement: user exercises/templates should not sync between profiles. When a new user profile is created, it should have zero templates.

Current issue: `emptyAppState()` returns `DEFAULT_SETTINGS`, and `DEFAULT_SETTINGS` includes the default upper and leg templates. Also, migration can re-seed templates if it sees missing templates.

Implement profile isolation so:

- A brand-new profile starts with:
  - `settings.templates: []`
  - `settings.legTemplates: []`
  - no copied custom foods, recipes, notes, active variants, or logs
  - a schedule state that does not imply copied templates
- Existing profiles are not wiped.
- Reset behavior is explicit and does not unexpectedly reseed templates unless the user chooses a starter plan.
- The UI handles zero upper templates and zero leg templates with useful empty states and links to Settings.
- Settings can create the first template cleanly.
- Home and Workout pages do not pretend a missing template is a rest day if the real state is "no template exists".

Suggested approach:

- Separate "system starter templates" from "user templates".
- Create a blank `AppState` for new profiles instead of using `DEFAULT_SETTINGS` directly.
- Consider writing an initial blank `user_state` row during `createUser()` so first load is unambiguous.
- Adjust `needsTemplateMigration()` / `migrateSettings()` so an intentionally empty template list with the current app schema version is not treated as stale data to overwrite.
- If starter templates are still useful, add an explicit "Add starter templates" button rather than implicit sync.

### 2. Fix Sunday 2026-05-24 Workout Glitch

User report: the exercise for Sunday is missing/glitched/stuck at Upper Body, and they cannot see or change exercises for Sunday 2026-05-24.

Reproduce and inspect:

- Run the app locally.
- Navigate to Workout.
- Navigate to Sunday 2026-05-24.
- Test desktop and mobile widths.
- Test with:
  - no templates
  - current default templates
  - a committed log whose `templateId` no longer exists
  - localStorage carousel position present for another template/date

Potential code areas:

- `app/workout/page.tsx`: selected mode, `upperTemplate`, `legTemplate`, `activeUpperId`, `showWorkout`, and empty states.
- `components/exercise-carousel.tsx`: position localStorage key is not user-scoped; `restoredRef` may prevent correct restore after date/template changes; side faces render full `ExerciseCard`s and may interfere.
- `lib/cycle.ts`: `plannedTemplate()` falls back to `"rest-full"` even when no rest template exists.

Fix requirements:

- A date with no valid template must show a clear empty state and let the user pick/create a template.
- A committed historical log with a missing template ID must still display its logged exercises if snapshots or legacy data exist.
- Changing date, template, or user should not leave the carousel stuck on an invalid exercise.
- LocalStorage state for carousel/leg picks must not leak across profiles.
- Sunday 2026-05-24 must be manually verified and mentioned in the results file.

### 3. Automated Backups For Data Recovery

User requirement: data recovery and data maintenance are most important. The app should save backups daily or weekly automatically so manual export is not required every time.

Current issue: `saveState()` overwrites one JSON blob in `user_state`. Manual export/import exists, but no automated backup table, restore UI, retention policy, or snapshot-before-overwrite path.

Implement automated server-side backups:

- Add a durable backup table, for example `user_state_backups`.
- Store at minimum:
  - backup id
  - user id
  - backup type, such as `daily`, `weekly`, `manual`, `pre-restore`
  - backup date or period key
  - full JSON `AppState`
  - created timestamp
  - source metadata
- Snapshot before overwriting a user's state, at least once per day and once per week per user.
- Consider snapshot-on-save as the primary mechanism because it does not depend on the browser being open at a cron time.
- Optionally add a cron route if useful, but do not rely only on cron.
- Add retention, for example keep the last 30 daily backups and last 12 weekly backups per user, unless the user marks one protected.
- Add Settings UI under backup/access to:
  - show latest backup time/status
  - trigger a manual backup
  - export/download the latest backup
  - list recent backups
  - restore a backup with a confirmation dialog
- Before restoring, create a `pre-restore` snapshot.
- Restore must affect only the active profile.
- Add read-only checks or tests proving one user's backup/restore cannot touch another user.

### 4. UI Glitch Audit

After implementing the fixes, audit the app UI for abnormalities:

- Start the dev server and test primary routes: `/select`, `/`, `/workout`, `/food`, `/history`, `/settings`.
- Test mobile width around 390 px and desktop width.
- Check console errors.
- Check bottom nav, dialogs/sheets, template editor, food tracker, date navigation, and history.
- Specifically check Sunday 2026-05-24.
- Check no-text-overlap issues in compact buttons/cards.
- Run `npm run lint` and `npm run build`.

If using browser automation, include screenshots or notes in the results file. If a browser tool is unavailable, document manual smoke-test steps performed.

### 5. Food Section Clutter Ideas

The user asked for ideas on how to fix food-section clutter.

In the results file, include concrete suggestions. Implement only low-risk cleanup if it is clearly beneficial and does not distract from data safety.

Ideas to evaluate:

- Collapse water into a compact top strip.
- Make totals a sticky compact macro header with expandable details.
- Move manual macro entry behind a single plus/menu action.
- Show "Recent" first and make full preset library search-first instead of always showing many chips.
- Split food library management from daily logging.
- Make recipes a separate tab or collapsible section.
- Hide advanced macros behind an "expanded macros" toggle while keeping calories/protein visible by default.
- Add "favorites" or "pin foods" so the daily screen shows fewer choices.
- Make "My foods" include categorized and uncategorized custom foods with filters, not just uncategorized custom foods.
- Consider a meal grouping model: Breakfast/Lunch/Dinner/Snacks, with collapsed entries.

### 6. Template Edits Must Not Change Older Logs

User requirement: changing any exercise/template in the past or editing any template should not affect older logs.

Current issue: `WorkoutLog` stores only `templateId` and `entries`. History and workout display derive names/exercises from the current templates.

Implement immutable workout snapshots:

- Extend `WorkoutLog` with a template/exercise snapshot captured when a workout log is first created or first committed.
- Snapshot must include template name, category, focus, and exercise definitions used on that date.
- History should render from the snapshot first, then fall back to current templates/legacy names.
- Workout page should use the snapshot for committed historical logs so old workouts remain readable/editable even after templates change.
- Editing a template in Settings should affect future logs only.
- If a user changes the template for a committed past date, be explicit: either require confirmation and create a new snapshot for that date, or preserve the old log and add new entries separately.
- Add a migration for existing logs that backfills snapshots from current templates where possible without changing raw set entries.

### 7. Shared Exercise Progress Must Align Across Templates

User requirement: if two templates share the same exercise, progress data should align. Example: progress in "Barbell Curl" in Pull A Strength should sync when that exercise appears in another template.

Current issue: alignment only works when the same exercise ID or alias group is used. For example, `barbell-curl` and `ez-bar-curl` are currently separate unless aliases are added.

Implement a robust exercise identity model:

- Prefer canonical exercise IDs or a canonical ID field for progress lookup.
- Extend `EXERCISE_ALIASES` for renamed/merged exercises.
- Ensure PRs, last-session lookup, history, charts, and progression advice use the canonical group.
- Avoid merging distinct exercises accidentally just because names are similar.
- If two template exercises are meant to share progress, give them the same canonical ID or explicit alias.
- Add tests for a shared exercise appearing in two templates.

### 8. Data Recovery And Maintenance Must Be Treated As Critical

For every persistence change:

- Preserve existing JSON compatibility.
- Add schema migrations in `ensureSchema()`.
- Add validation before accepting imported JSON.
- Prevent empty client state from overwriting real server state.
- Keep uid-scoped localStorage cache behavior and extend it to any new localStorage keys.
- Add explicit recovery notes to the results file.

Do not run old one-off scripts such as `scripts/recover-shubham.mjs` unless the user explicitly asks.

### 9. Exercise Cleanup And Assisted-Exercise Progression

User requirement:

- Make duplicate/renamed exercises the same where intended.
- Merge "EZ Bar Curl / Barbell Curl" with "Barbell Curl".
- Clean up "Machine Chest Press" naming/identity where it refers to the user's intended chest press movement.
- Assisted dips and assisted pull-ups should show progress upward when assistance weight decreases.

Implement carefully:

- Use aliases or canonical IDs so historical logs stay connected.
- Suggested alias addition: map `ez-bar-curl` to `barbell-curl`, and update display names so the same exercise is not split.
- Review `machine-press`, `incline-bb`, `tricep-dips`, `lat-pulldown`, and `wide-pulldown` before merging anything.
- Do not merge machine chest press with dips or pull-ups unless the data clearly says they are the same movement. The user likely means assisted movements need inverted progress charts, not that chest press is the same as them.
- Add metadata for load direction, for example:
  - normal load: higher weight is better
  - assistance load: lower assistance is better
- Apply assistance-load behavior to assisted dips and assisted pull-ups/pulldown variants where the logged weight represents assistance.
- Update `lib/pr.ts`, PR badges, chart metric values, labels, and progression hints so assisted exercises are intuitive.
- Consider labeling assisted chart values as "Assistance" or "Effective load" so the user does not misread the graph.
- Add tests for an assisted exercise where 40 kg assistance followed by 35 kg assistance counts as progress.

## Expected Verification

Run at least:

- `npm run lint`
- `npm run build`

Add focused tests if the project has or gains a test setup. If no formal test setup exists, add lightweight pure-function tests or scripts only if they are justified by the data-risk changes.

Manually or with browser automation verify:

- Fresh profile creation starts with zero templates.
- Existing profile data remains intact.
- Sunday 2026-05-24 workout is not blank/stuck.
- Editing a template does not alter older workout display.
- Shared exercise history is visible across templates.
- Assisted dips/pull-ups progress direction is correct.
- Daily/weekly backups are created and restorable for only the active user.
- Food page has no obvious text overlap or unusable clutter regression.
