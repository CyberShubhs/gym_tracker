"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

  // Floating tab bar, iOS-26 style. At rest it's a compact pill showing only
  // the current tab's icon. Tap it to reveal all four tabs; pick one and it
  // collapses again. It NEVER auto-expands — scrolling or moving between pages
  // always leaves it in the compact pill, so it stays out of the way while you
  // log food or sets. Purely a presentation toggle; navigation is unchanged.
  const [expanded, setExpanded] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg ?? navigator.serviceWorker.register("/sw.js"))
      .catch(() => undefined);
  }, []);

  // Switching tabs collapses the bar — each page starts as the compact pill.
  useEffect(() => {
    setExpanded(false);
    lastY.current = typeof window !== "undefined" ? window.scrollY : 0;
  }, [pathname]);

  // Any scroll collapses it back to the compact pill. It only ever grows again
  // when the user taps it — there is deliberately no scroll-up / at-top expand.
  useEffect(() => {
    if (hideNav) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - lastY.current) > 4) setExpanded(false);
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hideNav]);

  if (hideNav) {
    return <>{children}</>;
  }

  const activeHref = (
    NAV.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) ?? NAV[0]
  ).href;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <main
        className="flex-1 px-4 sm:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 1.25rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 7rem)",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
      >
        <div
          onClick={() => {
            if (!expanded) setExpanded(true);
          }}
          className={cn(
            "pointer-events-auto flex items-center rounded-[26px] border border-border/60 bg-background/70 shadow-[0_12px_44px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-300 ease-out",
            expanded ? "gap-1.5 p-2" : "gap-0 p-1.5"
          )}
        >
          {NAV.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            // Collapsed: only the active tab is visible; the rest shrink away to
            // zero width. Tapping the visible icon expands the bar instead of
            // navigating (it's already the current page).
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                tabIndex={!expanded && !active ? -1 : 0}
                onClick={(e) => {
                  if (!expanded) {
                    e.preventDefault();
                    setExpanded(true);
                  } else {
                    setExpanded(false);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center overflow-hidden rounded-2xl transition-all duration-300 ease-out",
                  expanded
                    ? "h-14 w-16 gap-1 opacity-100"
                    : active
                      ? "h-12 w-12 gap-0 opacity-100"
                      : "pointer-events-none h-12 w-0 gap-0 opacity-0",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground active:bg-muted/40"
                )}
              >
                <Icon
                  className={cn(
                    "transition-all duration-300",
                    expanded ? "h-[19px] w-[19px]" : "h-[22px] w-[22px]"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "overflow-hidden font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em] transition-all duration-300 ease-out",
                    expanded ? "max-h-3 opacity-100" : "max-h-0 opacity-0"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
