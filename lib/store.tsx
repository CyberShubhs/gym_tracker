"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  AppleHealthDailyEntry,
  CustomFood,
  FoodEntry,
  FoodLog,
  FoodOverride,
  Recipe,
  Recovery,
  SetEntry,
  Settings,
  WeightLog,
  WorkoutLog,
  WorkoutTemplate,
  WorkoutTemplateSnapshot,
} from "./types";
import {
  DEFAULT_LEG_TEMPLATES,
  DEFAULT_SCHEDULE,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  LEG_TEMPLATES_SEED_VERSION,
  TEMPLATES_VERSION,
  needsTemplateMigration,
  validateTemplates,
} from "./defaults";
import {
  loadAppleHealthDaily,
  loadState,
  resetCurrentProfile,
  saveState,
} from "./actions";
import { plannedTemplate } from "./cycle";
import { exerciseIdGroup } from "./exercise-aliases";

const CACHE_KEY = "gym-tracker:cache:v4";
const ACTIVE_UID_COOKIE = "gt-uid";

// Cache is wrapped in an envelope tagged with the user id so a previous
// profile's data never leaks into a new profile during the brief window
// between cache hydration and the server response. The actual app state is
// nested under `state`.
type CacheEnvelope = {
  uid: string;
  state: AppState;
};

function getActiveUidFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie;
  if (!raw) return null;
  for (const part of raw.split(/;\s*/)) {
    if (part.startsWith(`${ACTIVE_UID_COOKIE}=`)) {
      const value = part.slice(ACTIVE_UID_COOKIE.length + 1);
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

// Seed the two starter leg templates exactly once per profile.
// - Only runs when the seed marker is missing AND the profile has zero
//   leg templates, so deleting a default never brings it back.
// - Never overwrites existing user-created leg templates.
function maybeSeedLegTemplates(
  s: AppState["settings"]
): AppState["settings"] {
  const current = s.legTemplates ?? [];
  const seeded = s.legTemplatesSeededVersion ?? 0;
  if (seeded >= LEG_TEMPLATES_SEED_VERSION) return s;
  if (current.length > 0) {
    // User has their own leg templates — just record that we've reached
    // the seed version so this branch never re-fires.
    return {
      ...s,
      legTemplatesSeededVersion: LEG_TEMPLATES_SEED_VERSION,
    };
  }
  return {
    ...s,
    legTemplates: DEFAULT_LEG_TEMPLATES,
    legTemplatesSeededVersion: LEG_TEMPLATES_SEED_VERSION,
  };
}

// Migrates user settings to the new upper-body plan whenever the templates
// version is stale OR the saved templates don't pass validation (e.g. an
// older JSON import wrote old names back over a freshly-migrated state).
// Workout / food / weight logs are untouched.
//
// IMPORTANT: A profile that has explicitly been seeded (the brand-new
// blank seed via BLANK_SETTINGS, or any prior successful run of this
// function) carries `userTemplatesSeededVersion >= TEMPLATES_VERSION` and
// is left alone. That is how a freshly-created profile keeps its empty
// `templates: []` instead of getting the global defaults poured back in.
function migrateSettings(s: AppState["settings"]): AppState["settings"] {
  const seeded = maybeSeedLegTemplates(s);
  if (
    !needsTemplateMigration(
      seeded.templates,
      seeded.schedule,
      seeded.templatesVersion,
      seeded.userTemplatesSeededVersion
    )
  ) {
    // Stamp the marker on first hydration even when nothing changes so
    // legacy profiles that already happen to pass validation never get
    // re-seeded by a future build.
    if ((seeded.userTemplatesSeededVersion ?? 0) >= TEMPLATES_VERSION) {
      return seeded;
    }
    return { ...seeded, userTemplatesSeededVersion: TEMPLATES_VERSION };
  }
  if (process.env.NODE_ENV !== "production") {
    const issues = seeded.templates
      ? validateTemplates(seeded.templates, seeded.schedule ?? {})
      : [{ code: "missing", detail: "no templates in saved settings" }];
    if (issues.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[gym-tracker] template validation failed — migrating to defaults",
        issues
      );
    }
  }
  return {
    ...seeded,
    templates: DEFAULT_TEMPLATES,
    schedule: DEFAULT_SCHEDULE,
    cycle: undefined,
    cycleAnchor: undefined,
    templatesVersion: TEMPLATES_VERSION,
    userTemplatesSeededVersion: TEMPLATES_VERSION,
  };
}

const INITIAL_STATE: AppState = {
  settings: DEFAULT_SETTINGS,
  workoutLogs: {},
  foodLogs: {},
  weightLogs: {},
  appleHealthDaily: {},
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type StoreContextValue = {
  hydrated: boolean;
  saveStatus: SaveStatus;
  state: AppState;
  ensureWorkoutLog: (date: string, templateId: string) => void;
  setSets: (date: string, exerciseId: string, sets: SetEntry[]) => void;
  setRecovery: (date: string, recovery: Recovery) => void;
  setDidOptional: (date: string, didOptional: boolean) => void;
  markRestComplete: (date: string, completed: boolean) => void;
  setFood: (date: string, patch: Partial<Omit<FoodLog, "date">>) => void;
  addFoodEntry: (
    date: string,
    entry: Omit<FoodEntry, "id" | "ts" | "date"> & {
      id?: string;
      ts?: number;
    }
  ) => void;
  addFoodEntries: (
    date: string,
    entries: Array<
      Omit<FoodEntry, "id" | "ts" | "date"> & { id?: string; ts?: number }
    >
  ) => void;
  updateFoodEntry: (
    date: string,
    entryId: string,
    patch: Partial<Omit<FoodEntry, "id" | "date">>
  ) => void;
  removeFoodEntry: (date: string, entryId: string) => void;
  copyFoodEntriesFrom: (sourceDate: string, targetDate: string) => void;
  setWeight: (date: string, weight: number, bodyFatPct?: number) => void;
  removeWeight: (date: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  upsertTemplate: (template: WorkoutTemplate) => void;
  removeTemplate: (id: string) => void;
  upsertLegTemplate: (template: WorkoutTemplate) => void;
  removeLegTemplate: (id: string) => void;
  upsertCustomFood: (food: CustomFood) => void;
  removeCustomFood: (id: string) => void;
  setFoodOverride: (presetId: string, override: FoodOverride | null) => void;
  upsertRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;
  setActiveVariant: (exerciseId: string, variant: string) => void;
  addCustomVariant: (exerciseId: string, variant: string) => void;
  removeCustomVariant: (exerciseId: string, variant: string) => void;
  resetAll: () => void;
  refreshAppleHealthDaily: () => Promise<void>;
  lastSessionFor: (
    exerciseId: string,
    beforeDate: string,
    variant?: string
  ) => { date: string; sets: SetEntry[] } | null;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function isCommitted(log: WorkoutLog | undefined): boolean {
  if (!log) return false;
  return (
    Object.keys(log.entries).length > 0 ||
    log.completedRest === true ||
    log.didOptional !== undefined ||
    log.recovery !== undefined
  );
}

function baseLogFor(prev: AppState, date: string): WorkoutLog {
  const existing = prev.workoutLogs[date];
  if (existing && isCommitted(existing)) return existing;
  return {
    date,
    templateId: plannedTemplate(date, prev.settings),
    entries: existing?.entries ?? {},
    templateSnapshot: existing?.templateSnapshot,
  };
}

// Find a template by id across BOTH upper and leg lists. The two arrays
// are kept separate but a workout log's templateId can refer to either.
function findTemplateById(
  settings: Settings,
  id: string
): WorkoutTemplate | undefined {
  return (
    settings.templates.find((t) => t.id === id) ??
    (settings.legTemplates ?? []).find((t) => t.id === id)
  );
}

// Build a snapshot of a template at the moment a log is first committed.
// We deep-clone the exercises (rather than holding a reference into
// settings.templates) so a later edit in Settings can never mutate the
// snapshot in place — the snapshot lives in the workout log JSON as its
// own copy.
function snapshotTemplate(
  template: WorkoutTemplate
): WorkoutTemplateSnapshot {
  return {
    id: template.id,
    name: template.name,
    category: template.category,
    focus: template.focus,
    exercises: template.exercises.map((e) => ({ ...e })),
    capturedAt: new Date().toISOString(),
  };
}

// Capture the snapshot lazily — only the first time a log's templateId
// resolves to a current template. After that, the existing snapshot is
// preserved so the historical view of the workout is frozen in time.
function withSnapshotIfPossible(
  log: WorkoutLog,
  settings: Settings
): WorkoutLog {
  if (log.templateSnapshot) return log;
  const tpl = findTemplateById(settings, log.templateId);
  if (!tpl) return log;
  return { ...log, templateSnapshot: snapshotTemplate(tpl) };
}

function recomputeFoodTotals(
  log: FoodLog,
  entries: FoodEntry[]
): FoodLog {
  const calories = Math.round(
    entries.reduce((sum, e) => sum + (e.calories || 0), 0)
  );
  const proteinG =
    Math.round(entries.reduce((sum, e) => sum + (e.proteinG || 0), 0) * 10) /
    10;
  const fiberG =
    Math.round(
      entries.reduce((sum, e) => sum + (e.fiberG || 0), 0) * 10
    ) / 10;
  const carbsG =
    Math.round(
      entries.reduce((sum, e) => sum + (e.carbsG || 0), 0) * 10
    ) / 10;
  const fatsG =
    Math.round(
      entries.reduce((sum, e) => sum + (e.fatsG || 0), 0) * 10
    ) / 10;
  return { ...log, entries, calories, proteinG, fiberG, carbsG, fatsG };
}

function makeEntryId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `fe-${crypto.randomUUID()}`;
  }
  return `fe-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function ensureFoodLog(prev: AppState, date: string): FoodLog {
  return (
    prev.foodLogs[date] ?? {
      date,
      waterMl: 0,
      proteinG: 0,
      calories: 0,
      fiberG: 0,
      carbsG: 0,
      fatsG: 0,
    }
  );
}

// True when the two appleHealthDaily maps are structurally equal — same set
// of date keys with identical entry fields. Cheap field-by-field check so a
// no-op refresh never triggers a re-render or an autosave.
function sameAppleHealth(
  a: Record<string, AppleHealthDailyEntry> | undefined,
  b: Record<string, AppleHealthDailyEntry>
): boolean {
  const aKeys = Object.keys(a ?? {}).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    const ae = (a as Record<string, AppleHealthDailyEntry>)[aKeys[i]];
    const be = b[bKeys[i]];
    if (
      ae.source !== be.source ||
      ae.steps !== be.steps ||
      ae.activeEnergyKcal !== be.activeEnergyKcal ||
      ae.syncedAt !== be.syncedAt
    ) {
      return false;
    }
  }
  return true;
}

function readCache(): { uid: string; state: AppState } | null {
  if (typeof window === "undefined") return null;
  const currentUid = getActiveUidFromCookie();
  if (!currentUid) {
    // No active session — never use cached data.
    return null;
  }
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const env = JSON.parse(raw) as CacheEnvelope;
    if (!env || env.uid !== currentUid || !env.state) {
      // Cache belongs to a different profile — ignore it.
      return null;
    }
    return { uid: env.uid, state: env.state };
  } catch {
    return null;
  }
}

function writeCache(state: AppState, uid: string | null) {
  if (typeof window === "undefined") return;
  if (!uid) {
    // Without a known active profile we must not persist anything that
    // could later be misread as belonging to a different account.
    try {
      window.localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  try {
    const envelope: CacheEnvelope = { uid, state };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore quota errors
  }
}


export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const dirtyRef = useRef(false);
  // Active user id from the server — populated by loadState(). Used to
  // namespace every cache write so a previous profile cannot leak into a
  // freshly-created or freshly-switched profile.
  const activeUidRef = useRef<string | null>(null);

  // Hydrate: cache first (instant) IF it matches the active profile, then
  // server (authoritative). serverLoaded must be true before we ever
  // auto-save; otherwise a transient load failure could let an empty client
  // state overwrite real DB state.
  const serverLoadedRef = useRef(false);
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      activeUidRef.current = cached.uid;
      setState({
        settings: migrateSettings({
          ...DEFAULT_SETTINGS,
          ...cached.state.settings,
        }),
        workoutLogs: cached.state.workoutLogs ?? {},
        foodLogs: cached.state.foodLogs ?? {},
        weightLogs: cached.state.weightLogs ?? {},
        appleHealthDaily: cached.state.appleHealthDaily ?? {},
      });
    } else {
      // No cache for this user — start from defaults so a new profile
      // never inherits the previous user's data while we wait for the
      // server response.
      setState(INITIAL_STATE);
      activeUidRef.current = null;
    }
    loadState()
      .then(({ userId, state: server }) => {
        const migrated: AppState = {
          ...server,
          settings: migrateSettings(server.settings),
          appleHealthDaily: server.appleHealthDaily ?? {},
        };
        activeUidRef.current = userId;
        setState(migrated);
        lastSavedRef.current = JSON.stringify(migrated);
        writeCache(migrated, userId);
        serverLoadedRef.current = true;
        setHydrated(true);
      })
      .catch(() => {
        // Stay un-hydrated on failure so the auto-save effect never runs.
        // Users can retry by reloading. Better to be unsaved than to overwrite.
        setSaveStatus("error");
      });
  }, []);

  // Auto-save: debounce 600ms after any state change. Gated by serverLoadedRef
  // so a failed initial load can never push empty state back to the server.
  useEffect(() => {
    if (!hydrated) return;
    if (!serverLoadedRef.current) return;
    const serialized = JSON.stringify(state);
    writeCache(state, activeUidRef.current);
    if (serialized === lastSavedRef.current) return;
    dirtyRef.current = true;
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(state)
        .then(() => {
          lastSavedRef.current = serialized;
          dirtyRef.current = false;
          setSaveStatus("saved");
        })
        .catch(() => {
          setSaveStatus("error");
        });
    }, 600);
  }, [state, hydrated]);

  const ensureWorkoutLog = useCallback((date: string, templateId: string) => {
    setState((prev) => {
      const existing = prev.workoutLogs[date];
      if (existing && existing.templateId === templateId) return prev;
      // When the user changes the template for a date that already has a
      // commit, drop the old snapshot — the new template is a different
      // workout and we will snapshot it lazily on the next commit.
      const next: WorkoutLog = existing
        ? {
            ...existing,
            templateId,
            templateSnapshot:
              existing.templateId === templateId
                ? existing.templateSnapshot
                : undefined,
          }
        : { date, templateId, entries: {} };
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [date]: next,
        },
      };
    });
  }, []);

  const setSets = useCallback(
    (date: string, exerciseId: string, sets: SetEntry[]) => {
      setState((prev) => {
        const base = baseLogFor(prev, date);
        const nextEntries = { ...base.entries };
        if (sets.length === 0) delete nextEntries[exerciseId];
        else nextEntries[exerciseId] = sets;
        const next = withSnapshotIfPossible(
          { ...base, entries: nextEntries },
          prev.settings
        );
        return {
          ...prev,
          workoutLogs: { ...prev.workoutLogs, [date]: next },
        };
      });
    },
    []
  );

  const setRecovery = useCallback((date: string, recovery: Recovery) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      const next = withSnapshotIfPossible(
        { ...base, recovery },
        prev.settings
      );
      return {
        ...prev,
        workoutLogs: { ...prev.workoutLogs, [date]: next },
      };
    });
  }, []);

  const setDidOptional = useCallback((date: string, didOptional: boolean) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      const next = withSnapshotIfPossible(
        { ...base, didOptional },
        prev.settings
      );
      return {
        ...prev,
        workoutLogs: { ...prev.workoutLogs, [date]: next },
      };
    });
  }, []);

  const markRestComplete = useCallback((date: string, completed: boolean) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      const next = withSnapshotIfPossible(
        { ...base, completedRest: completed },
        prev.settings
      );
      return {
        ...prev,
        workoutLogs: { ...prev.workoutLogs, [date]: next },
      };
    });
  }, []);

  const setFood = useCallback(
    (date: string, patch: Partial<Omit<FoodLog, "date">>) => {
      setState((prev) => {
        const existing = ensureFoodLog(prev, date);
        return {
          ...prev,
          foodLogs: {
            ...prev.foodLogs,
            [date]: { ...existing, ...patch },
          },
        };
      });
    },
    []
  );

  const addFoodEntry = useCallback<StoreContextValue["addFoodEntry"]>(
    (date, entry) => {
      setState((prev) => {
        const existing = ensureFoodLog(prev, date);
        const entries = existing.entries ?? [];
        const newEntry: FoodEntry = {
          id: entry.id ?? makeEntryId(),
          date,
          ts: entry.ts ?? Date.now(),
          source: entry.source,
          sourceFoodId: entry.sourceFoodId,
          name: entry.name,
          emoji: entry.emoji,
          amount: entry.amount,
          unit: entry.unit,
          calories: entry.calories,
          proteinG: entry.proteinG,
          fiberG: entry.fiberG ?? 0,
          carbsG: entry.carbsG ?? 0,
          fatsG: entry.fatsG ?? 0,
        };
        const updated = recomputeFoodTotals(existing, [...entries, newEntry]);
        return {
          ...prev,
          foodLogs: { ...prev.foodLogs, [date]: updated },
        };
      });
    },
    []
  );

  const addFoodEntries = useCallback<StoreContextValue["addFoodEntries"]>(
    (date, newEntries) => {
      if (newEntries.length === 0) return;
      setState((prev) => {
        const existing = ensureFoodLog(prev, date);
        const entries = existing.entries ?? [];
        const baseTs = Date.now();
        const built: FoodEntry[] = newEntries.map((entry, i) => ({
          id: entry.id ?? makeEntryId(),
          date,
          ts: entry.ts ?? baseTs + i,
          source: entry.source,
          sourceFoodId: entry.sourceFoodId,
          name: entry.name,
          emoji: entry.emoji,
          amount: entry.amount,
          unit: entry.unit,
          calories: entry.calories,
          proteinG: entry.proteinG,
          fiberG: entry.fiberG ?? 0,
          carbsG: entry.carbsG ?? 0,
          fatsG: entry.fatsG ?? 0,
        }));
        const updated = recomputeFoodTotals(existing, [...entries, ...built]);
        return {
          ...prev,
          foodLogs: { ...prev.foodLogs, [date]: updated },
        };
      });
    },
    []
  );

  const updateFoodEntry = useCallback<StoreContextValue["updateFoodEntry"]>(
    (date, entryId, patch) => {
      setState((prev) => {
        const existing = prev.foodLogs[date];
        if (!existing?.entries) return prev;
        const next = existing.entries.map((e) =>
          e.id === entryId ? { ...e, ...patch } : e
        );
        const updated = recomputeFoodTotals(existing, next);
        return {
          ...prev,
          foodLogs: { ...prev.foodLogs, [date]: updated },
        };
      });
    },
    []
  );

  const removeFoodEntry = useCallback<StoreContextValue["removeFoodEntry"]>(
    (date, entryId) => {
      setState((prev) => {
        const existing = prev.foodLogs[date];
        if (!existing?.entries) return prev;
        const next = existing.entries.filter((e) => e.id !== entryId);
        const updated = recomputeFoodTotals(existing, next);
        return {
          ...prev,
          foodLogs: { ...prev.foodLogs, [date]: updated },
        };
      });
    },
    []
  );

  const copyFoodEntriesFrom = useCallback<
    StoreContextValue["copyFoodEntriesFrom"]
  >((sourceDate, targetDate) => {
    setState((prev) => {
      const source = prev.foodLogs[sourceDate];
      if (!source?.entries || source.entries.length === 0) return prev;
      const target = ensureFoodLog(prev, targetDate);
      const targetEntries = target.entries ?? [];
      const ts = Date.now();
      const cloned: FoodEntry[] = source.entries.map((e, i) => ({
        ...e,
        id: makeEntryId(),
        date: targetDate,
        ts: ts + i,
      }));
      const updated = recomputeFoodTotals(target, [
        ...targetEntries,
        ...cloned,
      ]);
      return {
        ...prev,
        foodLogs: { ...prev.foodLogs, [targetDate]: updated },
      };
    });
  }, []);

  const setWeight = useCallback(
    (date: string, weight: number, bodyFatPct?: number) => {
      setState((prev) => ({
        ...prev,
        weightLogs: {
          ...prev.weightLogs,
          [date]: { date, weight, bodyFatPct } satisfies WeightLog,
        },
      }));
    },
    []
  );

  const removeWeight = useCallback((date: string) => {
    setState((prev) => {
      const next = { ...prev.weightLogs };
      delete next[date];
      return { ...prev, weightLogs: next };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const upsertTemplate = useCallback((template: WorkoutTemplate) => {
    setState((prev) => {
      const idx = prev.settings.templates.findIndex(
        (t) => t.id === template.id
      );
      const next = [...prev.settings.templates];
      if (idx >= 0) next[idx] = template;
      else next.push(template);
      return {
        ...prev,
        settings: { ...prev.settings, templates: next },
      };
    });
  }, []);

  const removeTemplate = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        templates: prev.settings.templates.filter((t) => t.id !== id),
      },
    }));
  }, []);

  const upsertLegTemplate = useCallback((template: WorkoutTemplate) => {
    setState((prev) => {
      // Force the category so leg templates never accidentally appear under
      // the upper-body section.
      const next = { ...template, category: "legs" as const };
      const list = prev.settings.legTemplates ?? [];
      const idx = list.findIndex((t) => t.id === next.id);
      const nextList = [...list];
      if (idx >= 0) nextList[idx] = next;
      else nextList.push(next);
      return {
        ...prev,
        settings: { ...prev.settings, legTemplates: nextList },
      };
    });
  }, []);

  const removeLegTemplate = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        legTemplates: (prev.settings.legTemplates ?? []).filter(
          (t) => t.id !== id
        ),
      },
    }));
  }, []);

  const upsertCustomFood = useCallback((food: CustomFood) => {
    setState((prev) => {
      const list = prev.settings.customFoods ?? [];
      const idx = list.findIndex((f) => f.id === food.id);
      const next = [...list];
      if (idx >= 0) next[idx] = food;
      else next.push(food);
      return {
        ...prev,
        settings: { ...prev.settings, customFoods: next },
      };
    });
  }, []);

  const removeCustomFood = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        customFoods: (prev.settings.customFoods ?? []).filter(
          (f) => f.id !== id
        ),
      },
    }));
  }, []);

  const setFoodOverride = useCallback(
    (presetId: string, override: FoodOverride | null) => {
      setState((prev) => {
        const current = prev.settings.foodOverrides ?? {};
        const next: Record<string, FoodOverride> = { ...current };
        if (override === null || Object.keys(override).length === 0) {
          delete next[presetId];
        } else {
          next[presetId] = override;
        }
        return {
          ...prev,
          settings: { ...prev.settings, foodOverrides: next },
        };
      });
    },
    []
  );

  const upsertRecipe = useCallback((recipe: Recipe) => {
    setState((prev) => {
      const list = prev.settings.recipes ?? [];
      const idx = list.findIndex((r) => r.id === recipe.id);
      const next = [...list];
      if (idx >= 0) next[idx] = recipe;
      else next.push(recipe);
      return {
        ...prev,
        settings: { ...prev.settings, recipes: next },
      };
    });
  }, []);

  const removeRecipe = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        recipes: (prev.settings.recipes ?? []).filter((r) => r.id !== id),
      },
    }));
  }, []);

  const setExerciseNote = useCallback(
    (exerciseId: string, note: string) => {
      setState((prev) => {
        const cur = prev.settings.exerciseNotes ?? {};
        const next = { ...cur };
        const trimmed = note.trim();
        if (trimmed.length === 0) {
          delete next[exerciseId];
        } else {
          next[exerciseId] = trimmed;
        }
        return {
          ...prev,
          settings: { ...prev.settings, exerciseNotes: next },
        };
      });
    },
    []
  );

  const setActiveVariant = useCallback(
    (exerciseId: string, variant: string) => {
      const v = variant.trim();
      setState((prev) => {
        const cur = prev.settings.activeVariantByExercise ?? {};
        const next = { ...cur };
        if (!v || v.toLowerCase() === "default") {
          delete next[exerciseId];
        } else {
          next[exerciseId] = v;
        }
        return {
          ...prev,
          settings: { ...prev.settings, activeVariantByExercise: next },
        };
      });
    },
    []
  );

  const addCustomVariant = useCallback(
    (exerciseId: string, variant: string) => {
      const v = variant.trim();
      if (!v) return;
      setState((prev) => {
        const cur = prev.settings.customVariantsByExercise ?? {};
        const list = cur[exerciseId] ?? [];
        const norm = v.toLowerCase();
        if (list.some((x) => x.toLowerCase() === norm)) return prev;
        return {
          ...prev,
          settings: {
            ...prev.settings,
            customVariantsByExercise: {
              ...cur,
              [exerciseId]: [...list, v],
            },
          },
        };
      });
    },
    []
  );

  const removeCustomVariant = useCallback(
    (exerciseId: string, variant: string) => {
      const v = variant.trim().toLowerCase();
      setState((prev) => {
        const cur = prev.settings.customVariantsByExercise ?? {};
        const list = cur[exerciseId] ?? [];
        const next = list.filter((x) => x.toLowerCase() !== v);
        const nextMap = { ...cur };
        if (next.length === 0) {
          delete nextMap[exerciseId];
        } else {
          nextMap[exerciseId] = next;
        }
        return {
          ...prev,
          settings: {
            ...prev.settings,
            customVariantsByExercise: nextMap,
          },
        };
      });
    },
    []
  );

  const resetAll = useCallback(() => {
    // Profile-scoped reset. Wipes the active profile's row server-side,
    // resets the client state to defaults, and refreshes the cache so the
    // next hydration starts blank. Other profiles' rows are untouched
    // because resetCurrentProfile filters by the session user id.
    const uid = activeUidRef.current;
    setState(INITIAL_STATE);
    lastSavedRef.current = JSON.stringify(INITIAL_STATE);
    writeCache(INITIAL_STATE, uid);
    setSaveStatus("saving");
    void resetCurrentProfile()
      .then((r) => setSaveStatus(r.ok ? "saved" : "error"))
      .catch(() => setSaveStatus("error"));
  }, []);

  // Pulls only the Apple Health daily map from the server and merges it into
  // local state without disturbing workout / food / weight / settings. When
  // the fetched slice is byte-identical to what we already have, state is
  // returned unchanged so React skips the render and the autosave loop stays
  // quiet. When the slice did change we also splice it into lastSavedRef so
  // the next autosave tick does not push our just-fetched snapshot straight
  // back over a potentially-newer Shortcut write — only genuine local edits
  // should trigger a save.
  const refreshAppleHealthDaily = useCallback(async () => {
    try {
      const fresh = await loadAppleHealthDaily();
      let changed = false;
      setState((prev) => {
        if (sameAppleHealth(prev.appleHealthDaily, fresh)) return prev;
        changed = true;
        return { ...prev, appleHealthDaily: fresh };
      });
      if (changed && lastSavedRef.current) {
        try {
          const saved = JSON.parse(lastSavedRef.current) as AppState;
          saved.appleHealthDaily = fresh;
          lastSavedRef.current = JSON.stringify(saved);
        } catch {
          // lastSavedRef was malformed; let the next real save reset it.
        }
      }
    } catch {
      // Read failures are silent — the Apple Health card simply keeps
      // showing the last known data until the next tick.
    }
  }, []);

  const lastSessionFor = useCallback(
    (exerciseId: string, beforeDate: string, variant?: string) => {
      const ids = exerciseIdGroup(exerciseId);
      const wantVariant =
        variant != null
          ? (variant.trim().toLowerCase() || "default")
          : null;
      const dates = Object.keys(state.workoutLogs)
        .filter((d) => d < beforeDate)
        .sort()
        .reverse();
      for (const d of dates) {
        const entries = state.workoutLogs[d]?.entries;
        if (!entries) continue;
        for (const id of ids) {
          const sets = entries[id];
          if (!sets || sets.length === 0) continue;
          if (wantVariant == null) {
            return { date: d, sets };
          }
          const matched = sets.filter(
            (s) =>
              ((s.variant ?? "").trim().toLowerCase() || "default") ===
              wantVariant
          );
          if (matched.length > 0) return { date: d, sets: matched };
        }
      }
      return null;
    },
    [state.workoutLogs]
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      hydrated,
      saveStatus,
      state,
      ensureWorkoutLog,
      setSets,
      setRecovery,
      setDidOptional,
      markRestComplete,
      setFood,
      addFoodEntry,
      addFoodEntries,
      updateFoodEntry,
      removeFoodEntry,
      copyFoodEntriesFrom,
      setWeight,
      removeWeight,
      updateSettings,
      upsertTemplate,
      removeTemplate,
      upsertLegTemplate,
      removeLegTemplate,
      upsertCustomFood,
      removeCustomFood,
      setFoodOverride,
      upsertRecipe,
      removeRecipe,
      setExerciseNote,
      setActiveVariant,
      addCustomVariant,
      removeCustomVariant,
      resetAll,
      refreshAppleHealthDaily,
      lastSessionFor,
    }),
    [
      hydrated,
      saveStatus,
      state,
      ensureWorkoutLog,
      setSets,
      setRecovery,
      setDidOptional,
      markRestComplete,
      setFood,
      addFoodEntry,
      addFoodEntries,
      updateFoodEntry,
      removeFoodEntry,
      copyFoodEntriesFrom,
      setWeight,
      removeWeight,
      updateSettings,
      upsertTemplate,
      removeTemplate,
      upsertLegTemplate,
      removeLegTemplate,
      upsertCustomFood,
      removeCustomFood,
      setFoodOverride,
      upsertRecipe,
      removeRecipe,
      setExerciseNote,
      setActiveVariant,
      addCustomVariant,
      removeCustomVariant,
      resetAll,
      refreshAppleHealthDaily,
      lastSessionFor,
    ]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
