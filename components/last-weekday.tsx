"use client";

import { CalendarClock } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, shortDate } from "@/lib/utils";
import { DAY_NAMES } from "@/lib/defaults";
import type { SetEntry } from "@/lib/types";

function topSet(sets: SetEntry[]): SetEntry | null {
  if (!sets || sets.length === 0) return null;
  let best = sets[0];
  let bestScore = best.weight * (1 + best.reps / 30);
  for (const s of sets) {
    const score = s.weight * (1 + s.reps / 30);
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function LastWeekday({ date }: { date: string }) {
  const { state } = useStore();
  const lastSame = addDays(date, -7);
  const log = state.workoutLogs[lastSame];
  if (!log || Object.keys(log.entries).length === 0) return null;

  const template = state.settings.templates.find(
    (t) => t.id === log.templateId
  );
  const exerciseNameById: Record<string, string> = {};
  for (const t of state.settings.templates) {
    for (const e of t.exercises) exerciseNameById[e.id] = e.name;
  }

  const [y, m, d] = lastSame.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const dayName = DAY_NAMES[dow];

  const rows = Object.entries(log.entries).map(([id, sets]) => ({
    id,
    name: exerciseNameById[id] ?? id,
    top: topSet(sets),
    setCount: sets.length,
  }));

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Last {dayName.slice(0, 3)} · {shortDate(lastSame)}
          </span>
          {template && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {template.name}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pt-0">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex items-baseline justify-between gap-2 font-mono text-xs"
          >
            <span className="truncate text-foreground">{r.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {r.top
                ? `${r.top.weight}${state.settings.unit} × ${r.top.reps}`
                : "—"}
              {r.setCount > 1 && (
                <span className="ml-1 text-[10px] opacity-60">
                  ({r.setCount} sets)
                </span>
              )}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
