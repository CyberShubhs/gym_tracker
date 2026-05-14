"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Band = {
  label: string;
  min: number;
  max: number;
  color: string;
  bg: string;
};

const BANDS: Band[] = [
  { label: "Under", min: 0, max: 18.5, color: "text-sky-400", bg: "bg-sky-500" },
  { label: "Fit", min: 18.5, max: 25, color: "text-emerald-400", bg: "bg-emerald-500" },
  { label: "Over", min: 25, max: 30, color: "text-amber-400", bg: "bg-amber-500" },
  { label: "Obese", min: 30, max: 40, color: "text-rose-400", bg: "bg-rose-500" },
];

const SCALE_MIN = 15;
const SCALE_MAX = 35;

function categorize(bmi: number): Band {
  if (bmi < 18.5) return BANDS[0];
  if (bmi < 25) return BANDS[1];
  if (bmi < 30) return BANDS[2];
  return BANDS[3];
}

function pctOf(value: number) {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

export function BmiBar({
  weightKg,
  heightCm,
}: {
  weightKg: number | null;
  heightCm: number;
}) {
  const heightM = heightCm / 100;
  const bmi =
    weightKg && heightM > 0 ? weightKg / (heightM * heightM) : null;
  const band = bmi ? categorize(bmi) : null;
  const markerLeft = bmi ? pctOf(bmi) : 0;

  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              BMI
            </span>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {bmi ? bmi.toFixed(1) : "—"}
            </span>
          </div>
          {band && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                band.color,
                "border-current/30"
              )}
            >
              {band.label === "Fit"
                ? "Fit"
                : band.label === "Under"
                ? "Underweight"
                : band.label === "Over"
                ? "Overweight"
                : "Obese"}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="relative h-2.5 overflow-hidden rounded-full">
            <div className="absolute inset-y-0 left-0 bg-sky-500" style={{ width: `${pctOf(18.5)}%` }} />
            <div
              className="absolute inset-y-0 bg-emerald-500"
              style={{
                left: `${pctOf(18.5)}%`,
                width: `${pctOf(25) - pctOf(18.5)}%`,
              }}
            />
            <div
              className="absolute inset-y-0 bg-amber-500"
              style={{
                left: `${pctOf(25)}%`,
                width: `${pctOf(30) - pctOf(25)}%`,
              }}
            />
            <div
              className="absolute inset-y-0 bg-rose-500"
              style={{ left: `${pctOf(30)}%`, right: 0 }}
            />
            {bmi && (
              <div
                className="absolute inset-y-[-4px] w-1 rounded-full bg-foreground shadow-[0_0_0_2px_var(--background)]"
                style={{ left: `calc(${markerLeft}% - 2px)` }}
              />
            )}
          </div>
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>15</span>
            <span>18.5</span>
            <span>25</span>
            <span>30</span>
            <span>35+</span>
          </div>
        </div>

        {!bmi && (
          <p className="text-xs text-muted-foreground">
            Log your bodyweight to see BMI.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
