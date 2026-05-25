#!/usr/bin/env node
// Pure-function regression test for the cycle planning rules.
//
// Run with:
//   node scripts/cycle-test.mjs
//
// We can't import the TS source directly without a build step, so the
// helpers below are deliberately copied verbatim (kept in sync with
// lib/cycle.ts). If lib/cycle.ts changes, mirror the change here and
// re-run this script.

const SCHEDULE = {
  0: "rest-full",
  1: "push-strength",
  2: "pull-strength",
  3: "rest-light",
  4: "push-hyper",
  5: "pull-width",
  6: "upper-pump",
};

function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (new Date(ay, am - 1, ad).getTime() -
      new Date(by, bm - 1, bd).getTime()) /
      86_400_000
  );
}

function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function resolveCycleAt(cycle, anchor, date) {
  const days = daysBetween(date, anchor);
  const len = cycle.length;
  const idx = ((days % len) + len) % len;
  return cycle[idx];
}

function defaultCycleFor(settings, fromDate) {
  const [y, m, d] = fromDate.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const cycle = [];
  for (let i = 0; i < 7; i++) cycle.push(settings.schedule[(dow + i) % 7]);
  return { cycle, anchor: fromDate };
}

function activeSegment(segments, date) {
  if (!segments || segments.length === 0) return null;
  let best = null;
  for (const s of segments) {
    if (!s.cycle || s.cycle.length === 0) continue;
    if (s.effectiveFrom <= date) {
      if (!best || s.effectiveFrom > best.effectiveFrom) best = s;
    }
  }
  return best;
}

function plannedTemplate(date, settings) {
  const seg = activeSegment(settings.cycleSegments, date);
  if (seg) {
    const id = resolveCycleAt(seg.cycle, seg.anchor, date);
    if (id) return id;
  }
  if (settings.cycle && settings.cycle.length > 0 && settings.cycleAnchor) {
    const id = resolveCycleAt(settings.cycle, settings.cycleAnchor, date);
    if (id) return id;
  }
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return settings.schedule[dow] ?? "rest-full";
}

function deriveActiveCycle(settings, date) {
  const seg = activeSegment(settings.cycleSegments, date);
  if (seg) return { cycle: seg.cycle, anchor: seg.anchor };
  if (settings.cycle && settings.cycle.length > 0 && settings.cycleAnchor) {
    return { cycle: settings.cycle, anchor: settings.cycleAnchor };
  }
  return defaultCycleFor(settings, date);
}

function shiftFutureCycleTo(date, templateId, settings) {
  const { cycle } = deriveActiveCycle(settings, date);
  const idx = cycle.indexOf(templateId);
  if (idx < 0) return null;
  const newAnchor = addDays(date, -idx);
  const existing = settings.cycleSegments ?? [];
  const past = existing.filter((s) => s.effectiveFrom < date);
  const newSegment = {
    effectiveFrom: date,
    cycle: [...cycle],
    anchor: newAnchor,
  };
  return { cycleSegments: [...past, newSegment] };
}

let failed = 0;
function assert(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}\n     got: ${actual}\n     want: ${expected}`
  );
}

// --- Test 1: 2026-05-24 (Sunday) — picking pull-strength shows it immediately.
{
  const settings = { schedule: SCHEDULE };
  assert(
    "default plan for Sunday 2026-05-24 is rest-full",
    plannedTemplate("2026-05-24", settings),
    "rest-full"
  );
  const patch = shiftFutureCycleTo("2026-05-24", "pull-strength", settings);
  if (!patch) throw new Error("expected a patch");
  const next = { ...settings, ...patch };
  assert(
    "Sunday 2026-05-24 after pick = pull-strength",
    plannedTemplate("2026-05-24", next),
    "pull-strength"
  );
}

// --- Test 2: picking on Tuesday only changes Tuesday and after.
{
  const tuesday = "2026-05-26";
  const monday = "2026-05-25";
  const wednesday = "2026-05-27";
  const lastTuesday = "2026-05-19";

  const settings = { schedule: SCHEDULE };
  const before = {
    monday: plannedTemplate(monday, settings),
    tuesday: plannedTemplate(tuesday, settings),
    wednesday: plannedTemplate(wednesday, settings),
    lastTuesday: plannedTemplate(lastTuesday, settings),
  };

  // Pick push-hyper on Tuesday (different from the default pull-strength).
  const patch = shiftFutureCycleTo(tuesday, "push-hyper", settings);
  if (!patch) throw new Error("expected a patch for push-hyper");
  const next = { ...settings, ...patch };

  assert(
    "Tuesday resolves to picked template (push-hyper)",
    plannedTemplate(tuesday, next),
    "push-hyper"
  );

  // Wednesday should be the next entry in the active cycle. With
  // defaultCycleFor(Tuesday-DOW), cycle = [schedule[2], schedule[3],
  // schedule[4], ...] = [pull-strength, rest-light, push-hyper, ...].
  // idx of push-hyper = 2, so newAnchor = Tuesday - 2 days = Sunday.
  // Wednesday is +1 from Tuesday, so cycle[(1+2) % 7] = cycle[3] =
  // pull-width. The key contract is "Wednesday is the next-in-cycle
  // after the picked Tuesday", whichever id that resolves to.
  const wedAfter = plannedTemplate(wednesday, next);
  console.log(`info Wednesday after pick = ${wedAfter}`);

  // Monday must NOT change — no segment governs it (effectiveFrom > Mon).
  assert(
    "Monday before the pick is unchanged",
    plannedTemplate(monday, next),
    before.monday
  );
  // Same for a date a week earlier (last Tuesday).
  assert(
    "last Tuesday is unchanged",
    plannedTemplate(lastTuesday, next),
    before.lastTuesday
  );

  // Re-pick on a later date and confirm earlier segment still wins for
  // dates between the two picks (past stays put).
  const wedPatch = shiftFutureCycleTo(wednesday, "pull-width", next);
  if (!wedPatch) throw new Error("expected a patch for pull-width");
  const after = { ...next, ...wedPatch };
  assert(
    "Tuesday still resolves to push-hyper after a Wednesday-pick",
    plannedTemplate(tuesday, after),
    "push-hyper"
  );
  assert(
    "Wednesday resolves to pull-width after Wednesday-pick",
    plannedTemplate(wednesday, after),
    "pull-width"
  );
  assert(
    "Monday still unchanged after Wednesday-pick",
    plannedTemplate(monday, after),
    before.monday
  );
}

// --- Test 3: template not in cycle -> null patch.
{
  const settings = { schedule: SCHEDULE };
  const patch = shiftFutureCycleTo(
    "2026-05-26",
    "this-id-does-not-exist",
    settings
  );
  if (patch !== null) {
    console.log("FAIL expected null patch for unknown template id");
    failed++;
  } else {
    console.log("ok   unknown template id returns null (no cycle shift)");
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll cycle-planning tests passed.");
