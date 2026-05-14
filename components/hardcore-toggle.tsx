"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Flame, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPushStatus,
  subscribePush,
  unsubscribePush,
  type PushStatus,
} from "@/lib/push-client";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/lib/actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function HardcoreToggle() {
  const [status, setStatus] = useState<PushStatus | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus);
  }, []);

  const enable = async () => {
    if (!PUBLIC_KEY) {
      setError("Push not configured");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const sub = await subscribePush(PUBLIC_KEY);
      if (!sub) {
        setError("Permission denied");
        setStatus("denied");
        return;
      }
      const result = await savePushSubscription(JSON.stringify(sub));
      if (!result.ok) {
        setError("Save failed");
        return;
      }
      setStatus("subscribed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError(null);
    setBusy(true);
    try {
      const endpoint = await unsubscribePush();
      if (endpoint) await removePushSubscription(endpoint);
      setStatus("default");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking…
      </p>
    );
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t supported in this browser.
      </p>
    );
  }

  if (status === "not-pwa") {
    return (
      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <p className="font-medium text-amber-300">
          Add to Home Screen first.
        </p>
        <p className="text-xs text-muted-foreground">
          On iOS push notifications only work after you save this site as an
          app from Safari. Tap the share icon → &quot;Add to Home Screen&quot;,
          then open it from there and try again.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="space-y-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
        <p className="font-medium text-rose-300">Notifications blocked.</p>
        <p className="text-xs text-muted-foreground">
          Enable them in your phone&apos;s Settings → Notifications →
          Gym Tracker, then come back.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Flame className="h-4 w-4 text-orange-400" />
            Hardcore notifications
          </p>
          <p className="text-xs text-muted-foreground">
            Twice-daily reminders. No motivation, just truth.
          </p>
        </div>
        {status === "subscribed" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={disable}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            Off
          </Button>
        ) : (
          <Button size="sm" onClick={enable} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Turn on
          </Button>
        )}
      </div>
      {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
      {status === "subscribed" && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
            ● Active — daily push at 8 PM IST.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              setError(null);
              setBusy(true);
              try {
                const r = await sendTestPush();
                if (!r.ok) setError(r.error ?? "Test failed");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Test failed");
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
            Send test now
          </Button>
        </div>
      )}
    </div>
  );
}
