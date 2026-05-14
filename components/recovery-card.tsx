"use client";

import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Battery, BatteryLow, BatteryMedium } from "lucide-react";
import type { Recovery } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: Recovery;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}[] = [
  { value: "good", label: "Good", icon: Battery, hint: "Fresh, ready to push" },
  { value: "okay", label: "Okay", icon: BatteryMedium, hint: "A bit sore" },
  { value: "poor", label: "Poor", icon: BatteryLow, hint: "Trashed" },
];

export function RecoveryCard({
  date,
  optional,
}: {
  date: string;
  optional?: boolean;
}) {
  const { state, setRecovery, setDidOptional, markRestComplete } = useStore();
  const log = state.workoutLogs[date];
  const recovery = log?.recovery;
  const didOptional = log?.didOptional;
  const completedRest = log?.completedRest;

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How did you recover?</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = recovery === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setRecovery(date, o.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{o.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {o.hint}
                </span>
              </button>
            );
          })}
        </div>

        {optional && (
          <div className="space-y-2 rounded-lg border border-dashed border-border/60 p-3">
            <p className="text-sm font-medium">
              Today is the optional pump session.
            </p>
            <p className="text-xs text-muted-foreground">
              Recovery says:{" "}
              <span className="font-medium text-foreground">
                {recovery
                  ? recovery === "good"
                    ? "you can hit it"
                    : recovery === "okay"
                    ? "go light or skip"
                    : "skip and rest"
                  : "log recovery first"}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                size="sm"
                variant={didOptional ? "default" : "outline"}
                onClick={() => setDidOptional(date, true)}
              >
                Hit the gym
              </Button>
              <Button
                size="sm"
                variant={didOptional === false ? "default" : "outline"}
                onClick={() => setDidOptional(date, false)}
              >
                Take rest
              </Button>
            </div>
          </div>
        )}

        {!optional && (
          <Button
            variant={completedRest ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={() => markRestComplete(date, !completedRest)}
          >
            {completedRest ? "Rest logged ✓" : "Mark rest day complete"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
