"use client";

// Read the active profile id from the non-httpOnly `gt-uid` cookie. The
// signed session cookie itself is httpOnly so the client can't read it —
// `gt-uid` is the public companion the server sets alongside it. Used to
// namespace any browser-local state (carousel position, leg picker, …) so
// switching profiles never leaks data between accounts.

const ACTIVE_UID_COOKIE = "gt-uid";

export function getActiveUid(): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie;
  if (!raw) return null;
  for (const part of raw.split(/;\s*/)) {
    if (part.startsWith(`${ACTIVE_UID_COOKIE}=`)) {
      const value = part.slice(ACTIVE_UID_COOKIE.length + 1);
      try {
        return decodeURIComponent(value) || null;
      } catch {
        return value || null;
      }
    }
  }
  return null;
}

// Stable storage key suffix per profile. "anon" is used when there is no
// active profile so we never accidentally write to the empty-suffix key
// (which would otherwise be globally shared).
export function uidStorageSuffix(): string {
  return getActiveUid() ?? "anon";
}
