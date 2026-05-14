"use client";

import { useRef, useState } from "react";
import { Download, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { logout, saveState } from "@/lib/actions";
import type { AppState } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DataIO() {
  const { state } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gym-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      const merged: AppState = {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        workoutLogs: parsed.workoutLogs ?? {},
        foodLogs: parsed.foodLogs ?? {},
        weightLogs: parsed.weightLogs ?? {},
      };
      setPendingImport(merged);
    } catch {
      setError("Invalid JSON file.");
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    await saveState(pendingImport);
    setPendingImport(null);
    window.location.reload();
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/select");
    router.refresh();
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Import
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="font-mono text-xs text-rose-400">{error}</p>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="w-full text-muted-foreground"
      >
        <Users className="h-4 w-4" />
        Switch user
      </Button>

      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(o) => !o && setPendingImport(null)}
      >
        <AlertDialogTrigger render={<span className="hidden" />} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription>
              Imports{" "}
              {pendingImport
                ? Object.keys(pendingImport.workoutLogs).length
                : 0}{" "}
              workouts,{" "}
              {pendingImport
                ? Object.keys(pendingImport.foodLogs).length
                : 0}{" "}
              food entries, and{" "}
              {pendingImport
                ? Object.keys(pendingImport.weightLogs).length
                : 0}{" "}
              weight entries. Existing data will be overwritten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
