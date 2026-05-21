"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateExercise } from "@/lib/types";

// Detects roughly what training intent the exercise represents.
function intentFor(exercise: TemplateExercise): "strength" | "hypertrophy" {
  // Treat low rep ranges (≤8 top) as strength, everything else as
  // hypertrophy / accessory.
  return exercise.repsHigh <= 8 ? "strength" : "hypertrophy";
}

const TIPS = {
  strength: {
    title: "Train for strength",
    rest: "Rest 2–3 min between working sets so the next set isn't compromised.",
    tempo:
      "Lower under control (~2 sec), pause briefly, then drive up explosively but with clean form.",
    progression:
      "Add weight only when every prescribed set hits the top of the rep range with clean form.",
  },
  hypertrophy: {
    title: "Train for hypertrophy",
    rest: "Rest 60–90 sec — enough to recover, not so much you lose the pump.",
    tempo:
      "Slow, controlled lowering (~2–3 sec). Avoid rushing. Full range of motion beats bouncy partials.",
    progression:
      "Same rule: only add weight when every set hits the top of the rep range with clean form.",
  },
};

export function TrainingGuide({
  exercise,
  variantLabel,
}: {
  exercise: TemplateExercise;
  variantLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const intent = intentFor(exercise);
  const tips = TIPS[intent];
  const repsRange =
    exercise.repsLow === exercise.repsHigh
      ? `${exercise.repsLow}`
      : `${exercise.repsLow}–${exercise.repsHigh}`;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setOpen(true)}
        aria-label="How to train this exercise"
        title="How to train this"
        className="text-muted-foreground hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="max-w-sm" data-no-swipe>
            <DialogHeader>
              <DialogTitle>{tips.title}</DialogTitle>
              <DialogDescription>
                Target {exercise.sets} sets of {repsRange} reps
                {variantLabel ? ` · ${variantLabel}` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm leading-relaxed">
              <GuideRow label="Tempo">{tips.tempo}</GuideRow>
              <GuideRow label="Rest">{tips.rest}</GuideRow>
              <GuideRow label="When to add weight">
                {tips.progression}
              </GuideRow>
              <div className="rounded-md border border-border/60 bg-card/40 p-2.5 text-xs text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground/90">
                    Strength
                  </span>{" "}
                  uses heavier loads and lower reps (≤8) to push performance.
                </p>
                <p className="mt-1">
                  <span className="font-medium text-foreground/90">
                    Hypertrophy
                  </span>{" "}
                  uses moderate loads and 8–15+ reps to stimulate muscle
                  growth — keep tension on the muscle.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Got it
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function GuideRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-foreground/90">{children}</p>
    </div>
  );
}
