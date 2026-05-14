"use client";

import { Dumbbell, Flame, Target } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  avgCaloriesLastN,
  daysSinceLastWorkout,
  weightDelta,
} from "@/lib/progress";
import { computeAge, computeMaintenance } from "@/lib/profile";
import { cn } from "@/lib/utils";

export function DashboardPills({ date }: { date: string }) {
  const { state } = useStore();
  const settings = state.settings;
  const { current } = weightDelta(state, date, 0);
  const age = computeAge(settings.dob, date);

  let maintenance = settings.maintenanceCalories ?? settings.targets.calories;
  if (
    age != null &&
    settings.sex &&
    settings.lifestyleFactor &&
    current != null
  ) {
    maintenance = computeMaintenance(
      current,
      settings.heightCm,
      age,
      settings.sex,
      settings.lifestyleFactor
    );
  }
  const goal = settings.goalWeightKg;

  const cal = avgCaloriesLastN(state, date, 7);
  const calDelta = cal.avg != null ? cal.avg - maintenance : null;
  const offDays = daysSinceLastWorkout(state, date);
  const goalGap =
    goal != null && current != null ? +(current - goal).toFixed(1) : null;

  const pills: React.ReactNode[] = [];

  if (calDelta != null) {
    const deficit = calDelta < 0;
    pills.push(
      <Pill
        key="cal"
        icon={<Flame className="h-3 w-3" />}
        label={deficit ? "Deficit" : "Surplus"}
        value={`${calDelta > 0 ? "+" : ""}${calDelta} kcal/d`}
        sub={`${cal.daysCounted}d avg`}
        tone={deficit ? "good" : "warn"}
      />
    );
  }

  if (offDays != null) {
    pills.push(
      <Pill
        key="off"
        icon={<Dumbbell className="h-3 w-3" />}
        label={offDays === 0 ? "Lifted" : offDays === 1 ? "Yesterday" : "Off"}
        value={
          offDays === 0
            ? "today"
            : offDays === 1
            ? "1 day ago"
            : `${offDays} days`
        }
        tone={offDays <= 1 ? "good" : offDays <= 3 ? "neutral" : "bad"}
      />
    );
  }

  if (goalGap != null) {
    const onTrack = Math.abs(goalGap) < 0.5;
    pills.push(
      <Pill
        key="goal"
        icon={<Target className="h-3 w-3" />}
        label="Goal"
        value={
          onTrack
            ? "at goal"
            : `${goalGap > 0 ? "−" : "+"}${Math.abs(goalGap)} ${
                settings.unit
              }`
        }
        sub={`target ${goal} ${settings.unit}`}
        tone={onTrack ? "good" : "neutral"}
      />
    );
  }

  if (pills.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{pills}</div>
  );
}

type Tone = "good" | "neutral" | "warn" | "bad";

function Pill({
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
    <div className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("font-mono text-sm font-semibold", colors[tone])}>
        {value}
      </span>
      {sub && (
        <span className="font-mono text-[10px] text-muted-foreground">
          {sub}
        </span>
      )}
    </div>
  );
}
