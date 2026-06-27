"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Dumbbell,
  Settings as SettingsIcon,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { todayISO, formatDate, cn } from "@/lib/utils";
import { CATEGORY_LABEL, DAY_NAMES } from "@/lib/defaults";
import { ExerciseCard } from "@/components/exercise-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RecoveryCard } from "@/components/recovery-card";
import { SaveIndicator } from "@/components/save-indicator";
import { DateNav } from "@/components/date-nav";
import { plannedTemplate, shiftFutureCycleTo } from "@/lib/cycle";
import { templateIntent, type Intent } from "@/lib/exercise-guides";
import { useRestTimer } from "@/components/rest-timer";
import type {
  SetEntry,
  TemplateExercise,
  Unit,
  WorkoutTemplate,
} from "@/lib/types";

export default function WorkoutPage() {
  const { hydrated, state, ensureWorkoutLog, markRestComplete, updateSettings } =
    useStore();
  const [date, setDate] = useState<string>(() => todayISO());
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
  const templates = state.settings.templates;
  const hasNoTemplates = templates.length === 0;

  // Resolve the template for this date (legs is now a normal template in the
  // split, so there's no separate legs mode):
  //   1) If the log has an immutable snapshot, render it verbatim — keeps an
  //      old logged workout readable after the template behind it was renamed
  //      or had exercises swapped out in Settings.
  //   2) Otherwise, if the log's templateId points at a current template, use
  //      that. (Picking a workout sticks immediately, without logging a set.)
  //   3) Otherwise, fall back to the scheduled template for that weekday.
  const snapshot = log?.templateSnapshot;
  const fromLog =
    snapshot ?? templates.find((t) => t.id === log?.templateId);
  const scheduled = templates.find((t) => t.id === scheduledTemplateId);
  const template: WorkoutTemplate | undefined = fromLog ?? scheduled;
  const activeTemplateId = template?.id ?? scheduledTemplateId;

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const isOptionalDay = template?.optional ?? false;
  const isRestDay = template?.category === "rest";
  const declinedOptional = isOptionalDay && log?.didOptional === false;
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
  const pickTemplate = (id: string) => {
    ensureWorkoutLog(date, id);
    const patch = shiftFutureCycleTo(date, id, state.settings);
    if (patch) updateSettings(patch);
  };

  const completed = !!log?.completedRest;

  // Overall session progress = logged sets / prescribed sets across the day's
  // exercises. Drives the Forge header bar and the "n/m sets" read-out.
  const sessionExercises =
    showWorkout && template ? template.exercises : [];
  const totalDoneSets = sessionExercises.reduce(
    (s, e) => s + validSets(log?.entries?.[e.id]),
    0
  );
  const totalTargetSets = sessionExercises.reduce((s, e) => s + e.sets, 0);
  const sessionPct =
    totalTargetSets > 0
      ? Math.min(100, Math.round((totalDoneSets / totalTargetSets) * 100))
      : 0;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary/90">
            {template
              ? `${CATEGORY_LABEL[template.category]} · ${totalDoneSets}/${totalTargetSets} sets`
              : `${DAY_NAMES[dayOfWeek]} · Rest`}
          </p>
          <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            {template?.name ?? "Rest"}
          </h1>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(date)}
            <SaveIndicator />
          </p>
          {showWorkout && totalTargetSets > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${sessionPct}%` }}
              />
            </div>
          )}
        </div>

        <DateNav date={date} onChange={(d) => setDate(d)} />

        {/* Pick any day in your split — legs included. Selecting a template
            shifts future days along the cycle; past days never change. */}
        {templates.length > 0 && (
          <TemplateSwitcher
            current={activeTemplateId}
            onSelect={pickTemplate}
            templates={templates}
          />
        )}

        {template?.focus && (
          <p className="rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm text-muted-foreground">
            {template.focus}
          </p>
        )}
      </header>

      {(isOptionalDay || isRestDay) && (
        <RecoveryCard date={date} optional={isOptionalDay} />
      )}

      {hasNoTemplates ? (
        <NoTemplatesState />
      ) : showWorkout && template && template.exercises.length > 0 ? (
        <WorkoutSession
          exercises={template.exercises as TemplateExercise[]}
          date={date}
          unit={state.settings.unit}
          intent={templateIntent(template)}
        />
      ) : isRestDay ? (
        <RestState />
      ) : null}

      {/* In-flow workout footer (not a fixed overlay). */}
      {showWorkout && template && template.exercises.length > 0 && (
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
            variant="default"
            size="lg"
            className={cn("h-12", completed && "opacity-90")}
            onClick={() => markRestComplete(date, !completed)}
            aria-label="Mark workout complete"
          >
            <Check className="h-4 w-4" />
            {completed ? "Workout saved" : "Finish workout"}
          </Button>
        </div>
      )}
    </div>
  );
}

function TemplateSwitcher({
  current,
  onSelect,
  templates,
}: {
  current: string;
  onSelect: (id: string) => void;
  templates: WorkoutTemplate[];
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
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card/40 text-muted-foreground hover:border-foreground hover:text-foreground"
            )}
          >
            <span className="truncate">{t.name}</span>
            {count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px font-mono text-[10px] leading-none",
                  isActive
                    ? "bg-background/20 text-background"
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
        Your profile is empty by design — build a template in Settings to
        start logging sets.
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

function RestState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <Dumbbell className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Recovery
      </p>
      <p className="mt-2 text-lg font-medium">Rest day. Eat. Sleep. Repeat.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick another day above if you want to lift today.
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

// A set counts as "done" once it has a finite weight and a positive rep count —
// the same validity rule the store uses when persisting sets.
function validSets(entries: SetEntry[] | undefined): number {
  if (!entries) return 0;
  return entries.filter(
    (s) => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.reps > 0
  ).length;
}

// Forge-style workout tracking: a vertical accordion of exercises. The
// collapsed header shows live "done/target" sets; expanding reveals the full
// existing ExerciseCard, so every feature it owns — set logging, PR detection,
// variant tracking, progression hints, the training guide, notes and the rest
// timer — is preserved verbatim. Only the navigation model changed (a tap-to-
// expand list instead of the swipe carousel).
function WorkoutSession({
  exercises,
  date,
  unit,
  intent,
}: {
  exercises: TemplateExercise[];
  date: string;
  unit: Unit;
  intent?: Intent;
}) {
  const { state } = useStore();
  const log = state.workoutLogs[date];
  const [expanded, setExpanded] = useState<string | null>(
    () => exercises[0]?.id ?? null
  );

  // Keep the open card pointing at an exercise that still exists when the
  // template (or the day) changes; otherwise fall back to the first one.
  useEffect(() => {
    setExpanded((cur) =>
      cur && exercises.some((e) => e.id === cur)
        ? cur
        : (exercises[0]?.id ?? null)
    );
  }, [exercises]);

  return (
    <div className="space-y-2.5">
      {exercises.map((ex) => {
        const done = validSets(log?.entries?.[ex.id]);
        const complete = ex.sets > 0 && done >= ex.sets;
        const isOpen = expanded === ex.id;
        const repsTarget =
          ex.repsLow === ex.repsHigh
            ? `${ex.repsLow}`
            : `${ex.repsLow}–${ex.repsHigh}`;
        return (
          <div key={ex.id} className="space-y-2.5">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : ex.id)}
              aria-expanded={isOpen}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors active:scale-[0.99]",
                complete
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/60 bg-card"
              )}
            >
              <span
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border font-mono text-[13px] font-bold tabular-nums",
                  complete
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/60 bg-secondary text-muted-foreground"
                )}
              >
                {done}/{ex.sets}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">
                  {ex.name}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {ex.equipment ? `${ex.equipment} · ` : ""}
                  {ex.sets}×{repsTarget}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-[18px] w-[18px] shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            </button>
            {isOpen && (
              <ExerciseCard
                exercise={ex}
                date={date}
                unit={unit}
                intent={intent}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
