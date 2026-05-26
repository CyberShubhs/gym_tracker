import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  AppleHealthSyncError,
  syncAppleHealthDaily,
  type AppleHealthSyncPayload,
} from "@/lib/apple-health-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

// Constant-time string compare. Falls back to false when either side is
// empty or the byte lengths differ, before timingSafeEqual would throw.
function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401 }
  );
}

export async function POST(req: Request) {
  const expected = process.env.APPLE_HEALTH_SYNC_TOKEN;
  if (!expected || expected.trim().length === 0) {
    // Misconfigured — the server has no token, so no caller can ever
    // succeed. Surface a generic non-leaky error.
    return NextResponse.json(
      { ok: false, error: "sync_not_configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return unauthorized();
  }
  const presented = authHeader.slice("Bearer ".length).trim();
  if (!safeEqual(presented, expected.trim())) {
    return unauthorized();
  }

  // Parse JSON safely — never echo the body back in error messages.
  let body: AppleHealthSyncPayload;
  try {
    const raw = (await req.json()) as unknown;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { ok: false, error: "invalid_payload" },
        { status: 400 }
      );
    }
    body = raw as AppleHealthSyncPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 }
    );
  }

  try {
    const result = await syncAppleHealthDaily(body);
    return NextResponse.json({
      ok: true,
      profileId: result.profileId,
      profileName: result.profileName,
      date: result.date,
      stored: result.stored,
    });
  } catch (err) {
    if (err instanceof AppleHealthSyncError) {
      if (err.code === "invalid_payload") {
        return NextResponse.json(
          { ok: false, error: err.code, detail: err.message },
          { status: 400 }
        );
      }
      if (err.code === "profile_not_found") {
        return NextResponse.json(
          { ok: false, error: err.code },
          { status: 404 }
        );
      }
      if (err.code === "profile_ambiguous") {
        return NextResponse.json(
          {
            ok: false,
            error: err.code,
            detail: "Use profileId instead of profileName",
          },
          { status: 409 }
        );
      }
    }
    // Do not leak internal error messages to the caller.
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check only — never accepts sync data. Token is not validated
  // here because no secret is read or returned; this just signals that the
  // route is mounted.
  return NextResponse.json(
    { ok: true, route: "apple-health/sync", method: "POST" },
    { status: 200 }
  );
}
