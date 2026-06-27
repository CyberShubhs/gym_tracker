"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pause, Play, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RestTimerContextValue = {
  active: boolean;
  remaining: number;
  totalSeconds: number;
  start: (seconds: number) => void;
  stop: () => void;
};

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

const PRESETS = [
  { label: "60s", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

const FINISH_NOTIF_TAG = "rest-timer-done";

function fireVibration(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  try {
    // Some browsers gate vibrate behind a recent user gesture — calling from
    // a click handler chain (start) makes this work where calling later won't.
    (navigator as Navigator).vibrate?.(pattern);
  } catch {
    // ignore
  }
}

function isPageVisible(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

async function showFinishNotification(totalSeconds: number) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  // Only fire a system notification when the app is backgrounded — in-app the
  // sound + vibration alert is enough and a notification would be noise.
  if (isPageVisible()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  await reg.showNotification("Rest done", {
    tag: FINISH_NOTIF_TAG,
    renotify: false,
    silent: false,
    requireInteraction: false,
    body: `${totalSeconds}s rest complete — back to it.`,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: "/" },
  } as NotificationOptions);
}

async function clearFinishNotification() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return;
  const notes = await reg.getNotifications({ tag: FINISH_NOTIF_TAG });
  for (const n of notes) n.close();
}

export function RestTimerProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // alertedRef guarantees only one finish alert (sound + vibration + notification)
  // per timer run, even if React re-renders or effects re-fire.
  const alertedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoHideRef.current) {
      clearTimeout(autoHideRef.current);
      autoHideRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    alertedRef.current = false;
    setActive(false);
    setRemaining(0);
    void clearFinishNotification();
  }, [clearTimers]);

  const fireAlert = useCallback(() => {
    if (alertedRef.current) return;
    alertedRef.current = true;
    fireVibration([200, 100, 200, 100, 400]);
    try {
      audioCtxRef.current ??= new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + 0.6
      );
      osc.start();
      osc.stop(ctx.currentTime + 0.65);
    } catch {
      // no audio context — ignore
    }
  }, []);

  const start = useCallback(
    (seconds: number) => {
      clearTimers();
      void clearFinishNotification();
      alertedRef.current = false;
      // Quick "started" haptic so iOS/Android confirms input is working.
      fireVibration(40);
      // Best-effort: ask permission so the single finish notification can render
      // if the user backgrounds the app.
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "default"
      ) {
        void Notification.requestPermission();
      }
      const target = Date.now() + seconds * 1000;
      setActive(true);
      setRemaining(seconds);
      setTotalSeconds(seconds);
      intervalRef.current = setInterval(() => {
        const left = Math.max(0, Math.round((target - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          fireAlert();
          void showFinishNotification(seconds);
          autoHideRef.current = setTimeout(() => {
            setActive(false);
            void clearFinishNotification();
            autoHideRef.current = null;
          }, 4000);
        }
      }, 250);
    },
    [clearTimers, fireAlert]
  );

  useEffect(() => {
    return () => {
      clearTimers();
      void clearFinishNotification();
    };
  }, [clearTimers]);

  const value = useMemo<RestTimerContextValue>(
    () => ({ active, remaining, totalSeconds, start, stop }),
    [active, remaining, totalSeconds, start, stop]
  );

  return (
    <RestTimerContext.Provider value={value}>
      {children}
      <RestTimerBar />
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx)
    throw new Error("useRestTimer must be used inside RestTimerProvider");
  return ctx;
}

function RestTimerBar() {
  const { active, remaining, totalSeconds, stop } = useRestTimer();
  if (!active) return null;
  const mm = String(Math.floor(remaining / 60)).padStart(1, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const pct =
    totalSeconds > 0
      ? Math.max(0, ((totalSeconds - remaining) / totalSeconds) * 100)
      : 0;
  const done = remaining === 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 mx-auto max-w-2xl px-4"
      style={{
        bottom: "calc(96px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="pointer-events-auto rounded-xl border border-border/60 bg-card/95 backdrop-blur shadow-lg">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Timer className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-semibold tabular-nums text-primary">
            {done ? "Done!" : `${mm}:${ss}`}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={stop}
            aria-label="Cancel timer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RestTimerControls({ className }: { className?: string }) {
  const { start, active } = useRestTimer();
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {active ? (
          <>
            <Pause className="h-3 w-3" /> Run
          </>
        ) : (
          <>
            <Play className="h-3 w-3" /> Rest
          </>
        )}
      </span>
      <div className="flex flex-1 gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.seconds}
            size="xs"
            variant="outline"
            onClick={() => start(p.seconds)}
            className="flex-1"
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
