"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Archive,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Lock,
  LockOpen,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  backupStatus,
  deleteBackup,
  downloadLatestBackup,
  listBackups,
  restoreBackup,
  setBackupProtected,
  triggerManualBackup,
  type BackupStatus,
  type BackupSummary,
} from "@/lib/actions";
import { cn, formatDate } from "@/lib/utils";

const KIND_LABEL: Record<BackupSummary["kind"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  manual: "Manual",
  "pre-restore": "Pre-restore",
};

const KIND_TONE: Record<BackupSummary["kind"], string> = {
  daily: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  weekly: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  manual: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  "pre-restore":
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export function BackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [list, setList] = useState<BackupSummary[]>([]);
  const [pendingAction, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupSummary | null>(
    null
  );

  const refresh = useCallback(() => {
    void Promise.all([backupStatus(), listBackups()]).then(([s, l]) => {
      setStatus(s);
      setList(l);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runManual = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await triggerManualBackup();
      if (r.ok) {
        setMessage("Backup created.");
        refresh();
      } else {
        setError(r.error ?? "Manual backup failed.");
      }
    });
  };

  const runDownload = () => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await downloadLatestBackup();
      if (!r.ok || !r.payload || !r.filename) {
        setError(r.error ?? "Download failed.");
        return;
      }
      const blob = new Blob([r.payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Latest backup downloaded.");
    });
  };

  const confirmRestore = () => {
    if (!restoreTarget) return;
    const target = restoreTarget;
    setRestoreTarget(null);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const r = await restoreBackup(target.id);
      if (r.ok) {
        setMessage("Restore complete — reloading…");
        // Full reload so the StoreProvider re-hydrates from the
        // restored row instead of pushing stale client state back over
        // the freshly-restored server state.
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } else {
        setError(r.error ?? "Restore failed.");
      }
    });
  };

  const toggleProtected = (b: BackupSummary) => {
    startTransition(async () => {
      await setBackupProtected(b.id, !b.protected);
      refresh();
    });
  };

  const removeBackup = (b: BackupSummary) => {
    startTransition(async () => {
      const r = await deleteBackup(b.id);
      if (r.ok) refresh();
      else setError(r.error ?? "Could not delete backup.");
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Automatic backups
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Every save snapshots your profile into the daily + weekly buckets
          on the server. The last 30 daily and 12 weekly snapshots are kept
          per profile, plus any manual snapshots you create. Backups never
          cross between profiles.
        </p>
        {status && (
          <dl className="mt-2 grid grid-cols-2 gap-y-1 gap-x-4 text-[11px]">
            <dt className="text-muted-foreground">Last saved</dt>
            <dd className="text-right font-mono">
              {status.lastSavedAt ? relative(status.lastSavedAt) : "—"}
            </dd>
            <dt className="text-muted-foreground">Last daily</dt>
            <dd className="text-right font-mono">
              {status.lastDaily
                ? `${status.lastDaily.periodKey} · ${relative(
                    status.lastDaily.createdAt
                  )}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Last weekly</dt>
            <dd className="text-right font-mono">
              {status.lastWeekly
                ? `${status.lastWeekly.periodKey} · ${relative(
                    status.lastWeekly.createdAt
                  )}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Total snapshots</dt>
            <dd className="text-right font-mono">{status.totalBackups}</dd>
          </dl>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={runManual}
          disabled={pendingAction}
        >
          {pendingAction ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          Snapshot now
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={runDownload}
          disabled={pendingAction}
        >
          <Download className="h-4 w-4" />
          Download latest
        </Button>
      </div>

      {message && (
        <p className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-300">
          <CheckCircle2 className="h-3 w-3" />
          {message}
        </p>
      )}
      {error && (
        <p className="font-mono text-[10px] text-rose-400">{error}</p>
      )}

      <div className="space-y-1.5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Recent snapshots
        </p>
        {list.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-card/40 px-3 py-3 text-xs text-muted-foreground">
            No snapshots yet — they will start appearing after your next
            save.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {list.slice(0, 20).map((b) => (
              <li
                key={b.id}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-card/40 px-2.5 py-2 text-xs"
              >
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                    KIND_TONE[b.kind]
                  )}
                >
                  {KIND_LABEL[b.kind]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {b.periodKey}
                  </span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    <Clock className="mr-0.5 inline h-2.5 w-2.5" />
                    {formatDate(b.createdAt.slice(0, 10))}
                    {" · "}
                    {b.workoutDays} workout · {b.foodDays} food ·{" "}
                    {b.weightDays} weight · {Math.round(b.bytes / 1024)} KB
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => toggleProtected(b)}
                    disabled={pendingAction}
                    aria-label={
                      b.protected ? "Unprotect backup" : "Protect backup"
                    }
                    title={
                      b.protected
                        ? "Protected from auto-deletion"
                        : "Pin this backup so it isn't auto-deleted"
                    }
                  >
                    {b.protected ? (
                      <Lock className="h-3.5 w-3.5 text-amber-400" />
                    ) : (
                      <LockOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setRestoreTarget(b)}
                    disabled={pendingAction}
                    aria-label="Restore this backup"
                    title="Restore this backup"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeBackup(b)}
                    disabled={pendingAction || b.protected}
                    aria-label="Delete backup"
                    className="text-muted-foreground hover:text-destructive"
                    title={
                      b.protected
                        ? "Unprotect before deleting"
                        : "Delete this backup"
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
      >
        <AlertDialogTrigger render={<span className="hidden" />} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreTarget ? (
                <>
                  Replaces this profile&apos;s current data with{" "}
                  <strong>
                    {KIND_LABEL[restoreTarget.kind]} · {restoreTarget.periodKey}
                  </strong>{" "}
                  ({restoreTarget.workoutDays} workout days,{" "}
                  {restoreTarget.foodDays} food days,{" "}
                  {restoreTarget.weightDays} weight days). Your current
                  state is auto-snapshotted as a <em>pre-restore</em>
                  &nbsp;backup first so you can roll back. Only this profile
                  is affected.
                </>
              ) : (
                "Replaces this profile's current data with the selected backup."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
