"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DEFAULT_BARBELL_KG,
  DEFAULT_PLATES_KG,
  DEFAULT_PLATES_LB,
  platesPerSide,
} from "@/lib/plates";
import type { Unit } from "@/lib/types";

export function PlateCalc({
  weight,
  unit,
}: {
  weight: number;
  unit: Unit;
}) {
  const [open, setOpen] = useState(false);
  const barbell = unit === "kg" ? DEFAULT_BARBELL_KG : 45;
  const plates = unit === "kg" ? DEFAULT_PLATES_KG : DEFAULT_PLATES_LB;

  if (!Number.isFinite(weight) || weight <= 0) return null;

  const { perSide, remainder } = platesPerSide(weight, barbell, plates);
  const empty = perSide.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="rounded-md border border-border/60 bg-muted/30 px-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground"
            aria-label="Show plate breakdown"
            onClick={(e) => e.stopPropagation()}
          >
            <Calculator className="h-3 w-3" />
          </button>
        }
      />
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="font-mono">
            {weight} {unit}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            barbell {barbell} {unit} · per side
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {empty && weight <= barbell && (
            <p className="text-sm text-muted-foreground">
              Just the bar — no plates needed.
            </p>
          )}
          {empty && weight > barbell && (
            <p className="text-sm text-muted-foreground">
              {((weight - barbell) / 2).toFixed(2)} {unit} per side — no
              standard plates fit.
            </p>
          )}
          {perSide.map(({ plate, count }) => (
            <div
              key={plate}
              className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/60 px-3 py-2 font-mono text-sm"
            >
              <span>
                {plate} {unit}
              </span>
              <span className="text-muted-foreground">×</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
          {remainder > 1e-3 && (
            <p className="font-mono text-xs text-amber-400">
              + {remainder.toFixed(2)} {unit} short
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
