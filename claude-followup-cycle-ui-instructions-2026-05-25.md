# Claude Follow-Up Instructions - Cycle + Workout Card UI - 2026-05-25

Date context: Today is Monday, 2026-05-25 in Australia/Melbourne.

When you finish, create an output file with this same base name ending in `-results.md`:

`claude-followup-cycle-ui-instructions-2026-05-25-results.md`

After implementation and verification, commit the intended changes and push the current branch to git. Do not force-push. Do not include unrelated local changes. If the branch has no upstream, set the upstream to the matching remote branch name.

## Project Rules

- Read `AGENTS.md`, `CLAUDE.md`, and the previous files first:
  - `claude-fix-instructions-2026-05-25.md`
  - `claude-fix-instructions-2026-05-25-results.md`
- This project uses Next.js `16.2.4` and React `19.2.4`. Before editing, read the relevant local docs under `node_modules/next/dist/docs/`, especially:
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- Preserve existing user data. Data recovery and workout history are still the highest priority.
- Do not run destructive DB scripts or touch production data without explicit user approval.
- Keep the fix focused. This is a follow-up for workout cycle behavior and the exercise-card layout only.

## User-Reported Regression

After the last fixes, choosing a workout for a day no longer shifts the future cycle.

Expected behavior:

- If the user changes a day, for example Tuesday to `Pull A`, the following future day should continue with the next workout in the user’s cycle, for example Wednesday should become `Push A` if that is the next workout in the configured cycle.
- Past days must not change when the user changes today or a future day.
- Existing committed workout logs and their immutable snapshots must not change.
- Future uncommitted days should move accordingly from the changed date onward.

Current likely cause:

- `app/workout/page.tsx` removed the previous `shiftCycleTo()` path entirely.
- That fixed the Sunday 2026-05-24 immediate selection issue, but it also removed future schedule shifting.
- `lib/cycle.ts` still has global `cycle` / `cycleAnchor` helpers, but a single global anchor can affect past planned dates too. That is not acceptable now.

## Required Fix 1: Future-Only Cycle Shifting

Implement a date-scoped cycle model so selecting a workout on date `D` affects date `D` and future uncommitted dates, not the past.

Requirements:

- Selecting a template on a date should immediately show that template on that date.
- Future dates should follow the workout cycle from that selected template.
- Dates before the selected date should keep their previous planned workout unless they already have committed logs/snapshots.
- Committed logs should always prefer their stored `templateId` and `templateSnapshot`.
- Do not let a future shift rewrite historical `WorkoutLog` entries or snapshots.
- Do not reintroduce the Sunday 2026-05-24 bug where a picked workout is invisible/stuck.
- Preserve zero-template/new-profile behavior from the previous fix.

Recommended design:

- Add a versioned cycle history to `Settings`, for example:
  - `cycleSegments?: Array<{ effectiveFrom: string; cycle: string[]; anchor: string; createdAt?: string }>`
- Update `plannedTemplate(date, settings)` so it chooses the latest segment with `effectiveFrom <= date`; if none exists, fall back to existing `settings.cycle` / `cycleAnchor`, then weekday schedule.
- Add a helper like `shiftFutureCycleTo(date, templateId, settings)`:
  - derive the active cycle for `date`
  - compute the new anchor so `date` resolves to `templateId`
  - append or replace the segment whose `effectiveFrom` is `date`
  - prune later duplicate/no-op segments if needed
  - never change entries before `date`
- In `app/workout/page.tsx`, restore future shifting through the new helper while still calling `ensureWorkoutLog(date, id)` so the selected date updates immediately.
- If the selected template is not part of the active cycle, make only a date-specific log change and do not corrupt the cycle. Document this case in the results file.
- Do not use only the old global `shiftCycleTo()` because that can move past planned dates.

Testing requirements:

- Add focused tests for cycle planning if there is a test harness. If no harness exists, add a lightweight script or pure-function test only if it fits the project.
- Include a test/scenario for:
  - previous segment starts before Tuesday
  - user picks `Pull A` on Tuesday
  - Tuesday resolves to `Pull A`
  - Wednesday resolves to the next workout in the cycle, e.g. `Push A` for the user’s configured order
  - Monday/past date remains unchanged
- Include a regression check for Sunday 2026-05-24: picking a workout on that date remains visible immediately.

## Required Fix 2: Use The Empty Space In The Exercise Card

User attached a screenshot showing a large unused blank area in the top half of the workout exercise card. The card shows the exercise title and metadata on the left, small PR badges/chart controls at the top right, then a large empty right-side area before the set inputs begin.

Relevant files:

- `components/exercise-card.tsx`
- `components/pr-ladder.tsx`
- `components/exercise-pr-detail.tsx`
- possibly `components/exercise-carousel.tsx` if stage height or side-face rendering contributes to blank space

UI requirements:

- Redesign the top of `ExerciseCard` so the card does not have a large blank right area.
- Keep all current functionality: tutorial link, equipment, target, last session, variant picker, PR badges, training guide, PR ladder, progress chart, set inputs, progression hint, rest timer, notes.
- Use the available space for useful workout information, not decoration.
- Make the mobile layout the priority, because the screenshot is mobile.
- Do not create nested cards.
- Ensure text does not overlap, truncate, or overflow awkwardly on narrow iPhone widths.
- Keep touch targets usable.
- Verify on about 390 px wide mobile and desktop.

Suggested layout:

- Make the card header a compact vertical layout:
  - first row: title/tutorial link + small action buttons
  - second row: PR badges and mini trend, wrapping cleanly
  - third row: compact stat tiles/chips for target, last session, variant/equipment
- Or use a two-column header where the right column contains a useful mini stats block that fills the area: trend chart, current/best weight, and PR actions.
- Move the variant picker and last-session details into a compact full-width stat row if that removes the blank area.
- If `PrLadder` is contributing to the odd spacing, make it render as a compact chip or integrate it into the stat row.
- Avoid leaving a tall left metadata stack beside a short right controls stack.

Also check safe-area behavior:

- In the screenshot, the iOS Dynamic Island/status area overlaps visually near the top. Verify the app header has enough safe-area padding in PWA/mobile Safari.
- If there is a real overlap, adjust spacing in `components/app-shell.tsx` or route header spacing without creating excessive top padding on normal browsers.

## Results File Requirements

Write `claude-followup-cycle-ui-instructions-2026-05-25-results.md` with:

- Summary of changes.
- Files changed.
- Exact cycle behavior implemented.
- Before/after explanation for selecting Tuesday as `Pull A` and what Wednesday becomes.
- Confirmation that past planned days and committed snapshots do not change.
- Sunday 2026-05-24 regression check.
- Mobile workout-card layout notes and any screenshots/manual observations.
- Verification commands and results.
- Git commit hash and push result.
- Remaining risks or questions.

## Verification Commands

Run at least:

- `npm run lint`
- `npm run build`

If lint still has baseline issues, prove whether they are pre-existing and state that clearly. Do not claim lint is clean unless it exits successfully.

Before committing:

- `git status --short`
- review `git diff`
- ensure no unrelated changes are included

Then commit and push:

- Use a concise commit message such as `fix: restore future workout cycle shifts`
- Push the current branch only
