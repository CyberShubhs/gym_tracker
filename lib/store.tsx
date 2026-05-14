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
} from "./types";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  TEMPLATES_VERSION,
  needsTemplateMigration,
  validateTemplates,
} from "./defaults";
import { loadState, saveState } from "./actions";
import { plannedTemplate } from "./cycle";
import { exerciseIdGroup } from "./exercise-aliases";

const CACHE_KEY = "gym-tracker:cache:v3";

// Migrates user settings to the new upper-body plan whenever the templates
// version is stale OR the saved templates don't pass validation (e.g. an
// older JSON import wrote old names back over a freshly-migrated state).
// Workout / food / weight logs are untouched.
function migrateSettings(s: AppState["settings"]): AppState["settings"] {
  if (!needsTemplateMigration(s.templates, s.schedule, s.templatesVersion)) {
    return s;
  }
  if (process.env.NODE_ENV !== "production") {
    const issues = s.templates
      ? validateTemplates(s.templates, s.schedule ?? {})
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
    ...s,
    templates: DEFAULT_TEMPLATES,
    schedule: DEFAULT_SCHEDULE,
    cycle: undefined,
    cycleAnchor: undefined,
    templatesVersion: TEMPLATES_VERSION,
  };
}

const INITIAL_STATE: AppState = {
  settings: DEFAULT_SETTINGS,
  workoutLogs: {},
  foodLogs: {},
  weightLogs: {},
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
  upsertCustomFood: (food: CustomFood) => void;
  removeCustomFood: (id: string) => void;
  setFoodOverride: (presetId: string, override: FoodOverride | null) => void;
  upsertRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;
  resetAll: () => void;
  lastSessionFor: (
    exerciseId: string,
    beforeDate: string
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
  };
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

function readCache(): AppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppState;
  } catch {
    return null;
  }
}

function writeCache(state: AppState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(state));
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

  // Hydrate: cache first (instant), then server (authoritative).
  // serverLoaded must be true before we ever auto-save; otherwise a transient
  // load failure could let an empty client state overwrite real DB state.
  const serverLoadedRef = useRef(false);
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setState({
        settings: migrateSettings({ ...DEFAULT_SETTINGS, ...cached.settings }),
        workoutLogs: cached.workoutLogs ?? {},
        foodLogs: cached.foodLogs ?? {},
        weightLogs: cached.weightLogs ?? {},
      });
    }
    loadState()
      .then((server) => {
        const migrated: AppState = {
          ...server,
          settings: migrateSettings(server.settings),
        };
        setState(migrated);
        lastSavedRef.current = JSON.stringify(migrated);
        writeCache(migrated);
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
    writeCache(state);
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
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [date]: existing
            ? { ...existing, templateId }
            : { date, templateId, entries: {} },
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
        return {
          ...prev,
          workoutLogs: {
            ...prev.workoutLogs,
            [date]: { ...base, entries: nextEntries },
          },
        };
      });
    },
    []
  );

  const setRecovery = useCallback((date: string, recovery: Recovery) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [date]: { ...base, recovery },
        },
      };
    });
  }, []);

  const setDidOptional = useCallback((date: string, didOptional: boolean) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [date]: { ...base, didOptional },
        },
      };
    });
  }, []);

  const markRestComplete = useCallback((date: string, completed: boolean) => {
    setState((prev) => {
      const base = baseLogFor(prev, date);
      return {
        ...prev,
        workoutLogs: {
          ...prev.workoutLogs,
          [date]: { ...base, completedRest: completed },
        },
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

  const resetAll = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const lastSessionFor = useCallback(
    (exerciseId: string, beforeDate: string) => {
      const ids = exerciseIdGroup(exerciseId);
      const dates = Object.keys(state.workoutLogs)
        .filter((d) => d < beforeDate)
        .sort()
        .reverse();
      for (const d of dates) {
        const entries = state.workoutLogs[d]?.entries;
        if (!entries) continue;
        for (const id of ids) {
          const sets = entries[id];
          if (sets && sets.length > 0) return { date: d, sets };
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
      upsertCustomFood,
      removeCustomFood,
      setFoodOverride,
      upsertRecipe,
      removeRecipe,
      setExerciseNote,
      resetAll,
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
      upsertCustomFood,
      removeCustomFood,
      setFoodOverride,
      upsertRecipe,
      removeRecipe,
      setExerciseNote,
      resetAll,
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
