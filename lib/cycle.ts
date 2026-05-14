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

export function plannedTemplate(date: string, settings: Settings): string {
  const cycle = settings.cycle;
  const anchor = settings.cycleAnchor;
  if (cycle && cycle.length > 0 && anchor) {
    const days = daysBetween(date, anchor);
    const len = cycle.length;
    const idx = ((days % len) + len) % len;
    return cycle[idx];
  }
  // Fallback: weekday schedule
  const dow = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10))
  ).getDay();
  return settings.schedule[dow] ?? "rest-full";
}

/**
 * Compute the cycle/anchor change needed so that `date` plans `templateId`,
 * keeping every other position in the cycle the same. Returns null if the
 * template isn't part of the cycle (no shift possible).
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
