"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Dumbbell,
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
import { templateIntent } from "@/lib/exercise-guides";
import { useRestTimer } from "@/components/rest-timer";
import type { TemplateExercise, WorkoutTemplate } from "@/lib/types";

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
        <ExerciseCarousel
          exercises={template.exercises as TemplateExercise[]}
          date={date}
          unit={state.settings.unit}
          positionKey={template.id}
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
