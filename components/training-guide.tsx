"use client";

import { useState } from "react";
import { HelpCircle, PlayCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MODE_DEFAULTS,
  getExerciseGuide,
  type Intent,
} from "@/lib/exercise-guides";
import { getExerciseTutorialUrl } from "@/lib/tutorial";
import type { TemplateExercise } from "@/lib/types";

// Detects roughly what training intent the exercise represents.
function intentFor(exercise: TemplateExercise): Intent {
  // Treat low rep ranges (≤8 top) as strength, everything else as
  // hypertrophy / accessory.
  return exercise.repsHigh <= 8 ? "strength" : "hypertrophy";
}

const INTENT_LABEL: Record<Intent, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
};

// "When to add weight" copy — same rule for both intents, kept mode-keyed so
// it can diverge later if needed.
const PROGRESSION: Record<Intent, string> = {
  strength:
    "Add weight only when every prescribed set hits the top of the rep range with clean form.",
  hypertrophy:
    "Only add weight when every set hits the top of the rep range with clean form — otherwise add a rep.",
};

export function TrainingGuide({
  exercise,
  variantLabel,
  intent: intentProp,
}: {
  exercise: TemplateExercise;
  variantLabel?: string;
  // The day's training intent (strength vs hypertrophy). Driven by the
  // template/day so a strength day reads as strength for every exercise.
  // Falls back to per-exercise rep-range detection when not provided.
  intent?: Intent;
}) {
  const [open, setOpen] = useState(false);
  const intent = intentProp ?? intentFor(exercise);
  const guide = getExerciseGuide(exercise.id);
  const tip = guide?.[intent] ?? MODE_DEFAULTS[intent];
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
              <DialogTitle>{exercise.name}</DialogTitle>
              <DialogDescription>
                {INTENT_LABEL[intent]} · {exercise.sets} sets of {repsRange} reps
                {variantLabel ? ` · ${variantLabel}` : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm leading-relaxed">
              {guide?.media?.gifSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.media.gifSrc}
                  alt={`${exercise.name} form demonstration`}
                  className="w-full rounded-md border border-border/60"
                />
              )}
              {guide && (
                <>
                  <GuideRow label="Targets">{guide.targets}</GuideRow>
                  <div>
                    <RowLabel>How to</RowLabel>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-foreground/90">
                      {guide.howTo.map((cue, i) => (
                        <li key={i}>{cue}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
              <GuideRow label="Tempo">{tip.tempo}</GuideRow>
              <GuideRow label="Rest">{tip.rest}</GuideRow>
              {guide && (
                <GuideRow label="Common mistake">{guide.mistake}</GuideRow>
              )}
              <GuideRow label="When to add weight">
                {PROGRESSION[intent]}
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
              <a
                href={getExerciseTutorialUrl(exercise.name)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <PlayCircle />
                Watch form video
              </a>
              <Button onClick={() => setOpen(false)}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
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
      <RowLabel>{label}</RowLabel>
      <p className="mt-0.5 text-foreground/90">{children}</p>
    </div>
  );
}
