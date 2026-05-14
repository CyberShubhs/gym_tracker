import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { ensureSchema } from "@/lib/migrate";
import { pickMessage } from "@/lib/messages";
import {
  pushStatusCode,
  sendPush,
  type StoredSubscription,
} from "@/lib/push-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYDNEY_TZ = "Australia/Sydney";
const ALLOWED_HOURS = [9, 17] as const;

function sydneyHour(date = new Date()): number {
  // Intl.DateTimeFormat returns the Sydney-local hour, accounting for AEST/AEDT.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SYDNEY_TZ,
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const h = parts.find((p) => p.type === "hour")?.value ?? "0";
  return Number(h) % 24;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Cron fires at 4 UTC times to cover both AEST (UTC+10) and AEDT (UTC+11).
  // Skip the runs where Sydney's wall clock isn't 09:00 or 17:00 — leaves
  // exactly two real fires per day. `?force=1` bypasses for manual testing.
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  if (!force) {
    const h = sydneyHour();
    if (!ALLOWED_HOURS.includes(h as (typeof ALLOWED_HOURS)[number])) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        sydneyHour: h,
      });
    }
  }

  await ensureSchema();
  const sql = getSql();
  const subs = (await sql`
    SELECT id, user_id, endpoint, subscription FROM push_subscriptions
  `) as Array<{
    id: number;
    user_id: string;
    endpoint: string;
    subscription: StoredSubscription;
  }>;

  let sent = 0;
  let removed = 0;
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      const body = pickMessage();
      try {
        await sendPush(s.subscription, body);
        sent += 1;
      } catch (err: unknown) {
        const code = pushStatusCode(err);
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${s.user_id}:${code ?? "?"}:${msg.slice(0, 80)}`);
        if (code === 404 || code === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
          removed += 1;
        }
      }
    })
  );

  return NextResponse.json({
    ok: true,
    sent,
    removed,
    total: subs.length,
    errors: errors.slice(0, 5),
  });
}

export async function POST(req: Request) {
  return GET(req);
}
