"use client";

import { Dumbbell, Flame, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

export function StreakBar({
  workoutStreak,
  foodStreak,
  workoutFlags,
  foodFlags,
}: {
  workoutStreak: number;
  foodStreak: number;
  workoutFlags: boolean[];
  foodFlags: boolean[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StreakCard
        label="Workout"
        streak={workoutStreak}
        flags={workoutFlags}
        icon={<Dumbbell className="h-3.5 w-3.5" />}
        color="text-orange-400"
      />
      <StreakCard
        label="Food"
        streak={foodStreak}
        flags={foodFlags}
        icon={<Utensils className="h-3.5 w-3.5" />}
        color="text-emerald-400"
      />
    </div>
  );
}

function StreakCard({
  label,
  streak,
  flags,
  icon,
  color,
}: {
  label: string;
  streak: number;
  flags: boolean[];
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="flex items-center gap-1 font-mono text-sm">
          <Flame className={cn("h-3.5 w-3.5", color)} />
          {streak}
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {flags.map((on, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              on ? "bg-foreground" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}
