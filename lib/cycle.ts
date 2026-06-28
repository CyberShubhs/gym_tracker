import type { Settings } from "./types";
import { addDays } from "./utils";

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad).getTime();
  const db = new Date(by, bm - 1, bd).getTime();
  return Math.round((da - db) / 86400000);
}

export function defaultCycleFor(settings: Settings, fromDate: string): {
  cycle: string[];
  anchor: string;
} {
  const dow = new Date(
    Number(fromDate.slice(0, 4)),
    Number(fromDate.slice(5, 7)) - 1,
    Number(fromDate.slice(8, 10))
  ).getDay();
  const cycle: string[] = [];
  for (let i = 0; i < 7; i++) {
    cycle.push(settings.schedule[(dow + i) % 7] ?? "rest-full");
  }
  return { cycle, anchor: fromDate };
}

// Resolve `date` against a single (cycle, anchor) pair using modular
// arithmetic. Extracted so segments share the same logic as the legacy
// global fields.
function resolveCycleAt(
  cycle: string[],
  anchor: string,
  date: string
): string | null {
  if (!cycle || cycle.length === 0) return null;
  const days = daysBetween(date, anchor);
  const len = cycle.length;
  const idx = ((days % len) + len) % len;
  return cycle[idx];
}

// Find the segment that should govern planning for `date`. Segments are
// ordered by effectiveFrom — we return the latest one whose
// effectiveFrom <= date. Returns null when no segment applies.
export function activeCycleSegmentFor(
  segments: Settings["cycleSegments"] | undefined,
  date: string
): { cycle: string[]; anchor: string; effectiveFrom: string } | null {
  if (!segments || segments.length === 0) return null;
  let best: (typeof segments)[number] | null = null;
  for (const s of segments) {
    if (!s.cycle || s.cycle.length === 0) continue;
    if (s.effectiveFrom <= date) {
      if (!best || s.effectiveFrom > best.effectiveFrom) best = s;
    }
  }
  return best
    ? {
        cycle: best.cycle,
        anchor: best.anchor,
        effectiveFrom: best.effectiveFrom,
      }
    : null;
}

export function plannedTemplate(date: string, settings: Settings): string {
  // 1) Newest model: date-scoped segments. The latest segment with
  //    effectiveFrom <= date wins. Crucially, this means a segment
  //    introduced on date D never reaches back to dates before D.
  const seg = activeCycleSegmentFor(settings.cycleSegments, date);
  if (seg) {
    const id = resolveCycleAt(seg.cycle, seg.anchor, date);
    if (id) return id;
  }
  // 2) Legacy global cycle + anchor (kept so users with existing saved
  //    state keep planning the same way until a new segment is added).
  if (settings.cycle && settings.cycle.length > 0 && settings.cycleAnchor) {
    const id = resolveCycleAt(
      settings.cycle,
      settings.cycleAnchor,
      date
    );
    if (id) return id;
  }
  // 3) Fallback: weekday schedule.
  const dow = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10))
  ).getDay();
  return settings.schedule[dow] ?? "rest-full";
}

// Snapshot of the cycle currently active for `date`, falling back through
// segments → legacy cycle/anchor → derived-from-weekday-schedule.
function deriveActiveCycle(
  settings: Settings,
  date: string
): { cycle: string[]; anchor: string } {
  const seg = activeCycleSegmentFor(settings.cycleSegments, date);
  if (seg) return { cycle: seg.cycle, anchor: seg.anchor };
  if (settings.cycle && settings.cycle.length > 0 && settings.cycleAnchor) {
    return { cycle: settings.cycle, anchor: settings.cycleAnchor };
  }
  return defaultCycleFor(settings, date);
}

/**
 * Compute the cycle/anchor change needed so that `date` plans `templateId`,
 * keeping every other position in the cycle the same. Returns null if the
 * template isn't part of the cycle (no shift possible).
 *
 * NOTE: Prefer `shiftFutureCycleTo` for picks coming from the workout
 * page — it appends a dated segment that only affects future dates,
 * rather than rewriting the single global anchor (which can move past
 * planned days too).
 */
export function shiftCycleTo(
  date: string,
  templateId: string,
  settings: Settings
): { cycle: string[]; cycleAnchor: string } | null {
  let cycle = settings.cycle;
  if (!cycle || cycle.length === 0) {
    cycle = defaultCycleFor(settings, date).cycle;
  }
  const idx = cycle.indexOf(templateId);
  if (idx < 0) return null;
  const newAnchor = addDays(date, -idx);
  return { cycle, cycleAnchor: newAnchor };
}

// Build the future-only segment patch that makes `date` resolve to
// `cycle[idx]` and rolls subsequent dates along `cycle` from there, keeping
// every segment strictly before `date` untouched. Returns `null` when the
// patch wouldn't actually change anything (so re-picking the already-planned
// template is a genuine no-op and doesn't churn `cycleSegments`).
function buildFutureSegmentPatch(
  cycle: string[],
  idx: number,
  date: string,
  settings: Settings
): { cycleSegments: NonNullable<Settings["cycleSegments"]> } | null {
  const newAnchor = addDays(date, -idx);
  const existing = settings.cycleSegments ?? [];
  // Keep history strictly before `date`. Any segment with effectiveFrom
  // >= `date` is being overridden by this pick so it's dropped — the new
  // segment supersedes it (this is what lets a re-pick on the same date
  // replace its own segment rather than stacking duplicates).
  const past = existing.filter((s) => s.effectiveFrom < date);
  const newSegment = {
    effectiveFrom: date,
    cycle: [...cycle],
    anchor: newAnchor,
    createdAt: new Date().toISOString(),
  };
  const candidate = [...past, newSegment];
  // Structural no-op check (ignoring createdAt): if the resulting segment
  // list is identical to the existing one, there's nothing to persist.
  const sameSegment = (
    a: (typeof candidate)[number],
    b: (typeof candidate)[number]
  ) =>
    a.effectiveFrom === b.effectiveFrom &&
    a.anchor === b.anchor &&
    a.cycle.length === b.cycle.length &&
    a.cycle.every((c, i) => c === b.cycle[i]);
  if (
    existing.length === candidate.length &&
    existing.every((s, i) => sameSegment(s, candidate[i]))
  ) {
    return null;
  }
  return { cycleSegments: candidate };
}

/**
 * Future-only cycle shift. Picking `templateId` on `date` rotates the
 * cycle so that:
 *   - `date` resolves to `templateId`
 *   - dates after `date` follow the same cycle order from there
 *   - dates strictly before `date` are NEVER affected (they fall back to
 *     the segment / global cycle / schedule that was already in effect)
 *
 * The forward roll is rebuilt from the user's weekday `schedule` — the split
 * they actually edit in Settings — rather than from whatever cycle the
 * accumulated segments happen to describe. That keeps a pick rolling future
 * days along the *current* split even when older segments have drifted out of
 * sync with it (the most common reason a pick used to update today but leave
 * future days on the old plan). If the template isn't on the weekday schedule
 * (e.g. an extra / optional template), we fall back to the currently-active
 * cycle so it still rolls forward when that cycle knows the template.
 *
 * Returns a patch for Settings (a new `cycleSegments` array) or `null` if the
 * template is part of neither (the caller should still call
 * `ensureWorkoutLog(date, id)` so the picked date shows the template), or if
 * the patch wouldn't change anything.
 *
 * Idempotent: re-picking the template already planned for `date` is a no-op.
 */
export function shiftFutureCycleTo(
  date: string,
  templateId: string,
  settings: Settings
): { cycleSegments: NonNullable<Settings["cycleSegments"]> } | null {
  // Prefer the weekday schedule so the roll always follows the live split.
  const scheduleCycle = defaultCycleFor(settings, date).cycle;
  const schedIdx = scheduleCycle.indexOf(templateId);
  if (schedIdx >= 0) {
    return buildFutureSegmentPatch(scheduleCycle, schedIdx, date, settings);
  }
  // Not on the schedule — fall back to the active cycle so off-schedule
  // templates that are still part of an active rotation roll forward too.
  const { cycle } = deriveActiveCycle(settings, date);
  const idx = cycle.indexOf(templateId);
  if (idx < 0) return null;
  return buildFutureSegmentPatch(cycle, idx, date, settings);
}
