"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Beef,
  CalendarDays,
  ChevronRight,
  Droplets,
  Flame,
  Leaf,
  Scale,
  Target,
  Wheat,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { todayISO, formatDate, cn } from "@/lib/utils";
import { CATEGORY_ACCENT, CATEGORY_LABEL, DAY_NAMES } from "@/lib/defaults";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { WeightPill } from "@/components/weight-pill";
import { HeightPill } from "@/components/height-pill";
import { StreakBar } from "@/components/streak-bar";
import { BmiBar } from "@/components/bmi-bar";
import { SaveIndicator } from "@/components/save-indicator";
import { DateNav } from "@/components/date-nav";
import {
  avgCaloriesLastN,
  daysSinceLastWorkout,
  foodStreak,
  lastNDayFlags,
  weightDelta,
  workoutStreak,
} from "@/lib/progress";
import { plannedTemplate } from "@/lib/cycle";
import { computeAge, computeMaintenance } from "@/lib/profile";

export default function HomePage() {
  const { hydrated, state } = useStore();
  const [date, setDate] = useState<string>(() => todayISO());

  useEffect(() => {
    setDate(todayISO());
  }, []);

  const dayOfWeek = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }, [date]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const settings = state.settings;
  const scheduledTemplateId = plannedTemplate(date, settings);
  const template = settings.templates.find(
    (t) => t.id === scheduledTemplateId
  );
  const log = state.workoutLogs[date];
  const foodLog = state.foodLogs[date];
  const ws = workoutStreak(state, date);
  const fs = foodStreak(state, date);
  const wFlags = lastNDayFlags(state, date, 7, "workout");
  const fFlags = lastNDayFlags(state, date, 7, "food");

  const { current: currentWeight, delta: weight7Delta } = weightDelta(
    state,
    date,
    7
  );
  const age = computeAge(settings.dob, date);

  let maintenance = settings.maintenanceCalories ?? settings.targets.calories;
  if (
    age != null &&
    settings.sex &&
    settings.lifestyleFactor &&
    currentWeight != null
  ) {
    maintenance = computeMaintenance(
      currentWeight,
      settings.heightCm,
      age,
      settings.sex,
      settings.lifestyleFactor
    );
  }
  const cal = avgCaloriesLastN(state, date, 7);
  const calDelta = cal.avg != null ? cal.avg - maintenance : null;

  const targets = settings.targets;
  const calConsumed = foodLog?.calories ?? 0;
  const calRemaining = Math.max(0, targets.calories - calConsumed);
  const proConsumed = foodLog?.proteinG ?? 0;
  const carbs = foodLog?.carbsG ?? 0;
  const fats = foodLog?.fatsG ?? 0;
  const fibre = foodLog?.fiberG ?? 0;

  const totalSets = log?.entries
    ? Object.values(log.entries).reduce((s, e) => s + e.length, 0)
    : 0;
  const targetSets = template
    ? template.exercises.reduce((s, e) => s + e.sets, 0)
    : 0;
  const completedExercises = log?.entries
    ? Object.values(log.entries).filter((e) => e.length > 0).length
    : 0;
  const totalExercises = template?.exercises.length ?? 0;
  const workoutPct =
    totalSets > 0 && targetSets > 0
      ? Math.min(100, Math.round((totalSets / targetSets) * 100))
      : 0;

  const weeklySessions = wFlags.filter(Boolean).length;
  const offDays = daysSinceLastWorkout(state, date);

  // Goal progress
  const goal = settings.goalWeightKg;
  const goalGap =
    goal != null && currentWeight != null ? +(currentWeight - goal).toFixed(1) : null;

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {DAY_NAMES[dayOfWeek]}
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              Home
            </h1>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(date)}
              <SaveIndicator />
            </p>
          </div>
        </div>
        <DateNav date={date} onChange={(d) => setDate(d)} />
      </header>

      {/* Today's workout — primary call-to-action card */}
      <Link
        href="/workout"
        className="group block focus-visible:outline-none"
        aria-label="Open today's workout"
      >
        <Card className="relative overflow-hidden border-border/70 transition-colors group-hover:border-foreground/40 group-focus-visible:border-foreground/60">
          <div className="flex items-stretch gap-3 px-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Today&apos;s workout
                </span>
                {template && (
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                      CATEGORY_ACCENT[template.category]
                    )}
                  >
                    {CATEGORY_LABEL[template.category]}
                  </span>
                )}
              </div>
              <p className="truncate text-xl font-semibold leading-tight">
                {template?.name ?? "Rest day"}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {totalExercises > 0
                  ? `${completedExercises}/${totalExercises} exercises · ${totalSets}/${targetSets} sets`
                  : "Recovery scheduled"}
              </p>
              {totalExercises > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all"
                    style={{ width: `${workoutPct}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center self-center">
              <span className="inline-flex items-center justify-center rounded-full border border-border/60 bg-card/60 px-3 py-2 text-sm font-medium transition-colors group-hover:border-foreground/40">
                Start
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </Card>
      </Link>

      {/* Calories + Protein primary nutrition cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          href="/food"
          icon={<Flame className="h-3.5 w-3.5 text-rose-400" />}
          label="Calories left"
          value={`${calRemaining}`}
          unit="kcal"
          progress={Math.min(100, (calConsumed / targets.calories) * 100)}
          progressColor="bg-rose-500"
          sub={`${Math.round(calConsumed)} / ${targets.calories}`}
        />
        <StatCard
          href="/food"
          icon={<Beef className="h-3.5 w-3.5 text-orange-400" />}
          label="Protein"
          value={`${Math.round(proConsumed)}`}
          unit="g"
          progress={Math.min(100, (proConsumed / targets.proteinG) * 100)}
          progressColor="bg-orange-500"
          sub={`target ${targets.proteinG}g`}
        />
      </div>

      {/* Quick macro row */}
      <Card className="border-border/70">
        <div className="grid grid-cols-3 gap-2 px-4">
          <MacroMini
            icon={<Wheat className="h-3 w-3 text-amber-400" />}
            label="Carbs"
            value={carbs}
            target={targets.carbsG ?? 280}
          />
          <MacroMini
            icon={<Droplets className="h-3 w-3 text-yellow-300" />}
            label="Fats"
            value={fats}
            target={targets.fatsG ?? 70}
          />
          <MacroMini
            icon={<Leaf className="h-3 w-3 text-emerald-400" />}
            label="Fibre"
            value={fibre}
            target={targets.fiberG ?? 30}
          />
        </div>
      </Card>

      <StreakBar
        workoutStreak={ws}
        foodStreak={fs}
        workoutFlags={wFlags}
        foodFlags={fFlags}
      />

      {/* Bodyweight + BMI + goal */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <WeightPill date={date} />
          <HeightPill />
        </div>
        <BmiBar
          weightKg={
            settings.unit === "lb" && currentWeight != null
              ? currentWeight / 2.2046
              : currentWeight
          }
          heightCm={settings.heightCm}
        />
      </div>

      {/* Secondary insight cards */}
      <div className="grid grid-cols-2 gap-2">
        <MiniCard
          icon={<Scale className="h-3.5 w-3.5 text-sky-400" />}
          label="7d weight"
          value={
            weight7Delta != null
              ? `${weight7Delta > 0 ? "+" : ""}${weight7Delta.toFixed(1)} ${settings.unit}`
              : "—"
          }
          tone={
            weight7Delta == null
              ? "neutral"
              : (goal != null &&
                  currentWeight != null &&
                  ((currentWeight > goal && weight7Delta < 0) ||
                    (currentWeight < goal && weight7Delta > 0)))
                ? "good"
                : "neutral"
          }
          sub="vs 7 days ago"
        />
        <MiniCard
          icon={<Flame className="h-3.5 w-3.5 text-orange-400" />}
          label="7d avg"
          value={
            calDelta != null
              ? `${calDelta > 0 ? "+" : ""}${calDelta} kcal/d`
              : "—"
          }
          tone={
            calDelta == null
              ? "neutral"
              : calDelta < 0
                ? "good"
                : "warn"
          }
          sub={
            cal.avg != null
              ? `${cal.daysCounted}d · vs ${maintenance}`
              : "no data"
          }
        />
        <MiniCard
          icon={<Target className="h-3.5 w-3.5 text-emerald-400" />}
          label="Goal"
          value={
            goalGap != null
              ? Math.abs(goalGap) < 0.5
                ? "At goal"
                : `${goalGap > 0 ? "−" : "+"}${Math.abs(goalGap)} ${settings.unit}`
              : "—"
          }
          tone={goalGap != null && Math.abs(goalGap) < 0.5 ? "good" : "neutral"}
          sub={goal != null ? `target ${goal} ${settings.unit}` : "no goal set"}
        />
        <MiniCard
          icon={<CalendarDays className="h-3.5 w-3.5 text-violet-400" />}
          label="This week"
          value={`${weeklySessions}/7`}
          tone={weeklySessions >= 4 ? "good" : "neutral"}
          sub={
            offDays === null
              ? "no sessions yet"
              : offDays === 0
                ? "lifted today"
                : `${offDays}d since last`
          }
        />
      </div>
    </div>
  );
}

type Tone = "good" | "neutral" | "warn" | "bad";

function StatCard({
  href,
  icon,
  label,
  value,
  unit,
  sub,
  progress,
  progressColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  progress: number;
  progressColor: string;
}) {
  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none"
      aria-label={`${label}: ${value}`}
    >
      <Card className="border-border/70 transition-colors group-hover:border-foreground/40 group-focus-visible:border-foreground/60">
        <div className="space-y-1.5 px-4">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {icon}
            {label}
            <ChevronRight className="ml-auto h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100" />
          </span>
          <p className="font-mono text-2xl font-semibold leading-none tabular-nums">
            {value}
            {unit && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </p>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressColor
              )}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          {sub && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {sub}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}

function MacroMini({
  icon,
  label,
  value,
  target,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
}) {
  const display = Math.round(value * 10) / 10;
  const pct = Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      <p className="font-mono text-base font-semibold leading-none tabular-nums">
        {display}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
          / {target}g
        </span>
      </p>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MiniCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
}) {
  const colors: Record<Tone, string> = {
    good: "text-emerald-400",
    neutral: "text-foreground",
    warn: "text-orange-400",
    bad: "text-rose-400",
  };
  return (
    <Card className="border-border/70">
      <div className="space-y-0.5 px-4">
        <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {icon}
          {label}
        </span>
        <span
          className={cn(
            "font-mono text-base font-semibold tabular-nums",
            colors[tone]
          )}
        >
          {value}
        </span>
        {sub && (
          <span className="block font-mono text-[10px] text-muted-foreground">
            {sub}
          </span>
        )}
      </div>
    </Card>
  );
}
