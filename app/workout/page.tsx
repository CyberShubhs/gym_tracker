"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Dumbbell,
  Plus,
  Settings as SettingsIcon,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { todayISO, formatDate, cn } from "@/lib/utils";
import { CATEGORY_ACCENT, CATEGORY_LABEL, DAY_NAMES } from "@/lib/defaults";
import { ExerciseCarousel } from "@/components/exercise-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RecoveryCard } from "@/components/recovery-card";
import { SaveIndicator } from "@/components/save-indicator";
import { DateNav } from "@/components/date-nav";
import { plannedTemplate, shiftFutureCycleTo } from "@/lib/cycle";
import { useRestTimer } from "@/components/rest-timer";
import { uidStorageSuffix } from "@/lib/uid-client";
import type { TemplateExercise, WorkoutTemplate } from "@/lib/types";

type Mode = "upper" | "legs";
function legPickKey(): string {
  // Uid-scoped so switching profiles cannot make the new user inherit the
  // previous user's last-selected leg template.
  return `gym-tracker:active-leg-template:v2:${uidStorageSuffix()}`;
}

export default function WorkoutPage() {
  const { hydrated, state, ensureWorkoutLog, markRestComplete, updateSettings } =
    useStore();
  const [date, setDate] = useState<string>(() => todayISO());
  const [mode, setMode] = useState<Mode>("upper");
  const { start: startRest, active: restActive } = useRestTimer();

  useEffect(() => {
    setDate(todayISO());
  }, []);

  const dayOfWeek = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }, [date]);

  const scheduledTemplateId = plannedTemplate(date, state.settings);
  const log = state.workoutLogs[date];
  const upperTemplates = state.settings.templates;
  const legTemplates = state.settings.legTemplates ?? [];
  const hasNoTemplates = upperTemplates.length === 0 && legTemplates.length === 0;

  // Resolve the upper-mode template:
  //   1) If the log has an immutable snapshot AND the snapshot is an upper
  //      template, render that snapshot verbatim. This is what keeps an
  //      old logged Sunday workout readable after the template behind it
  //      was renamed or had exercises swapped out in Settings.
  //   2) Otherwise, if the log's templateId points at a current upper
  //      template, use that. (Picking a non-rest workout on Sunday now
  //      sticks immediately, without needing to log a set first.)
  //   3) Otherwise, fall back to the scheduled template for that weekday.
  const snapshot = log?.templateSnapshot;
  const upperFromLog =
    snapshot && snapshot.category !== "legs"
      ? snapshot
      : upperTemplates.find((t) => t.id === log?.templateId);
  const scheduledUpper = upperTemplates.find(
    (t) => t.id === scheduledTemplateId
  );
  const upperTemplate: WorkoutTemplate | undefined =
    upperFromLog ?? scheduledUpper;
  const activeUpperId = upperTemplate?.id ?? scheduledTemplateId;
  // A log whose templateId belongs to the leg list — used so the carousel
  // and the leg picker pre-select the user's existing pick on this date.
  const loggedLegId =
    snapshot?.category === "legs"
      ? snapshot.id
      : legTemplates.find((t) => t.id === log?.templateId)?.id;

  // Auto-switch to Legs when today's planned template *is* legs.
  useEffect(() => {
    if (upperTemplate?.category === "legs") setMode("legs");
  }, [upperTemplate?.category]);

  // Persist the user's currently-picked leg template across refreshes —
  // scoped per-profile so a different login can never inherit it.
  const [activeLegId, setActiveLegId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(legPickKey());
    if (saved) setActiveLegId(saved);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeLegId) window.localStorage.setItem(legPickKey(), activeLegId);
  }, [activeLegId]);
  // The leg snapshot, if the user already logged a leg workout for this
  // date — wins over the live template list so renames/edits in Settings
  // can't reshape an old log retroactively.
  const legSnapshot =
    snapshot?.category === "legs" ? snapshot : undefined;
  // Default to the first leg template if the saved one disappeared. A
  // committed leg log for this date takes priority over the picker.
  const legTemplate: WorkoutTemplate | undefined = useMemo(() => {
    if (legSnapshot) return legSnapshot;
    if (legTemplates.length === 0) return undefined;
    if (loggedLegId) {
      const found = legTemplates.find((t) => t.id === loggedLegId);
      if (found) return found;
    }
    if (activeLegId) {
      const found = legTemplates.find((t) => t.id === activeLegId);
      if (found) return found;
    }
    return legTemplates[0];
  }, [legTemplates, activeLegId, loggedLegId, legSnapshot]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const template = mode === "legs" ? legTemplate : upperTemplate;
  const isOptionalDay = template?.optional ?? false;
  const isRestDay = template?.category === "rest";
  const declinedOptional =
    isOptionalDay && log?.didOptional === false && mode === "upper";
  const showWorkout = !isRestDay && !declinedOptional;

  // Pick a template for THIS date and let future dates follow the cycle
  // from here. `shiftFutureCycleTo` appends a dated segment that only
  // governs planning for `date` and dates AFTER `date` — past planned
  // days resolve against earlier segments / the legacy global cycle and
  // are never silently rewritten. We still call `ensureWorkoutLog` so
  // the picked date shows the new template immediately, even on a Rest
  // day like Sunday 2026-05-24 (i.e. without depending on the cycle
  // segment alone, which would otherwise need a re-render). For
  // templates that aren't part of the active cycle we fall back to a
  // date-only log change — the cycle is left alone so future dates keep
  // their existing plan.
  const pickUpperTemplate = (id: string) => {
    ensureWorkoutLog(date, id);
    const patch = shiftFutureCycleTo(date, id, state.settings);
    if (patch) updateSettings(patch);
  };

  const pickLegTemplate = (id: string) => {
    setActiveLegId(id);
    ensureWorkoutLog(date, id);
  };

  const completed = !!log?.completedRest;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {DAY_NAMES[dayOfWeek]} · Workout
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {template?.name ?? "Rest"}
            </h1>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(date)}
              <SaveIndicator />
            </p>
          </div>
          {template && (
            <div
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider",
                CATEGORY_ACCENT[template.category]
              )}
            >
              {CATEGORY_LABEL[template.category]}
            </div>
          )}
        </div>

        <DateNav date={date} onChange={(d) => setDate(d)} />

        {/* Upper / Legs segmented control */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border/60 bg-card/40 p-1">
          <SegmentButton
            active={mode === "upper"}
            onClick={() => setMode("upper")}
            label="Upper Body"
            hint={upperTemplate?.name ?? "Rest"}
          />
          <SegmentButton
            active={mode === "legs"}
            onClick={() => setMode("legs")}
            label="Legs"
            count={legTemplates.length}
            hint={
              legTemplates.length === 0
                ? "No templates"
                : legTemplate?.name ?? "Pick a template"
            }
          />
        </div>

        {/* Template chooser for the active mode. Upper and Leg lists are
            completely separate — selecting one never touches the other. */}
        {mode === "upper" && (
          <TemplateSwitcher
            current={activeUpperId}
            onSelect={pickUpperTemplate}
            templates={state.settings.templates}
          />
        )}
        {mode === "legs" && legTemplates.length > 0 && (
          <TemplateSwitcher
            current={legTemplate?.id ?? ""}
            onSelect={pickLegTemplate}
            templates={legTemplates}
            tone="legs"
          />
        )}

        {template?.focus && (
          <p className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm text-muted-foreground">
            {template.focus}
          </p>
        )}
      </header>

      {(isOptionalDay || isRestDay) && mode === "upper" && (
        <RecoveryCard date={date} optional={isOptionalDay} />
      )}

      {hasNoTemplates ? (
        <NoTemplatesState />
      ) : mode === "upper" && upperTemplates.length === 0 ? (
        <UpperEmptyState />
      ) : mode === "legs" && legTemplates.length === 0 ? (
        <LegsEmptyState />
      ) : mode === "legs" && legTemplate && legTemplate.exercises.length === 0 ? (
        <LegsTemplateEmpty templateName={legTemplate.name} />
      ) : showWorkout && template && template.exercises.length > 0 ? (
        <ExerciseCarousel
          exercises={template.exercises as TemplateExercise[]}
          date={date}
          unit={state.settings.unit}
          positionKey={template.id}
        />
      ) : isRestDay ? (
        <RestState />
      ) : null}

      {/* In-flow workout footer (not a fixed overlay) — hidden when the
          legs mode has nothing to log yet. */}
      {showWorkout &&
        template &&
        template.exercises.length > 0 &&
        !(mode === "legs" && legTemplates.length === 0) && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            onClick={() => startRest(90)}
            disabled={restActive}
            aria-label="Start 90 second rest timer"
          >
            <Timer className="h-4 w-4" />
            {restActive ? "Resting…" : "Rest 90s"}
          </Button>
          <Button
            variant={completed ? "default" : "secondary"}
            size="lg"
            className="h-12"
            onClick={() => markRestComplete(date, !completed)}
            aria-label="Mark workout complete"
          >
            <Check className="h-4 w-4" />
            {completed ? "Workout saved" : "Mark complete"}
          </Button>
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
  hint,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
        {label}
        {typeof count === "number" && count > 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-px font-mono text-[10px] leading-none",
              active
                ? "bg-background/20 text-background"
                : "bg-emerald-500/15 text-emerald-400"
            )}
          >
            {count}
          </span>
        )}
      </span>
      {hint && (
        <span
          className={cn(
            "truncate font-mono text-[10px] uppercase tracking-wider",
            active ? "text-background/70" : "text-muted-foreground"
          )}
        >
          {hint}
        </span>
      )}
    </button>
  );
}

function TemplateSwitcher({
  current,
  onSelect,
  templates,
  tone,
}: {
  current: string;
  onSelect: (id: string) => void;
  templates: WorkoutTemplate[];
  tone?: "legs";
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {templates.map((t) => {
        const isActive = t.id === current;
        const count = t.exercises.length;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-pressed={isActive}
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? tone === "legs"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-50"
                  : "border-foreground bg-foreground text-background"
                : tone === "legs"
                ? "border-emerald-500/20 bg-card/40 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground"
                : "border-border bg-card/40 text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
          >
            <span className="truncate">{t.name}</span>
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px] leading-none",
                  isActive
                    ? tone === "legs"
                      ? "bg-emerald-500/30 text-emerald-50"
                      : "bg-background/20 text-background"
                    : "bg-muted/60 text-muted-foreground"
                )}
                aria-label={`${count} exercises`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NoTemplatesState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <Dumbbell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Start fresh
      </p>
      <p className="mt-2 text-lg font-medium">No templates yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Your profile is empty by design — build an upper or leg template in
        Settings to start logging sets.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Open Settings → Templates
      </Link>
    </div>
  );
}

function UpperEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <Plus className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Upper body
      </p>
      <p className="mt-2 text-lg font-medium">No upper-body templates yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add one under Settings, or switch to Legs above if you have leg
        templates set up.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Open Settings → Upper body templates
      </Link>
    </div>
  );
}

function LegsEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] p-8 text-center">
      <Dumbbell className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
      <p className="font-mono text-xs uppercase tracking-widest text-emerald-400/80">
        Legs
      </p>
      <p className="mt-2 text-lg font-medium">No leg templates yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Build one under Settings — leg templates are kept separate from your
        upper-body plan.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Open Settings → Leg templates
      </Link>
    </div>
  );
}

function LegsTemplateEmpty({ templateName }: { templateName: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center">
      <Plus className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {templateName}
      </p>
      <p className="mt-2 text-lg font-medium">No exercises in this template.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Add exercises under Settings → Leg templates to start logging sets.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-medium transition-colors hover:border-foreground"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Edit in Settings
      </Link>
    </div>
  );
}

function RestState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Dumbbell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Recovery
      </p>
      <p className="mt-2 text-lg font-medium">Rest day. Eat. Sleep. Repeat.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Switch to Legs above if you want to lift today.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        Back home
      </Link>
    </div>
  );
}
