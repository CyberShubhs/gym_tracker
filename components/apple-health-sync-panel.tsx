"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useStore } from "@/lib/store";
import { getCurrentUser, type UserCard } from "@/lib/actions";

const ENDPOINT_URL =
  "https://gym-tracker-zeta-sable.vercel.app/api/apple-health/sync";

const EXAMPLE_PAYLOAD = `{
  "profileName": "Shubham",
  "date": "2026-05-26",
  "source": "apple_shortcuts",
  "steps": 9350,
  "activeEnergyKcal": 548
}`;

function lastSyncedSummary(
  daily: Record<string, { syncedAt?: string }> | undefined
): { date: string; syncedAt: string } | null {
  if (!daily) return null;
  let best: { date: string; syncedAt: string } | null = null;
  for (const [date, entry] of Object.entries(daily)) {
    if (!entry?.syncedAt) continue;
    if (!best || entry.syncedAt > best.syncedAt) {
      best = { date, syncedAt: entry.syncedAt };
    }
  }
  return best;
}

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AppleHealthSyncPanel() {
  const { state } = useStore();
  const [profile, setProfile] = useState<UserCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser()
      .then((u) => {
        if (!cancelled) setProfile(u);
      })
      .catch(() => {
        // Profile is informational only; failing to load it shouldn't
        // break the panel.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const lastSynced = lastSyncedSummary(state.appleHealthDaily);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sends daily step count and active energy from your iPhone to this
        gym tracker via a Shortcut. The Shortcut never sees other profiles,
        and only the matched profile&apos;s row is updated.
      </p>

      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Endpoint
        </p>
        <code className="block break-all rounded-md border border-border/60 bg-card/60 px-2 py-1.5 font-mono text-[11px]">
          {ENDPOINT_URL}
        </code>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Headers
        </p>
        <code className="block break-all rounded-md border border-border/60 bg-card/60 px-2 py-1.5 font-mono text-[11px]">
          Authorization: Bearer YOUR_SECRET_TOKEN
        </code>
        <code className="block break-all rounded-md border border-border/60 bg-card/60 px-2 py-1.5 font-mono text-[11px]">
          Content-Type: application/json
        </code>
      </div>

      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Example body
        </p>
        <pre className="overflow-x-auto rounded-md border border-border/60 bg-card/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
          {EXAMPLE_PAYLOAD}
        </pre>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Active profile
          </p>
          {profile ? (
            <p className="font-mono text-sm">
              {profile.name}
              <span className="ml-1 text-[10px] text-muted-foreground">
                ({profile.id})
              </span>
            </p>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">—</p>
          )}
        </div>
        <div className="rounded-md border border-border/60 bg-card/60 px-3 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Last synced
          </p>
          {lastSynced ? (
            <p className="font-mono text-sm">
              {formatSyncedAt(lastSynced.syncedAt)}
              <span className="ml-1 text-[10px] text-muted-foreground">
                for {lastSynced.date}
              </span>
            </p>
          ) : (
            <p className="font-mono text-[11px] text-muted-foreground">
              Never
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200">
          <Smartphone className="h-3 w-3" />
          iPhone Shortcut setup
        </p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-amber-100/90">
          <li>Method: POST</li>
          <li>Request body: Dictionary / JSON</li>
          <li>
            Headers:{" "}
            <code className="font-mono">Authorization: Bearer YOUR_SECRET_TOKEN</code>{" "}
            and <code className="font-mono">Content-Type: application/json</code>
          </li>
          <li>URL: the endpoint shown above</li>
        </ul>
      </div>

      <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-100/90">
        <p>
          The real token is never displayed in this app. Store it only in
          Vercel env vars (<code className="font-mono">APPLE_HEALTH_SYNC_TOKEN</code>) and in
          the iPhone Shortcut. If the token leaked, rotate it in both places —
          do not paste it into GitHub, source files, screenshots, or chat logs.
        </p>
      </div>
    </div>
  );
}
