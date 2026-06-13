"use client";

import type { Unit, WeightLog } from "@/lib/types";
import { weightTrend } from "@/lib/progress";

export function WeightChart({
  logs,
  unit,
}: {
  logs: WeightLog[];
  unit: Unit;
}) {
  if (logs.length < 2) return null;

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map((l) => l.weight);
  const { ma, ratePerWeek } = weightTrend(sorted);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const pad = Math.max(0.5, (max - min) * 0.15);
  const yMin = +(min - pad).toFixed(1);
  const yMax = +(max + pad).toFixed(1);

  const W = 600;
  const H = 180;
  const PAD_LEFT = 36;
  const PAD_RIGHT = 12;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 24;
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const xFor = (i: number) =>
    PAD_LEFT + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW);
  const yFor = (w: number) =>
    PAD_TOP + innerH - ((w - yMin) / (yMax - yMin)) * innerH;

  const path = sorted
    .map((l, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(l.weight)}`)
    .join(" ");

  // Smoothed (moving-average) trend line — aligned 1:1 with the sorted points.
  const maPath = ma
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(p.value)}`)
    .join(" ");

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    return { v: +v.toFixed(1), y: yFor(v) };
  });

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = last.weight - first.weight;
  const trend = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
  const trendColor =
    trend === "down"
      ? "text-emerald-400"
      : trend === "up"
      ? "text-orange-400"
      : "text-muted-foreground";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {sorted.length} entries · {first.date} → {last.date}
        </span>
        <span className={`font-mono text-xs ${trendColor}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)} {unit}
          {ratePerWeek != null && Math.abs(ratePerWeek) >= 0.05 && (
            <span className="text-muted-foreground">
              {" "}
              · ≈{ratePerWeek > 0 ? "+" : ""}
              {ratePerWeek.toFixed(1)} {unit}/wk
            </span>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Weight trend chart"
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={t.y}
              y2={t.y}
              className="stroke-border/40"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={t.y + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {t.v}
            </text>
          </g>
        ))}
        {ma.length >= 2 && (
          <path
            d={maPath}
            fill="none"
            className="stroke-emerald-400/70"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        <path
          d={path}
          fill="none"
          className="stroke-foreground"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sorted.map((l, i) => (
          <circle
            key={l.date}
            cx={xFor(i)}
            cy={yFor(l.weight)}
            r={2.5}
            className="fill-foreground"
          />
        ))}
      </svg>
    </div>
  );
}
