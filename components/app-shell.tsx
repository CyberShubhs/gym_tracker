"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Dumbbell,
  Home,
  Settings,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  { href: "/food", label: "Food", icon: UtensilsCrossed },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login" || pathname.startsWith("/select");

  // The shell is a fixed-height, non-scrolling column: <main> is the only
  // scroller and the tab bar is the last in-flow row. This is deliberate —
  // a `position: fixed` bottom bar detaches and floats up into the content
  // during iOS momentum scrolling, so instead the bar is pinned simply by
  // being the bottom of a 100dvh column that itself never scrolls. It is a
  // static pill of four icons: the active tab is highlighted and tapping a
  // tab navigates. Nothing about it moves, shrinks, or expands.

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg ?? navigator.serviceWorker.register("/sw.js"))
      .catch(() => undefined);
  }, []);

  if (hideNav) {
    return <>{children}</>;
  }

  const activeHref = (
    NAV.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) ?? NAV[0]
  ).href;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden">
      <main
        className="flex-1 overflow-y-auto px-4 sm:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
          paddingBottom: "1.5rem",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="pointer-events-none flex shrink-0 justify-center px-4 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-[26px] border border-border/60 bg-background/70 p-1.5 shadow-[0_12px_44px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          {NAV.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className="flex w-12 flex-col items-center justify-center"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon
                    className="h-[21px] w-[21px]"
                    strokeWidth={active ? 2.4 : 2}
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
