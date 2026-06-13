"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { logout, saveState } from "@/lib/actions";
import { buildCsv } from "@/lib/export-csv";
import type { AppState } from "@/lib/types";
import {
  DEFAULT_SCHEDULE,
  DEFAULT_SETTINGS,
  DEFAULT_TEMPLATES,
  TEMPLATES_VERSION,
  needsTemplateMigration,
} from "@/lib/defaults";
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

function downloadBlob(contents: string, type: string, filename: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Filesystem-safe local timestamp: 2026-06-13T14-30 (colons break filenames).
function fileStamp(withTime: boolean): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return withTime ? `${day}T${p(d.getHours())}-${p(d.getMinutes())}` : day;
}

export function DataIO() {
  const { state, hydrated } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImport, setPendingImport] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = {
    workouts: Object.keys(state.workoutLogs).length,
    foods: Object.keys(state.foodLogs).length,
    weights: Object.keys(state.weightLogs).length,
  };
  const isEmpty =
    counts.workouts === 0 && counts.foods === 0 && counts.weights === 0;

  const handleExport = () => {
    // Guard: never let a tap before the server load finishes pass off an
    // empty default state as a real backup.
    if (!hydrated) return;
    if (
      isEmpty &&
      !window.confirm(
        "Your data looks empty. Export anyway? (If you just opened the app, wait a moment for it to load.)"
      )
    ) {
      return;
    }
    // Additive provenance — import only reads the known top-level keys, so
    // this block round-trips harmlessly and never pollutes state.
    const payload = {
      ...state,
      _export: {
        app: "gym-tracker",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        counts,
      },
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      "application/json",
      `gym-tracker-${fileStamp(true)}.json`
    );
  };

  const handleExportCsv = () => {
    if (!hydrated) return;
    if (isEmpty && !window.confirm("Your data looks empty. Export anyway?")) {
      return;
    }
    downloadBlob(
      buildCsv(state, state.settings.unit),
      "text/csv;charset=utf-8",
      `gym-tracker-${fileStamp(false)}.csv`
    );
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppState>;
      const importedSettings = parsed.settings ?? {};
      // Drop stale templates/schedule from old JSON exports — workout, food
      // and weight logs are kept exactly as exported.
      const settings = { ...DEFAULT_SETTINGS, ...importedSettings };
      if (
        needsTemplateMigration(
          settings.templates,
          settings.schedule,
          settings.templatesVersion
        )
      ) {
        settings.templates = DEFAULT_TEMPLATES;
        settings.schedule = DEFAULT_SCHEDULE;
        settings.cycle = undefined;
        settings.cycleAnchor = undefined;
        settings.templatesVersion = TEMPLATES_VERSION;
      }
      const merged: AppState = {
        settings,
        workoutLogs: parsed.workoutLogs ?? {},
        foodLogs: parsed.foodLogs ?? {},
        weightLogs: parsed.weightLogs ?? {},
        appleHealthDaily: parsed.appleHealthDaily ?? {},
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
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={!hydrated}
          title={
            hydrated ? "Download a full JSON backup" : "Loading your data…"
          }
        >
          <Download className="h-4 w-4" /> Export
        </Button>
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button
          variant="outline"
          onClick={handleExportCsv}
          disabled={!hydrated}
          title="Download a spreadsheet (CSV) of workouts + food"
          className="col-span-2"
        >
          <FileSpreadsheet className="h-4 w-4" /> Export CSV (spreadsheet)
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
