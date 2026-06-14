"use client";

import { memo, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronUp,
  Copy,
  Flame,
  MinusCircle,
  Pencil,
  Plus,
  Repeat,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { getExerciseTutorialUrl } from "@/lib/tutorial";
import type { Equipment, TemplateExercise, Unit, SetEntry } from "@/lib/types";
import type { Intent } from "@/lib/exercise-guides";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { daysAgo, cn } from "@/lib/utils";
import { PlateCalc } from "@/components/plate-calc";
import { RestTimerControls } from "@/components/rest-timer";
import { PrLadder } from "@/components/pr-ladder";
import { ExercisePRDetail } from "@/components/exercise-pr-detail";
import { TrainingGuide } from "@/components/training-guide";
import { VariantPicker } from "@/components/variant-picker";
import {
  bestSet,
  loadDirectionFor,
  nextLoadSuggestion,
  progressionAdvice,
  sessionPRs,
  type PRFlags,
} from "@/lib/pr";
import {
  allVariantsFor,
  normalizeVariantId,
  variantLabelFor,
} from "@/lib/variants";

const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  physio: "Physio",
  cardio: "Cardio",
};

const EQUIPMENT_TONE: Record<Equipment, string> = {
  barbell: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  dumbbell: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  machine: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  cable: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300",
  bodyweight: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
  physio: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  cardio: "border-rose-500/40 bg-rose-500/10 text-rose-300",
};

function inferEquipment(name: string): Equipment {
  const n = name.toLowerCase();
  if (/treadmill|cycle|bike|run|jog|incline walk|stairmaster|rower/.test(n))
    return "cardio";
  if (/stretch|mobility|physio|band|foam roll|rehab|isometric hold/.test(n))
    return "physio";
  if (/dumbbell|\bdb\b/.test(n)) return "dumbbell";
  if (/cable|rope|pulldown/.test(n)) return "cable";
  if (/machine|leg press|leg extension|leg curl|calf|preacher/.test(n))
    return "machine";
  if (/barbell|bench press|deadlift|squat|ohp|overhead.*press/.test(n))
    return "barbell";
  if (/dip|pull-up|pullup|chin-up|chinup|push-up|pushup/.test(n))
    return "bodyweight";
  return "barbell";
}

type Draft = { weight: string; reps: string };

const blankDraft: Draft = { weight: "", reps: "" };

function entriesToDrafts(
  entries: SetEntry[] | undefined,
  targetSets: number
): Draft[] {
  if (!entries || entries.length === 0) {
    return Array.from({ length: targetSets }, () => ({ ...blankDraft }));
  }
  return entries.map((e) => ({
    weight: String(e.weight),
    reps: String(e.reps),
  }));
}

function draftsToEntries(drafts: Draft[], variant?: string): SetEntry[] {
  const norm = normalizeVariantId(variant);
  const tag = norm === "default" ? undefined : norm;
  return drafts
    .map((d) => {
      const e: SetEntry = {
        weight: parseFloat(d.weight),
        reps: parseInt(d.reps, 10),
      };
      if (tag) e.variant = tag;
      return e;
    })
    .filter(
      (e) =>
        Number.isFinite(e.weight) &&
        Number.isFinite(e.reps) &&
        e.reps > 0 &&
        e.weight >= 0
    );
}

export const ExerciseCard = memo(function ExerciseCard({
  exercise,
  date,
  unit,
  intent,
}: {
  exercise: TemplateExercise;
  date: string;
  unit: Unit;
  intent?: Intent;
}) {
  const {
    state,
    setSets,
    setExerciseNote,
    setActiveVariant,
    addCustomVariant,
    removeCustomVariant,
    lastSessionFor,
  } = useStore();
  const todayLog = state.workoutLogs[date];
  const todaySets = todayLog?.entries[exercise.id];
  const persistentNote = state.settings.exerciseNotes?.[exercise.id] ?? "";
  const displayNote = persistentNote || exercise.notes || "";

  const customVariants = state.settings.customVariantsByExercise;
  // Pick a variant: if today's sets are already tagged, follow them; else
  // fall back to the user's last picked variant for this exercise.
  const todayVariant = todaySets?.find((s) => !!s.variant)?.variant;
  const storedActive = state.settings.activeVariantByExercise?.[exercise.id];
  const activeVariant = normalizeVariantId(todayVariant ?? storedActive);
  const variantOptions = allVariantsFor(exercise.id, customVariants);
  const variantLabel = variantLabelFor(
    activeVariant,
    customVariants?.[exercise.id]
  );

  const [drafts, setDrafts] = useState<Draft[]>(() =>
    entriesToDrafts(todaySets, exercise.sets)
  );

  useEffect(() => {
    setDrafts(entriesToDrafts(todaySets, exercise.sets));
  }, [date, exercise.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const direction = loadDirectionFor(exercise.id, {
    exercise,
    variant: activeVariant,
    settings: state.settings,
  });
  const isAssisted = direction === "assistance";
  // Memoised so a re-render that does NOT change the underlying logs (e.g. a
  // carousel drag frame) never re-scans the full workout history. They still
  // recompute when today's sets actually change.
  const last = useMemo(
    () => lastSessionFor(exercise.id, date, activeVariant),
    [lastSessionFor, exercise.id, date, activeVariant]
  );
  const flags = useMemo(
    () => sessionPRs(state, exercise.id, date, activeVariant, direction).flags,
    [state, exercise.id, date, activeVariant, direction]
  );
  const advice = useMemo(
    () => progressionAdvice(exercise, todaySets),
    [exercise, todaySets]
  );
  const equipment: Equipment =
    exercise.equipment ?? inferEquipment(exercise.name);
  // When today's work earned a progression, turn it into a concrete load —
  // direction-aware, so assisted lifts are told to REMOVE help.
  const suggestion = useMemo(() => {
    if (advice.status !== "ready" || !todaySets || todaySets.length === 0) {
      return null;
    }
    const top = bestSet(todaySets, direction);
    if (!top) return null;
    return nextLoadSuggestion(direction, equipment, top.weight, unit);
  }, [advice.status, todaySets, direction, equipment, unit]);

  const updateDraft = (idx: number, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const next = prev.map((d, i) => (i === idx ? { ...d, ...patch } : d));
      setSets(date, exercise.id, draftsToEntries(next, activeVariant));
      return next;
    });
  };

  const addSet = () => {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      const seed: Draft = last
        ? { weight: last.weight, reps: last.reps }
        : { ...blankDraft };
      const next = [...prev, seed];
      setSets(date, exercise.id, draftsToEntries(next, activeVariant));
      return next;
    });
  };

  const copyFromPreviousSession = () => {
    if (!last?.sets || last.sets.length === 0) return;
    setDrafts(() => {
      const seeded: Draft[] = last.sets.map((s) => ({
        weight: String(s.weight),
        reps: String(s.reps),
      }));
      setSets(date, exercise.id, draftsToEntries(seeded, activeVariant));
      return seeded;
    });
  };

  const duplicateLastSet = () => {
    setDrafts((prev) => {
      // Take the last *filled* set as the seed, else fall back to last row.
      const filled = [...prev].reverse().find(
        (d) => d.weight !== "" && d.reps !== ""
      );
      const seed: Draft = filled ?? prev[prev.length - 1] ?? blankDraft;
      const next = [...prev, { ...seed }];
      setSets(date, exercise.id, draftsToEntries(next, activeVariant));
      return next;
    });
  };

  const removeSet = (idx: number) => {
    setDrafts((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      const safe = next.length === 0 ? [{ ...blankDraft }] : next;
      setSets(date, exercise.id, draftsToEntries(safe, activeVariant));
      return safe;
    });
  };

  const onVariantChange = (nextVariant: string) => {
    const norm = normalizeVariantId(nextVariant);
    setActiveVariant(exercise.id, norm);
    // Re-tag today's sets so a mid-session "ah this is Technogym" picks
    // up retroactively. PR/last-session for the new variant takes effect
    // immediately.
    setSets(date, exercise.id, draftsToEntries(drafts, norm));
  };

  const repsTarget =
    exercise.repsLow === exercise.repsHigh
      ? `${exercise.repsLow}`
      : `${exercise.repsLow}–${exercise.repsHigh}`;

  const usesPlates = equipment === "barbell";

  const lastSummary = last?.sets?.[0]
    ? `${last.sets[0].weight}${unit} × ${last.sets[0].reps}${
        last.sets.length > 1 ? ` · ${last.sets.length} sets` : ""
      }`
    : null;

  return (
    <Card className="border-border/70">
      <CardHeader className="gap-2 pb-3">
        {/* Row 1 — title fills the row; action icons sit flush right. The
            previous two-column layout left a tall blank gap on the right
            when there were no PR badges (most days). Going vertical lets
            the title use the full width and pulls the action cluster
            into a single line. */}
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <a
            href={getExerciseTutorialUrl(exercise.name)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group/title inline-flex min-w-0 flex-1 items-start gap-1 break-words text-lg font-semibold leading-tight underline-offset-4 hover:underline focus-visible:underline sm:text-xl"
            aria-label={`Open tutorial for ${exercise.name}`}
            title="Open how-to video"
          >
            <span className="min-w-0 flex-1">{exercise.name}</span>
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 opacity-60 transition-opacity group-hover/title:opacity-100" />
          </a>
          <div className="flex shrink-0 items-center gap-0.5">
            <TrainingGuide
              exercise={exercise}
              variantLabel={variantLabel}
              intent={intent}
            />
            <ExercisePRDetail
              exercise={exercise}
              date={date}
              unit={unit}
              variant={activeVariant}
            />
          </div>
        </CardTitle>

        {/* Row 2 — compact stat strip. Equipment, target, last session
            and PR-ladder trend share a single wrapping row so the empty
            space that used to sit beside the title is now filled with
            information the lifter actually wants mid-set. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              EQUIPMENT_TONE[equipment]
            )}
          >
            {EQUIPMENT_LABEL[equipment]}
          </span>
          {isAssisted && (
            <span
              className="inline-flex items-center rounded-md border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cyan-300"
              title="Assisted movement — lower weight (less machine help) is progress."
            >
              Assisted
            </span>
          )}
          <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/85">
            Target {exercise.sets}×{repsTarget}
          </span>
          {lastSummary && (
            <span className="rounded-md border border-border/40 bg-card/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Last {lastSummary} · {daysAgo(last!.date)}
            </span>
          )}
          <span className="ml-auto flex items-center">
            <PrLadder
              exerciseId={exercise.id}
              beforeDate={date}
              unit={unit}
              variant={activeVariant}
              direction={direction}
            />
          </span>
        </div>

        {/* Row 3 — variant picker stays on its own row so longer labels
            (e.g. "Technogym Pure Strength") don't truncate. */}
        <VariantPicker
          exerciseId={exercise.id}
          activeVariant={activeVariant}
          activeLabel={variantLabel}
          options={variantOptions}
          customLabels={customVariants?.[exercise.id] ?? []}
          onSelect={onVariantChange}
          onAddCustom={(label) => addCustomVariant(exercise.id, label)}
          onRemoveCustom={(label) =>
            removeCustomVariant(exercise.id, label)
          }
        />

        {/* Row 4 — PR badges only render when there's at least one PR
            today, so this row collapses cleanly on a typical session. */}
        {flags.isAnyPR && (
          <div className="flex flex-wrap items-center gap-1">
            <PRBadges flags={flags} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isAssisted && (
          <p className="-mb-1 font-mono text-[10px] leading-snug text-cyan-300/80">
            Lower assistance is progress — log the kg the machine takes off you.
          </p>
        )}
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Set</span>
          <span>{isAssisted ? `Assist (${unit})` : `W (${unit})`}</span>
          <span>Reps</span>
          <span />
        </div>
        {drafts.map((d, idx) => {
          const prev = last?.sets[idx];
          const weightFilled =
            d.weight.trim() !== "" && Number.isFinite(parseFloat(d.weight));
          const repsVal = parseInt(d.reps, 10);
          const repsFilled = d.reps.trim() !== "" && Number.isFinite(repsVal);
          const isPrescribed = idx < exercise.sets;
          // A prescribed set that reached the top of the rep range — the
          // signal the progression engine uses, so the row turns green.
          const hitsTop =
            isPrescribed && repsFilled && repsVal >= exercise.repsHigh;
          const weightTone = hitsTop
            ? "green"
            : weightFilled
            ? "amber"
            : "normal";
          const repsTone = hitsTop ? "green" : repsFilled ? "amber" : "normal";
          return (
            <div
              key={idx}
              className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem] items-center gap-1.5"
            >
              <span className="font-mono text-sm text-muted-foreground">
                {idx + 1}
              </span>
              <div className="relative">
                <Input
                  inputMode="decimal"
                  type="number"
                  step="0.5"
                  placeholder={prev ? String(prev.weight) : "0"}
                  value={d.weight}
                  onChange={(e) =>
                    updateDraft(idx, { weight: e.target.value })
                  }
                  className={cn("pr-7 font-mono text-base", inputTone(weightTone))}
                />
                {usesPlates && parseFloat(d.weight) > 0 && (
                  <span className="absolute inset-y-0 right-1 flex items-center">
                    <PlateCalc weight={parseFloat(d.weight)} unit={unit} />
                  </span>
                )}
              </div>
              <Input
                inputMode="numeric"
                type="number"
                step="1"
                placeholder={prev ? String(prev.reps) : "0"}
                value={d.reps}
                onChange={(e) => updateDraft(idx, { reps: e.target.value })}
                className={cn("font-mono text-base", inputTone(repsTone))}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeSet(idx)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove set"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
        <div className="grid grid-cols-3 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={addSet}
            aria-label="Add an empty set"
          >
            <Plus className="h-4 w-4" />
            Add set
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={duplicateLastSet}
            aria-label="Duplicate the last filled set"
            title="Duplicate last set"
          >
            <Repeat className="h-4 w-4" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={copyFromPreviousSession}
            disabled={!last?.sets || last.sets.length === 0}
            aria-label="Copy sets from last session"
            title={
              last
                ? `Copy ${last.sets.length} sets from ${last.date}`
                : "No previous session"
            }
          >
            <Copy className="h-4 w-4" />
            Last session
          </Button>
        </div>
        <ProgressionHint
          status={advice.status}
          message={
            suggestion ? `${advice.message} ${suggestion.label}` : advice.message
          }
          detail={advice.detail}
          hits={advice.hits}
          needed={advice.needed}
        />
        <RestTimerControls />
        <ExerciseNote
          exerciseId={exercise.id}
          value={displayNote}
          onSave={(next) => setExerciseNote(exercise.id, next)}
        />
      </CardContent>
    </Card>
  );
});

// Per-input colour state for the weight/reps boxes:
//   normal — empty / nothing entered yet
//   amber  — a valid number is entered (visual confirmation it registered)
//   green  — a prescribed set hit the top of the rep range (progression-ready)
// Dark variants are set explicitly so the tint wins over the Input's default
// dark:bg-input/30, and text stays readable on dark backgrounds.
function inputTone(tone: "normal" | "amber" | "green"): string {
  if (tone === "green") {
    return "border-emerald-500/60 bg-emerald-500/10 text-emerald-100 placeholder:text-emerald-200/40 focus-visible:border-emerald-400 dark:bg-emerald-500/15";
  }
  if (tone === "amber") {
    return "border-amber-500/60 bg-amber-500/10 text-amber-100 placeholder:text-amber-200/40 focus-visible:border-amber-400 dark:bg-amber-500/15";
  }
  return "";
}

function PRBadges({ flags }: { flags: PRFlags }) {
  if (!flags.isAnyPR) return null;
  const items: { key: string; label: string; tone: string }[] = [];
  if (flags.weightPR)
    items.push({
      key: "w",
      label: "Weight PR",
      tone: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    });
  if (flags.repPR)
    items.push({
      key: "r",
      label: "Rep PR",
      tone: "border-sky-500/40 bg-sky-500/15 text-sky-300",
    });
  if (flags.e1rmPR)
    items.push({
      key: "e",
      label: "Strength PR",
      tone: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    });
  if (flags.volumePR)
    items.push({
      key: "v",
      label: "Volume PR",
      tone: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    });
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {items.map((i) => (
        <Badge
          key={i.key}
          className={cn(
            "border font-mono text-[10px] uppercase tracking-wider",
            i.tone
          )}
        >
          <Flame className="h-3 w-3" /> {i.label}
        </Badge>
      ))}
    </div>
  );
}

function ProgressionHint({
  status,
  message,
  detail,
  hits,
  needed,
}: {
  status: "ready" | "hold" | "incomplete" | "no-data";
  message: string;
  detail: string;
  hits: number;
  needed: number;
}) {
  if (status === "no-data") return null;
  const Icon =
    status === "ready"
      ? ChevronUp
      : status === "hold"
      ? MinusCircle
      : MinusCircle;
  const tone =
    status === "ready"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : status === "hold"
      ? "border-zinc-600/50 bg-zinc-800/40 text-zinc-200"
      : "border-amber-500/30 bg-amber-500/5 text-amber-200";
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs",
        tone
      )}
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium">{message}</p>
        <p className="font-mono text-[10px] uppercase tracking-wider opacity-80">
          {hits}/{needed} sets at top reps · {detail}
        </p>
      </div>
    </div>
  );
}

function ExerciseNote({
  exerciseId,
  value,
  onSave,
}: {
  exerciseId: string;
  value: string;
  onSave: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
    setEditing(false);
  }, [exerciseId, value]);

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  if (!editing) {
    if (!value) {
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-2 rounded-md border border-dashed border-border/60 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <StickyNote className="h-3.5 w-3.5" />
          Add a note (form cue, weight, etc.)
        </button>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="flex-1 whitespace-pre-wrap text-xs leading-snug text-amber-100/90">
          {value}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit note"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. keep elbows tucked"
        rows={2}
        maxLength={240}
        autoFocus
        className="w-full resize-none rounded-md border border-border/60 bg-card/60 px-2 py-1.5 text-xs leading-snug outline-none focus:border-foreground"
      />
      <div className="flex items-center justify-end gap-1.5">
        <span className="mr-auto font-mono text-[10px] text-muted-foreground">
          {draft.length}/240
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => {
            setDraft(value);
            setEditing(false);
          }}
        >
          <X className="h-3 w-3" /> Cancel
        </Button>
        <Button size="xs" onClick={commit}>
          <Check className="h-3 w-3" /> Save
        </Button>
      </div>
    </div>
  );
}
