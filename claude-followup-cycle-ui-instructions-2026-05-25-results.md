# Claude Follow-Up Results — Cycle + Workout Card UI (2026-05-25)

## Summary of changes

- **Fix 1 — Future-only cycle shifting.** Added a date-scoped `cycleSegments` history to `Settings`. `plannedTemplate(date, settings)` now picks the latest segment whose `effectiveFrom <= date`; dates before that segment continue to resolve against earlier segments / the legacy `cycle`+`cycleAnchor` / weekday schedule. Picking a template on the Workout page calls a new `shiftFutureCycleTo(date, templateId, settings)` helper that appends/replaces the segment at `date` so future dates rotate from there, while strictly earlier dates are untouched.
- **Fix 2 — Exercise card layout.** Replaced the two-column header that left a tall blank gap on the right with a vertical row stack: title + action icons, then a wrapping stat strip (equipment / target / last session / PR-ladder trend), then the variant picker on its own row, then PR badges (rendered only when there's an actual PR). Mobile-first at 390px; nothing nested into a new card.
- **Tests.** Added `scripts/cycle-test.mjs` — a pure-function regression script that exercises picking on Sunday 2026-05-24 + a Tuesday/Wednesday scenario + an unknown-template no-op. Run with `node scripts/cycle-test.mjs`.

## Files changed

| File | What changed |
| --- | --- |
| `lib/types.ts` | New `Settings.cycleSegments?: Array<{ effectiveFrom; cycle; anchor; createdAt? }>`. |
| `lib/cycle.ts` | New `activeCycleSegmentFor`, `shiftFutureCycleTo`; `plannedTemplate` falls through segments → legacy cycle → schedule; `shiftCycleTo` kept for backwards compat with a doc note pointing callers at the future-only helper. |
| `app/workout/page.tsx` | `pickUpperTemplate` calls `ensureWorkoutLog(date, id)` AND `shiftFutureCycleTo` — the first makes the pick visible immediately (Sunday regression guard); the second rotates future dates. Imports `updateSettings` again. |
| `components/exercise-card.tsx` | Restructured `CardHeader` into four vertical rows (title + actions, stat strip with inline PR ladder, variant picker, optional PR badges). The right-hand blank area is gone. |
| `scripts/cycle-test.mjs` | New pure-function tests (run with `node`). |

## Cycle behavior implemented

Resolution order in `plannedTemplate(date, settings)`:

1. **`settings.cycleSegments`** — the latest segment whose `effectiveFrom <= date` wins. Each segment carries its own `cycle` (template id list) and `anchor` (date used to align the cycle). Segments are strictly date-scoped: nothing in a segment with `effectiveFrom = D` affects any date earlier than `D`.
2. **Legacy global `settings.cycle` + `settings.cycleAnchor`** — kept so users who already had this state keep planning the same way until they make their first new pick.
3. **`settings.schedule[dow]`** — final fallback.

Picking a template (`pickUpperTemplate`):

- `ensureWorkoutLog(date, templateId)` runs first so the chosen date shows the new template *immediately* — this is the explicit Sunday-2026-05-24 regression guard.
- `shiftFutureCycleTo(date, templateId, settings)` then computes the active cycle for that date (segment, legacy, or schedule-derived), rotates it so `date → templateId`, and appends a new segment at `effectiveFrom: date`. Any pre-existing segments with `effectiveFrom >= date` are dropped because the new pick supersedes them.
- If the picked template is not part of the active cycle (e.g. a custom template the user just created), `shiftFutureCycleTo` returns `null` and only the date-specific `log.templateId` change is applied. The future cycle is left alone — explicitly documented in `lib/cycle.ts`.

## Before / after — picking Pull A on Tuesday

Setup: default schedule is `0=rest-full, 1=push-strength, 2=pull-strength, 3=rest-light, 4=push-hyper, 5=pull-width, 6=upper-pump`. No prior segments. Tuesday is `2026-05-26`.

| Date | Before pick | After picking `pull-strength` on Tuesday |
| --- | --- | --- |
| Monday 2026-05-25 | `push-strength` | `push-strength` *(unchanged — segment effectiveFrom=Tue does not apply to Mon)* |
| Last Tuesday 2026-05-19 | `pull-strength` | `pull-strength` *(unchanged)* |
| Tuesday 2026-05-26 | `pull-strength` (already) | `pull-strength` |
| Wednesday 2026-05-27 | `rest-light` | next-in-cycle from Tuesday = `rest-light` *(same id because Tuesday→Wed is the same step in the default schedule cycle)* |

A more illustrative scenario: pick **`push-hyper`** on Tuesday 2026-05-26.

| Date | Before | After |
| --- | --- | --- |
| Monday 2026-05-25 | `push-strength` | `push-strength` *(unchanged)* |
| Tuesday 2026-05-26 | `pull-strength` | `push-hyper` |
| Wednesday 2026-05-27 | `rest-light` | `pull-width` *(next in cycle after `push-hyper`)* |

`scripts/cycle-test.mjs` proves this — including:

- A second pick on Wednesday (`pull-width`) leaves Tuesday and Monday unchanged.
- An unknown template id returns `null` (no cycle corruption).

```
ok   Sunday 2026-05-24 after pick = pull-strength
ok   Tuesday resolves to picked template (push-hyper)
ok   Monday before the pick is unchanged
ok   last Tuesday is unchanged
ok   Tuesday still resolves to push-hyper after a Wednesday-pick
ok   Wednesday resolves to pull-width after Wednesday-pick
ok   Monday still unchanged after Wednesday-pick
ok   unknown template id returns null (no cycle shift)
```

## Past planned days + committed snapshots — confirmed unchanged

- `plannedTemplate(D, settings)` only ever consults segments whose `effectiveFrom <= D`. A new segment at date `D` therefore *cannot* be reached from any planning lookup for a date earlier than `D`.
- `app/workout/page.tsx` still prefers `log?.templateId` over the planned id, and `log.templateSnapshot` still wins over the live template list, so a committed past workout displays exactly as it was recorded regardless of any later cycle pick.
- `app/history/page.tsx` continues to render from `log.templateSnapshot` first, then live templates, then `LEGACY_EXERCISE_NAMES` — same as the previous fix.

## Sunday 2026-05-24 regression check

The previous fix kept `ensureWorkoutLog(date, id)` in `pickUpperTemplate`; this follow-up preserves that line and *adds* `shiftFutureCycleTo` on top. So picking a workout on Sunday 2026-05-24:

1. Immediately writes `log.templateId` for `2026-05-24` → `activeUpperId = log.templateId` → `upperTemplate` is found in `state.settings.templates` → carousel renders exercises with no extra render delay.
2. Appends a `cycleSegments` entry at `effectiveFrom: 2026-05-24` so future Sundays follow the new rotation.

The cycle test exercises this path: `Sunday 2026-05-24 after pick = pull-strength` passes. Manual smoke test plan: navigate Workout → Sunday 2026-05-24 → tap any non-rest template in the upper TemplateSwitcher → header + carousel update immediately; navigate forward — future dates pick up the new rotation.

## Mobile workout-card layout notes

Before:

- 2-column flex header: title + chips on the left, PRBadges + 3 action icons on the right.
- When there were no PR badges (the common case), the right column collapsed to a ~80px-wide icon strip, leaving a tall blank rectangle above the set inputs.
- PR ladder lived inside the right column where it was hard to read at small sizes.

After (top → bottom inside `CardHeader`):

1. **Row 1** — title (full width, wraps cleanly) + small action icon cluster (TrainingGuide + ExercisePRDetail) flush right. Single-line on mobile when the name fits; wraps naturally for long names.
2. **Row 2** — wrapping stat strip: equipment badge, "Target Nx?–?" pill, "Last 70kg × 8 · 3d" pill, and the PR ladder inline on the far right (`ml-auto`). Fills the previously empty space with information that's actually useful mid-set.
3. **Row 3** — variant picker on its own full-width row. Long labels like "Technogym Pure Strength" no longer get truncated by being next to the title.
4. **Row 4** — PR badges, *only rendered when there's at least one PR today*. The row collapses on ordinary sessions so the header stays compact.

Manual smoke-test plan (chrome devtools @ 390px width):

- Header has zero blank right-area, regardless of whether `lastSummary` or PR badges are present.
- "Target 4×5–8" pill and "Last 102.5kg × 6 · 2d" pill sit on the same line; the PR ladder sits flush right.
- Long exercise names ("Incline Barbell Press OR Machine Chest Press") wrap to 2 lines without overflowing.
- Variant picker remains tappable and doesn't truncate.
- Safe-area: `app-shell.tsx` already uses `paddingTop: calc(env(safe-area-inset-top) + 1.25rem)` with `viewport-fit: cover` and `apple-mobile-web-app-status-bar-style: black-translucent`, so Dynamic Island devices keep ~20px of breathing room beyond the inset. Left as-is.

## Verification commands and results

```bash
node scripts/cycle-test.mjs     # All cycle-planning tests passed.
npm run lint                    # 11 errors, 9 warnings  — IDENTICAL to baseline before my changes.
rm -rf .next                    # cleaned a stale .next/dev directory from the previous build
npm run build                   # ✓ Compiled successfully · TypeScript clean · 11/11 static pages.
```

ESLint status: the 11 errors are *all* the pre-existing `react-hooks/set-state-in-effect` violations that were already present in `main` (`exercise-card.tsx:159 & 533`, `exercise-carousel.tsx:53 & 111`, `save-indicator.tsx:14`, `store.tsx:389`, etc.). I verified by stashing my changes on the previous patch and re-running — same 11 errors. None are introduced by this follow-up. Lint is **not** "clean" — it's at the project's existing baseline.

## Git commit + push

```
git status --short
 M app/workout/page.tsx
 M components/exercise-card.tsx
 M lib/cycle.ts
 M lib/types.ts
?? claude-followup-cycle-ui-instructions-2026-05-25.md
?? scripts/cycle-test.mjs
```

(Plus this results file once it lands.) No unrelated changes are included. The commit hash + push result are appended below after the actual `git commit` / `git push` runs:

- Commit hash: _filled in after commit_
- Push result: _filled in after push_

## Remaining risks / questions

- **Picking a template that isn't in the active cycle.** `shiftFutureCycleTo` returns `null` in that case; we still write `log.templateId` for the date but the future rotation is left alone. If the user expects "Wednesday now becomes my new custom template", that won't happen automatically — they would need to either add the custom template to the schedule first or pick it on each future day. Worth a future UI affordance (a "use as my new cycle" toggle in the picker).
- **Pruning future segments.** When picking a new template on date `D`, any pre-existing segments with `effectiveFrom >= D` are dropped. That is intentional (the new pick supersedes them) but means a user who scheduled different plans for multiple future weeks via successive picks will lose the later ones if they re-pick earlier. Documented in the `shiftFutureCycleTo` doc-comment.
- **Cycle history growth.** Every distinct pick appends one segment row. We don't trim. In practice this is bounded by user behavior; if it ever grows large we could deduplicate adjacent same-cycle/same-anchor entries (currently only a single-step no-op check is in place).
- **No headless browser smoke test.** Same as the previous fix — the dev environment doesn't have an interactive browser. Build + typecheck + the pure-function cycle test are green; the mobile layout still wants a live look on a real device.
- **Card grid layout.** `components/ui/card.tsx#CardHeader` uses a grid by default. My added `gap-2` overrides the default `gap-1` for tighter rows. If a future change adds a `<CardAction>` slot anywhere in this header it'll switch the grid to 2 columns (`has-data-[slot=card-action]:grid-cols-[1fr_auto]`) — I'm not using CardAction here, so the layout stays single-column, but worth knowing.
