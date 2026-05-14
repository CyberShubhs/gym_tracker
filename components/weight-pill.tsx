"use client";

import { useState } from "react";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useStore } from "@/lib/store";
import { weightDelta } from "@/lib/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function WeightPill({ date }: { date: string }) {
  const { state, setWeight } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [bodyFatDraft, setBodyFatDraft] = useState("");

  const { current, delta } = weightDelta(state, date, 7);
  const unit = state.settings.unit;
  const todayLog = state.weightLogs[date];

  const onOpen = (next: boolean) => {
    if (next) {
      setDraft(todayLog ? String(todayLog.weight) : current ? String(current) : "");
      setBodyFatDraft(
        todayLog?.bodyFatPct != null ? String(todayLog.bodyFatPct) : ""
      );
    }
    setOpen(next);
  };

  const save = () => {
    const w = parseFloat(draft);
    if (!Number.isFinite(w) || w <= 0 || w > 500) {
      setOpen(false);
      return;
    }
    const bf = parseFloat(bodyFatDraft);
    const validBf = Number.isFinite(bf) && bf > 0 && bf < 80;
    setWeight(date, w, validBf ? bf : undefined);
    setOpen(false);
  };

  const TrendIcon =
    delta == null
      ? Minus
      : delta > 0.05
      ? TrendingUp
      : delta < -0.05
      ? TrendingDown
      : Minus;
  const trendColor =
    delta == null
      ? "text-muted-foreground"
      : delta > 0.05
      ? "text-orange-400"
      : delta < -0.05
      ? "text-emerald-400"
      : "text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogTrigger
        render={
          <button className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-card/80">
            <span className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted-foreground" />
              <span className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Bodyweight
                </span>
                <span className="font-mono text-base font-semibold">
                  {current != null ? `${current} ${unit}` : "Tap to log"}
                  {todayLog?.bodyFatPct != null && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      · {todayLog.bodyFatPct}%
                    </span>
                  )}
                </span>
              </span>
            </span>
            {delta != null && (
              <span
                className={`flex items-center gap-1 font-mono text-xs ${trendColor}`}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)} {unit}
                <span className="text-muted-foreground">/7d</span>
              </span>
            )}
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log bodyweight</DialogTitle>
          <DialogDescription>
            Records today&apos;s weight. Compares against the closest entry from
            7 days ago.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="weight-input">Weight ({unit})</Label>
          <Input
            id="weight-input"
            inputMode="decimal"
            type="number"
            step="0.1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            className="font-mono text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bf-input">
            Body fat % <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bf-input"
            inputMode="decimal"
            type="number"
            step="0.1"
            value={bodyFatDraft}
            onChange={(e) =>
              setBodyFatDraft(e.target.value.replace(/[^0-9.]/g, ""))
            }
            placeholder="e.g. 22"
            className="font-mono text-base"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
