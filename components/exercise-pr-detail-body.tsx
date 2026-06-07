"use client";

import { useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import {
  allTimeBests,
  exerciseHistory,
  loadDirectionFor,
  type Direction,
  type SessionSummary,
} from "@/lib/pr";
import { cn, shortDate } from "@/lib/utils";
import type { TemplateExercise, Unit } from "@/lib/types";

type MetricKey =
  | "maxWeight"
  | "bestReps"
  | "best1RM"
  | "totalVolume"
  | "totalReps"
  | "completedSets";

type Metric = {
  key: MetricKey;
  label: string;
  // When true and the exercise is assistance-load, lower raw values are
  // better, so the chart is flipped vertically (less assistance trends up).
  assistInverts?: boolean;
  value: (s: SessionSummary) => number;
  format: (n: number, unit: Unit) => string;
};

const METRICS: Metric[] = [
  {
    key: "maxWeight",
    label: "Best Weight",
    assistInverts: true,
    value: (s) => s.maxWeight,
    format: (n, unit) => `${round1(n)} ${unit}`,
  },
  {
    key: "bestReps",
    label: "Best Reps",
    value: (s) => s.bestRepsAtMaxWeight,
    format: (n) => `${n}`,
  },
  {
    key: "best1RM",
    label: "Est. 1RM",
    value: (s) => s.best1RM,
    format: (n, unit) => `${round1(n)} ${unit}`,
  },
  {
    key: "totalVolume",
    label: "Total Volume",
    value: (s) => s.totalVolume,
    format: (n, unit) => `${Math.round(n)} ${unit}`,
  },
  {
    key: "totalReps",
    label: "Total Reps",
    value: (s) => s.totalReps,
    format: (n) => `${n}`,
  },
  {
    key: "completedSets",
    label: "Set Completion",
    value: (s) => s.completedSets,
    format: (n) => `${n} sets`,
  },
];

// Direction-aware label so assistance-load lifts read clearly ("Least
// assistance" instead of the misleading "Best Weight").
function metricLabel(m: Metric, direction: Direction): string {
  if (direction === "assistance") {
    if (m.key === "maxWeight") return "Least assistance";
    if (m.key === "bestReps") return "Reps at least assist";
  }
  return m.label;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type PRType = "weight" | "rep" | "e1rm" | "volume";

function computePREvents(
  sessions: SessionSummary[],
  direction: Direction = "normal"
): Map<string, PRType[]> {
  const out = new Map<string, PRType[]>();
  // For assistance loads "best" is the lowest value, so seed with +Inf
  // and compare with <.
  let maxWeight = direction === "assistance" ? Infinity : 0;
  let best1RM = 0;
  let bestVolume = 0;
  const repsAtWeight = new Map<number, number>();
  const isBetterWeight = (a: number, b: number) =>
    direction === "assistance" ? a < b - 1e-6 : a > b + 1e-6;
  for (const s of sessions) {
    const events: PRType[] = [];
    let nextMaxWeight = maxWeight;
    let nextBest1RM = best1RM;
    let nextBestVolume = bestVolume;
    let repPR = false;
    if (Number.isFinite(maxWeight) && isBetterWeight(s.maxWeight, maxWeight)) {
      events.push("weight");
      nextMaxWeight = s.maxWeight;
    } else if (!Number.isFinite(maxWeight)) {
      // Seed the running best on the very first session WITHOUT firing a
      // weight PR — the first session can't beat itself.
      nextMaxWeight = s.maxWeight;
    }
    if (s.best1RM > best1RM + 1e-6) {
      events.push("e1rm");
      nextBest1RM = s.best1RM;
    }
    if (s.totalVolume > bestVolume + 1e-6) {
      events.push("volume");
      nextBestVolume = s.totalVolume;
    }
    for (const set of s.sets) {
      const prev = repsAtWeight.get(set.weight) ?? 0;
      if (prev > 0 && set.reps > prev) repPR = true;
    }
    if (repPR) events.push("rep");
    if (events.length > 0) out.set(s.date, events);
    // Update running bests AFTER recording the event so the first session
    // never counts as a PR against itself.
    maxWeight = nextMaxWeight;
    best1RM = nextBest1RM;
    bestVolume = nextBestVolume;
    for (const set of s.sets) {
      const prev = repsAtWeight.get(set.weight) ?? 0;
      if (set.reps > prev) repsAtWeight.set(set.weight, set.reps);
    }
  }
  return out;
}

export default function ExercisePRDetailBody({
  exercise,
  date,
  unit,
  variant,
}: {
  exercise: Pick<TemplateExercise, "id" | "name" | "sets" | "repsHigh">;
  date: string;
  unit: Unit;
  variant?: string;
}) {
  const { state } = useStore();
  const [showAll, setShowAll] = useState(false);
  const filterVariant = showAll ? undefined : variant;
  const direction = loadDirectionFor(exercise.id, {
    exercise,
    variant,
    settings: state.settings,
  });
  const isAssist = direction === "assistance";
  const sessions = useMemo(
    () => exerciseHistory(state, exercise.id, filterVariant, direction),
    [state, exercise.id, filterVariant, direction]
  );
  const past = useMemo(
    () => sessions.filter((s) => s.date <= date),
    [sessions, date]
  );
  const bests = useMemo(() => allTimeBests(past, direction), [past, direction]);
  const prEvents = useMemo(
    () => computePREvents(past, direction),
    [past, direction]
  );
  const [metricKey, setMetricKey] = useState<MetricKey>("maxWeight");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const lastSession = past[past.length - 1];

  return (
    <>
      {variant && variant !== "default" && (
        <div className="px-4">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
              showAll
                ? "border-foreground bg-foreground text-background"
                : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {showAll ? "Showing all variants" : "Show all variants"}
          </button>
        </div>
      )}

      <div className="space-y-4 px-4 pb-6">
        {/* All-time best chips */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label={isAssist ? "Least assist." : "Best weight"}
            value={
              bests.maxWeight > 0 ? `${round1(bests.maxWeight)} ${unit}` : "—"
            }
          />
          <Stat
            label={isAssist ? "Reps at least" : "Reps at best"}
            value={
              bests.bestRepsAtMaxWeight > 0
                ? `${bests.bestRepsAtMaxWeight}`
                : "—"
            }
          />
          <Stat
            label="Est. 1RM"
            value={bests.best1RM > 0 ? `${round1(bests.best1RM)} ${unit}` : "—"}
          />
          <Stat
            label="Best volume"
            value={
              bests.bestVolume > 0 ? `${Math.round(bests.bestVolume)} ${unit}` : "—"
            }
          />
        </div>

        {lastSession && (
          <div className="rounded-lg border border-border/60 bg-card/50 p-3 text-xs">
            <p className="font-mono uppercase tracking-wider text-muted-foreground">
              Last session · {shortDate(lastSession.date)}
            </p>
            <p className="mt-1 text-foreground">
              {lastSession.completedSets}/{exercise.sets} sets ·{" "}
              {isAssist ? "least assist" : "top"} {lastSession.maxWeight} {unit} ×{" "}
              {lastSession.bestRepsAtMaxWeight} reps · est 1RM{" "}
              {round1(lastSession.best1RM)} {unit} · volume{" "}
              {Math.round(lastSession.totalVolume)} {unit}
            </p>
          </div>
        )}

        {/* Metric tabs */}
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetricKey(m.key)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors",
                m.key === metricKey
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {metricLabel(m, direction)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMetricKey("maxWeight")}
            className={cn(
              "rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-300"
            )}
            aria-label="Reset metric"
          >
            <Flame className="mr-1 inline h-3 w-3" /> PR events
          </button>
        </div>

        <MetricGraph
          sessions={past}
          metric={metric}
          unit={unit}
          direction={direction}
          prEvents={prEvents}
        />

        {/* PR events list */}
        <div>
          <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            PR events
          </p>
          <PREventList prEvents={prEvents} />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm tabular-nums">{value}</p>
    </div>
  );
}

function MetricGraph({
  sessions,
  metric,
  unit,
  direction,
  prEvents,
}: {
  sessions: SessionSummary[];
  metric: Metric;
  unit: Unit;
  direction: Direction;
  prEvents: Map<string, PRType[]>;
}) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
        No history yet — log this exercise to build a graph.
      </div>
    );
  }
  // For assistance-load lifts on a "lower is better" metric, flip the chart so
  // dropping assistance visually trends UP — matching how the lifter thinks
  // about progress.
  const invert = direction === "assistance" && !!metric.assistInverts;
  const values = sessions.map((s) => metric.value(s));
  const max = Math.max(...values);
  const min = Math.min(...values.filter((v) => v > 0), 0);
  const W = 320;
  const H = 140;
  const xPad = 28;
  const yPad = 14;
  const xFor = (i: number) =>
    sessions.length === 1
      ? W / 2
      : xPad + (i / (sessions.length - 1)) * (W - xPad * 1.5);
  const yFor = (v: number) => {
    if (max === min) return H / 2;
    const t = (v - min) / (max - min);
    return invert
      ? yPad + t * (H - yPad * 2)
      : H - yPad - t * (H - yPad * 2);
  };
  const path = sessions
    .map((s, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(values[i])}`)
    .join(" ");

  const lastIdx = sessions.length - 1;

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{metricLabel(metric, direction)}</span>
        <span className="tabular-nums text-foreground">
          {metric.format(values[lastIdx], unit)}
        </span>
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
        aria-label={`${metricLabel(metric, direction)} history`}
      >
        <path
          d={path}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sessions.map((s, i) => {
          const isPR = prEvents.has(s.date);
          return (
            <g key={s.date}>
              <circle
                cx={xFor(i)}
                cy={yFor(values[i])}
                r={isPR ? 3.5 : 2}
                className={cn(isPR ? "fill-amber-400" : "fill-foreground")}
              />
              {isPR && (
                <circle
                  cx={xFor(i)}
                  cy={yFor(values[i])}
                  r={6}
                  className="fill-amber-400/20"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{shortDate(sessions[0].date)}</span>
        {sessions.length > 2 && (
          <span>{shortDate(sessions[Math.floor(sessions.length / 2)].date)}</span>
        )}
        <span>{shortDate(sessions[lastIdx].date)}</span>
      </div>
      {invert && (
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-wider text-cyan-300/80">
          Up = less assistance = stronger
        </p>
      )}
    </div>
  );
}

const PR_LABEL: Record<PRType, string> = {
  weight: "Weight PR",
  rep: "Rep PR",
  e1rm: "Strength PR",
  volume: "Volume PR",
};

const PR_TONE: Record<PRType, string> = {
  weight: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  rep: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  e1rm: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  volume: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

function PREventList({ prEvents }: { prEvents: Map<string, PRType[]> }) {
  const items = Array.from(prEvents.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 8);
  if (items.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No PRs logged yet for this exercise.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map(([date, types]) => (
        <li
          key={date}
          className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-card/30 px-2.5 py-1.5"
        >
          <span className="font-mono text-xs text-muted-foreground">
            {shortDate(date)}
          </span>
          <span className="flex flex-wrap justify-end gap-1">
            {types.map((t) => (
              <Badge
                key={t}
                className={cn(
                  "border font-mono text-[10px] uppercase tracking-wider",
                  PR_TONE[t]
                )}
              >
                {PR_LABEL[t]}
              </Badge>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
