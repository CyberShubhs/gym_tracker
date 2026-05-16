"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TemplateExercise, Unit } from "@/lib/types";
import { ExerciseCard } from "@/components/exercise-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  exercises: TemplateExercise[];
  date: string;
  unit: Unit;
};

// Movement thresholds — tuned for a "feels native" swipe.
const AXIS_LOCK_THRESHOLD = 10; // px before deciding horizontal vs vertical
const SWIPE_DISTANCE = 40; // px to register a swipe by distance
const VELOCITY_THRESHOLD = 0.35; // px/ms

function vibrate(ms: number) {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    // ignore
  }
}

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    "input, textarea, select, button, a, [role='button'], [data-no-swipe]"
  );
}

export function ExerciseCarousel({ exercises, date, unit }: Props) {
  const count = exercises.length;
  const [rawIndex, setIndex] = useState(0);
  const index = count > 0 ? ((rawIndex % count) + count) % count : 0;

  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerState = useRef<{
    id: number;
    startX: number;
    startY: number;
    startT: number;
    startedOnInteractive: boolean;
    locked: "h" | "v" | null;
    captured: boolean;
  } | null>(null);

  const wrap = useCallback(
    (n: number) => ((n % count) + count) % count,
    [count]
  );

  const goNext = useCallback(() => {
    setIndex((i) => wrap(i + 1));
    setDragX(0);
    vibrate(15);
  }, [wrap]);
  const goPrev = useCallback(() => {
    setIndex((i) => wrap(i - 1));
    setDragX(0);
    vibrate(15);
  }, [wrap]);
  const goTo = useCallback(
    (n: number) => {
      setIndex(wrap(n));
      setDragX(0);
    },
    [wrap]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Track every pointer-down — but remember whether it started on an
    // interactive element. We do NOT bail out early: we still want to
    // recognise a horizontal swipe that happens to begin on the card body.
    pointerState.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startT: e.timeStamp,
      startedOnInteractive: isInteractive(e.target),
      locked: null,
      captured: false,
    };
    setDragging(false); // not yet — only after axis lock to horizontal
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = pointerState.current;
    if (!ps || ps.id !== e.pointerId) return;
    const dx = e.clientX - ps.startX;
    const dy = e.clientY - ps.startY;
    if (ps.locked == null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < AXIS_LOCK_THRESHOLD && absY < AXIS_LOCK_THRESHOLD) return;
      // Clear horizontal intent — but only if started outside an interactive
      // control. Otherwise we keep the native input/button behaviour.
      if (absX > absY * 1.2 && !ps.startedOnInteractive) {
        ps.locked = "h";
        setDragging(true);
        try {
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          ps.captured = true;
        } catch {
          // ignore
        }
      } else {
        // Vertical scroll or tap on an input — leave alone.
        pointerState.current = null;
        setDragging(false);
        setDragX(0);
        return;
      }
    }
    if (ps.locked === "h") {
      // Now we own the gesture — block scroll & default behaviour.
      e.preventDefault();
      setDragX(dx);
    }
  };

  const releaseCapture = (
    e: React.PointerEvent<HTMLDivElement>,
    ps: NonNullable<typeof pointerState.current>
  ) => {
    if (ps.captured) {
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(
          e.pointerId
        );
      } catch {
        // ignore
      }
    }
  };

  const finishDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    clientX: number,
    t: number
  ) => {
    const ps = pointerState.current;
    pointerState.current = null;
    setDragging(false);
    if (!ps) {
      setDragX(0);
      return;
    }
    releaseCapture(e, ps);
    if (ps.locked !== "h") {
      setDragX(0);
      return;
    }
    const dx = clientX - ps.startX;
    const dt = Math.max(1, t - ps.startT);
    const velocity = dx / dt;
    const passed =
      Math.abs(dx) > SWIPE_DISTANCE ||
      Math.abs(velocity) > VELOCITY_THRESHOLD;
    if (passed) {
      if (dx < 0) goNext();
      else goPrev();
    } else {
      setDragX(0);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = pointerState.current;
    if (!ps || ps.id !== e.pointerId) {
      pointerState.current = null;
      setDragging(false);
      setDragX(0);
      return;
    }
    finishDrag(e, e.clientX, e.timeStamp);
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = pointerState.current;
    if (ps) releaseCapture(e, ps);
    pointerState.current = null;
    setDragging(false);
    setDragX(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const a = document.activeElement;
      if (
        a &&
        (a.tagName === "INPUT" ||
          a.tagName === "TEXTAREA" ||
          (a as HTMLElement).isContentEditable)
      ) {
        return;
      }
      if (ev.key === "ArrowRight") {
        ev.preventDefault();
        goNext();
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const current = exercises[index];
  const prevIdx = wrap(index - 1);
  const nextIdx = wrap(index + 1);
  const prevExercise = exercises[prevIdx];
  const nextExercise = exercises[nextIdx];

  const [trackWidth, setTrackWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setTrackWidth(el.clientWidth);
    });
    ro.observe(el);
    setTrackWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="space-y-3">
      {/* Top progress: counter + dots */}
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Exercise{" "}
          <span className="text-foreground">
            {count > 0 ? index + 1 : 0}
          </span>{" "}
          of <span className="text-foreground">{count}</span>
        </p>
        <CarouselDots count={count} active={index} onPick={goTo} />
      </div>

      {/* Swipe track */}
      <div
        ref={containerRef}
        className="relative overflow-hidden select-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className={cn(
            "flex w-full will-change-transform",
            dragging
              ? "transition-none"
              : "transition-transform duration-300 ease-out"
          )}
          style={{
            transform: `translate3d(${-trackWidth + dragX}px, 0, 0)`,
            width: trackWidth ? trackWidth * 3 : undefined,
          }}
        >
          <Slide width={trackWidth} aria-hidden="true">
            {prevExercise && (
              <ExerciseCard
                key={`prev-${prevExercise.id}`}
                exercise={prevExercise}
                date={date}
                unit={unit}
              />
            )}
          </Slide>
          <Slide width={trackWidth}>
            {current && (
              <ExerciseCard
                key={`cur-${current.id}`}
                exercise={current}
                date={date}
                unit={unit}
              />
            )}
          </Slide>
          <Slide width={trackWidth} aria-hidden="true">
            {nextExercise && (
              <ExerciseCard
                key={`next-${nextExercise.id}`}
                exercise={nextExercise}
                date={date}
                unit={unit}
              />
            )}
          </Slide>
        </div>
      </div>

      {/* Prev / Next */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="lg"
          onClick={goPrev}
          aria-label="Previous exercise"
          className="h-12 justify-start gap-2 px-3"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Previous
            </span>
            <span className="truncate text-sm font-medium">
              {prevExercise?.name ?? "—"}
            </span>
          </span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={goNext}
          aria-label="Next exercise"
          className="h-12 justify-end gap-2 px-3"
        >
          <span className="flex min-w-0 flex-col text-right leading-tight">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Next
            </span>
            <span className="truncate text-sm font-medium">
              {nextExercise?.name ?? "—"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Button>
      </div>
    </div>
  );
}

function Slide({
  children,
  width,
  ...rest
}: {
  children: React.ReactNode;
  width: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className="shrink-0 px-0.5"
      style={{ width: width || "100%" }}
      {...rest}
    >
      {children}
    </div>
  );
}

function CarouselDots({
  count,
  active,
  onPick,
}: {
  count: number;
  active: number;
  onPick: (i: number) => void;
}) {
  const MAX = 9;
  const indexes = useMemo(() => {
    if (count <= MAX) return Array.from({ length: count }, (_, i) => i);
    const half = Math.floor(MAX / 2);
    let start = Math.max(0, active - half);
    let end = start + MAX;
    if (end > count) {
      end = count;
      start = end - MAX;
    }
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [count, active]);
  if (count <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      {indexes.map((i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Go to exercise ${i + 1}`}
            onClick={() => onPick(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              isActive
                ? "w-5 bg-foreground"
                : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70"
            )}
          />
        );
      })}
    </div>
  );
}
