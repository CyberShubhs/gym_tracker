"use client";

import { useStore } from "@/lib/store";
import { exerciseHistory, loadDirectionFor } from "@/lib/pr";
import { cn } from "@/lib/utils";

export function PrLadder({
  exerciseId,
  beforeDate,
  unit,
  variant,
}: {
  exerciseId: string;
  beforeDate: string;
  unit: string;
  variant?: string;
}) {
  const { state } = useStore();
  const direction = loadDirectionFor(exerciseId, {
    variant,
    settings: state.settings,
  });
  const sessions = exerciseHistory(
    state,
    exerciseId,
    variant,
    direction
  ).filter((s) => s.date <= beforeDate);
  const last = sessions.slice(-5);
  if (last.length < 2) return null;

  const min = Math.min(...last.map((s) => s.best1RM));
  const max = Math.max(...last.map((s) => s.best1RM));
  const W = 80;
  const H = 22;
  const xFor = (i: number) =>
    last.length === 1 ? W / 2 : (i / (last.length - 1)) * (W - 4) + 2;
  const yFor = (v: number) => {
    if (max === min) return H / 2;
    return H - 2 - ((v - min) / (max - min)) * (H - 4);
  };
  const path = last
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(s.best1RM)}`)
    .join(" ");

  // For "assistance" exercises, a downward arrow on the ladder is good
  // (less machine help) — flip the colors so the visual cue matches the
  // direction of progress.
  const trend = last[last.length - 1].maxWeight - last[0].maxWeight;
  const goodSign = direction === "assistance" ? -1 : 1;
  const trendColor =
    trend * goodSign > 0
      ? "stroke-emerald-400"
      : trend * goodSign < 0
      ? "stroke-rose-400"
      : "stroke-muted-foreground";

  return (
    <div className="flex items-center gap-1.5">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        aria-label="PR ladder"
      >
        <path
          d={path}
          fill="none"
          className={cn(trendColor)}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {last.map((s, i) => (
          <circle
            key={s.date}
            cx={xFor(i)}
            cy={yFor(s.best1RM)}
            r={1.5}
            className="fill-foreground"
          />
        ))}
      </svg>
      <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
        {last[last.length - 1].maxWeight}
        {unit}
      </span>
    </div>
  );
}
