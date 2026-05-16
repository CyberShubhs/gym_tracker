"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, Dumbbell, Timer } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { todayISO, formatDate, cn } from "@/lib/utils";
import { CATEGORY_ACCENT, CATEGORY_LABEL, DAY_NAMES } from "@/lib/defaults";
import { ExerciseCarousel } from "@/components/exercise-carousel";
import { LEGS_TEMPLATE } from "@/lib/legs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RecoveryCard } from "@/components/recovery-card";
import { SaveIndicator } from "@/components/save-indicator";
import { DateNav } from "@/components/date-nav";
import { plannedTemplate, shiftCycleTo } from "@/lib/cycle";
import { useRestTimer } from "@/components/rest-timer";
import type { WorkoutTemplate } from "@/lib/types";

type Mode = "upper" | "legs";

export default function WorkoutPage() {
  const { hydrated, state, updateSettings, ensureWorkoutLog, markRestComplete } =
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
  const isCommitted = !!(
    log &&
    (Object.keys(log.entries).length > 0 ||
      log.completedRest ||
      log.didOptional !== undefined ||
      log.recovery !== undefined)
  );
  const activeUpperId = isCommitted ? log!.templateId : scheduledTemplateId;
  const upperTemplate: WorkoutTemplate | undefined =
    state.settings.templates.find((t) => t.id === activeUpperId);

  // Auto-switch to Legs when today's planned template *is* legs.
  useEffect(() => {
    if (upperTemplate?.category === "legs") setMode("legs");
  }, [upperTemplate?.category]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const template = mode === "legs" ? LEGS_TEMPLATE : upperTemplate;
  const isOptionalDay = template?.optional ?? false;
  const isRestDay = template?.category === "rest";
  const declinedOptional =
    isOptionalDay && log?.didOptional === false && mode === "upper";
  const showWorkout = !isRestDay && !declinedOptional;

  const pickTemplate = (id: string) => {
    const shift = shiftCycleTo(date, id, state.settings);
    if (shift) updateSettings(shift);
    else ensureWorkoutLog(date, id);
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
            hint={LEGS_TEMPLATE.name}
          />
        </div>

        {/* Template chooser only in Upper mode */}
        {mode === "upper" && (
          <TemplateSwitcher
            current={activeUpperId}
            onSelect={pickTemplate}
            templates={state.settings.templates}
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

      {showWorkout && template && template.exercises.length > 0 ? (
        <ExerciseCarousel
          exercises={template.exercises}
          date={date}
          unit={state.settings.unit}
        />
      ) : isRestDay ? (
        <RestState />
      ) : null}

      {/* In-flow workout footer (not a fixed overlay) */}
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

function SegmentButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
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
      <span className="text-sm font-semibold leading-tight">{label}</span>
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
}: {
  current: string;
  onSelect: (id: string) => void;
  templates: WorkoutTemplate[];
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {templates.map((t) => (
        <Button
          key={t.id}
          variant={t.id === current ? "default" : "outline"}
          size="sm"
          onClick={() => onSelect(t.id)}
          className="shrink-0"
        >
          {t.name}
        </Button>
      ))}
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
