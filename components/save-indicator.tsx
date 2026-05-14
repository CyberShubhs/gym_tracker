"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SaveIndicator() {
  const { saveStatus } = useStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (saveStatus === "idle") return;
    setShow(true);
    if (saveStatus === "saved") {
      const t = setTimeout(() => setShow(false), 1500);
      return () => clearTimeout(t);
    }
  }, [saveStatus]);

  if (!show) return null;

  if (saveStatus === "error") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-rose-400">
        <CloudOff className="h-3 w-3" />
        Offline
      </span>
    );
  }

  if (saveStatus === "saving") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400",
        "transition-opacity"
      )}
    >
      <Check className="h-3 w-3" />
      Saved
    </span>
  );
}
