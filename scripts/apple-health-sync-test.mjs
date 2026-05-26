#!/usr/bin/env node
// Pure normalization regression test for the Apple Health Shortcut sync
// payload. Mirrors lib/apple-health-sync.ts:normalizeAppleHealthSyncPayload
// verbatim so it runs without a TypeScript toolchain. If the TS helper
// changes, mirror the change here and re-run.
//
// Run with:
//   node scripts/apple-health-sync-test.mjs

const DATE_KEYS = ["date", "setDate", "formattedDate", "Date"];
const DATE_KEYS_LIST = DATE_KEYS.join(", ");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class AppleHealthSyncError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AppleHealthSyncError";
  }
}

function trimmedString(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length === 0 ? null : t;
}

function asNonNegativeFiniteNumber(value) {
  if (value === undefined || value === null) return 0;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return n;
}

function pickDateFromPayload(payload) {
  for (const key of DATE_KEYS) {
    const raw = payload[key];
    const str = trimmedString(raw);
    if (str) return str;
  }
  return null;
}

function normalizeAppleHealthSyncPayload(payload) {
  const dateRaw = pickDateFromPayload(payload);
  if (!dateRaw) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      `date is required (accepted keys: ${DATE_KEYS_LIST})`
    );
  }
  if (!DATE_RE.test(dateRaw)) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      `date must match yyyy-MM-dd (accepted keys: ${DATE_KEYS_LIST})`
    );
  }
  const steps = asNonNegativeFiniteNumber(payload.steps);
  if (steps === null) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "steps must be a finite non-negative number"
    );
  }
  const activeEnergyKcal = asNonNegativeFiniteNumber(payload.activeEnergyKcal);
  if (activeEnergyKcal === null) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "activeEnergyKcal must be a finite non-negative number"
    );
  }
  const sourceRaw = trimmedString(payload.source);
  const source = sourceRaw ?? "apple_shortcuts";

  const profileId = trimmedString(payload.profileId);
  const profileName = trimmedString(payload.profileName);
  if (!profileId && !profileName) {
    throw new AppleHealthSyncError(
      "invalid_payload",
      "profileId or profileName is required"
    );
  }

  return {
    profileId,
    profileName,
    date: dateRaw,
    source,
    steps,
    activeEnergyKcal,
  };
}

const basePayload = {
  profileName: "Shubham",
  steps: 9350,
  activeEnergyKcal: 548,
  source: "apple_shortcuts",
};

let pass = 0;
let fail = 0;
const failures = [];

function ok(label, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  ok    ${label}`);
  } catch (err) {
    fail += 1;
    failures.push({ label, err });
    console.log(`  FAIL  ${label}: ${err.message}`);
  }
}

function expectAccepts(label, payload, expectedDate) {
  ok(label, () => {
    const result = normalizeAppleHealthSyncPayload(payload);
    if (result.date !== expectedDate) {
      throw new Error(
        `expected date ${expectedDate} but got ${result.date}`
      );
    }
    if (result.profileName !== "Shubham") {
      throw new Error(
        `profileName changed to ${result.profileName}`
      );
    }
  });
}

function expectRejects(label, payload, expectedMessageFragment) {
  ok(label, () => {
    try {
      normalizeAppleHealthSyncPayload(payload);
    } catch (err) {
      if (!(err instanceof AppleHealthSyncError)) {
        throw new Error(
          `expected AppleHealthSyncError but got ${err.name}: ${err.message}`
        );
      }
      if (err.code !== "invalid_payload") {
        throw new Error(`expected code invalid_payload but got ${err.code}`);
      }
      if (
        expectedMessageFragment &&
        !err.message.includes(expectedMessageFragment)
      ) {
        throw new Error(
          `error message ${JSON.stringify(err.message)} did not include ${JSON.stringify(expectedMessageFragment)}`
        );
      }
      return;
    }
    throw new Error("expected normalize to throw but it returned");
  });
}

console.log("apple-health-sync normalization");

expectAccepts(
  "canonical { date } passes",
  { ...basePayload, date: "2026-05-26" },
  "2026-05-26"
);
expectAccepts(
  "alias { setDate } passes",
  { ...basePayload, setDate: "2026-05-26" },
  "2026-05-26"
);
expectAccepts(
  "alias { formattedDate } passes",
  { ...basePayload, formattedDate: "2026-05-26" },
  "2026-05-26"
);
expectAccepts(
  "alias { Date } passes",
  { ...basePayload, Date: "2026-05-26" },
  "2026-05-26"
);
expectAccepts(
  "canonical { date } wins when alias also supplied",
  { ...basePayload, date: "2026-05-26", setDate: "2099-01-01" },
  "2026-05-26"
);
expectAccepts(
  "alias picks first non-empty in priority order",
  {
    ...basePayload,
    date: "   ",
    setDate: "",
    formattedDate: "2026-05-26",
  },
  "2026-05-26"
);
expectRejects(
  "missing all date fields rejected",
  { ...basePayload },
  "date is required"
);
expectRejects(
  "bad date format (2026/05/26) rejected",
  { ...basePayload, date: "2026/05/26" },
  "yyyy-MM-dd"
);
expectRejects(
  "bad date format (26-05-2026) rejected",
  { ...basePayload, setDate: "26-05-2026" },
  "yyyy-MM-dd"
);
expectRejects(
  "negative steps rejected",
  { ...basePayload, date: "2026-05-26", steps: -1 },
  "steps"
);
expectRejects(
  "NaN steps rejected",
  { ...basePayload, date: "2026-05-26", steps: "abc" },
  "steps"
);
expectRejects(
  "missing profileId and profileName rejected",
  { date: "2026-05-26", steps: 1, activeEnergyKcal: 1 },
  "profileId or profileName"
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exitCode = 1;
}
