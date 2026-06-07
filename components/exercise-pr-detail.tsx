"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, LineChart as LineIcon } from "lucide-react";
import { getExerciseTutorialUrl } from "@/lib/tutorial";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { loadDirectionFor } from "@/lib/pr";
import type { TemplateExercise, Unit } from "@/lib/types";

// Heavy body (full workout-history scan + SVG chart + PR lists) is split out
// and loaded only when the sheet actually opens. Keeping it out of the card's
// render path means swiping through exercises never pays for a chart the user
// hasn't opened.
const ExercisePRDetailBody = dynamic(
  () => import("@/components/exercise-pr-detail-body"),
  {
    ssr: false,
    loading: () => (
      <div className="px-4 pb-6">
        <div className="h-40 w-full animate-pulse rounded-lg border border-border/60 bg-card/40" />
      </div>
    ),
  }
);

export function ExercisePRDetail({
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
  const [open, setOpen] = useState(false);
  // Cheap (no history scan) — just resolves the load direction so the
  // description can flag assistance lifts before the body loads.
  const direction = loadDirectionFor(exercise.id, {
    exercise,
    variant,
    settings: state.settings,
  });
  const isAssist = direction === "assistance";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="View progress chart"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <LineIcon className="h-3.5 w-3.5" />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            <a
              href={getExerciseTutorialUrl(exercise.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline focus-visible:underline"
              aria-label={`Open tutorial for ${exercise.name}`}
            >
              <span>{exercise.name}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </a>
          </SheetTitle>
          <SheetDescription>
            {variant && variant !== "default"
              ? `Scoped to variant: ${variant}.`
              : "All-time PRs and progression history."}
            {isAssist && " Lower assistance is progress."}
          </SheetDescription>
        </SheetHeader>

        {open && (
          <ExercisePRDetailBody
            exercise={exercise}
            date={date}
            unit={unit}
            variant={variant}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
