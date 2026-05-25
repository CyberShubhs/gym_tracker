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

/**
 * Future-only cycle shift. Picking `templateId` on `date` rotates the
 * cycle so that:
 *   - `date` resolves to `templateId`
 *   - dates after `date` follow the same cycle order from there
 *   - dates strictly before `date` are NEVER affected (they fall back to
 *     the segment / global cycle / schedule that was already in effect)
 *
 * Returns a patch for Settings (a new `cycleSegments` array) or `null` if
 * the template isn't part of the cycle (the caller should still call
 * `ensureWorkoutLog(date, id)` so the picked date shows the template).
 *
 * Idempotent: re-picking the template that's already planned for `date`
 * still results in a no-op patch (anchor unchanged).
 */
export function shiftFutureCycleTo(
  date: string,
  templateId: string,
  settings: Settings
): { cycleSegments: NonNullable<Settings["cycleSegments"]> } | null {
  const { cycle } = deriveActiveCycle(settings, date);
  const idx = cycle.indexOf(templateId);
  if (idx < 0) return null;
  const newAnchor = addDays(date, -idx);
  const existing = settings.cycleSegments ?? [];
  // Keep history strictly before `date`. Any segment with effectiveFrom
  // >= `date` is being overridden by this pick so it's dropped — the new
  // segment supersedes it.
  const past = existing.filter((s) => s.effectiveFrom < date);
  const newSegment = {
    effectiveFrom: date,
    cycle: [...cycle],
    anchor: newAnchor,
    createdAt: new Date().toISOString(),
  };
  // No-op check: if the most recent past segment already resolves `date`
  // to `templateId` AND has the same cycle, don't append a redundant
  // segment — keeps the history clean.
  if (past.length > 0) {
    const last = past[past.length - 1];
    const sameCycle =
      last.cycle.length === cycle.length &&
      last.cycle.every((c, i) => c === cycle[i]);
    if (sameCycle) {
      const wouldResolve = resolveCycleAt(last.cycle, last.anchor, date);
      if (wouldResolve === templateId && existing.length === past.length) {
        return null;
      }
    }
  }
  return { cycleSegments: [...past, newSegment] };
}
