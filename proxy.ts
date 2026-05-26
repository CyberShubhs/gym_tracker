import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/auth";

const PUBLIC_PATHS = [
  "/select",
  "/login",
  "/manifest.json",
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.svg",
  "/icon",
  "/apple-icon",
  "/sw.js",
  "/api/notify",
  "/api/apple-health/sync",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (verifySession(cookie)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/select";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|manifest.json).*)"],
};
