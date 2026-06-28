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

  // Floating iOS-style tab bar. It keeps the glassy floating pill look and the
  // shrink-on-scroll feel, but it is LOCKED to the bottom and never floats up
  // into the content. The trick: the shell is a fixed-height 100dvh column
  // that itself never scrolls — <main> is the only scroller — and the bar is
  // `position: absolute` against that non-scrolling shell. A `fixed` bar is
  // anchored to the viewport and iOS detaches it during momentum scrolling;
  // an `absolute` bar inside a box that doesn't scroll simply can't move.
  //
  // At rest it's a compact pill of four icons; tap it and it grows to icons +
  // labels with the active tab in an amber pill. Scrolling <main> shrinks it
  // back to the compact pill — it only ever grows again on tap.
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLElement>(null);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg ?? navigator.serviceWorker.register("/sw.js"))
      .catch(() => undefined);
  }, []);

  // Switching tabs collapses the bar and scrolls the new page to the top.
  // (The window isn't the scroller anymore, so the framework's scroll
  // restoration doesn't reach <main> — reset it ourselves.)
  useEffect(() => {
    setExpanded(false);
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    lastY.current = 0;
  }, [pathname]);

  // Any scroll of <main> shrinks the pill back to compact. It only grows
  // again when the user taps it — there is deliberately no scroll-up expand.
  const onScroll = () => {
    if (ticking.current) return;
    ticking.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        const y = el.scrollTop;
        if (Math.abs(y - lastY.current) > 4) setExpanded(false);
        lastY.current = y;
      }
      ticking.current = false;
    });
  };

  if (hideNav) {
    return <>{children}</>;
  }

  const activeHref = (
    NAV.find((item) =>
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
    ) ?? NAV[0]
  ).href;

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden">
      <main
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 7rem)",
          paddingLeft: "max(env(safe-area-inset-left), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1rem)",
        }}
      >
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div
          onClick={() => {
            if (!expanded) setExpanded(true);
          }}
          className={cn(
            "pointer-events-auto flex items-center rounded-[26px] border border-border/60 bg-background/70 shadow-[0_12px_44px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-300 ease-out",
            expanded ? "gap-1 p-2" : "gap-0.5 p-1.5"
          )}
        >
          {NAV.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            // All four icons stay visible in both states. Collapsed = compact
            // icons only; tapping anywhere expands the bar (it doesn't navigate
            // yet). Expanded = icons + labels; tapping a tab navigates and
            // collapses the bar back down.
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  if (!expanded) {
                    e.preventDefault();
                    setExpanded(true);
                  } else {
                    setExpanded(false);
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300 ease-out",
                  expanded ? "w-16 gap-1" : "w-12 gap-0"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-300",
                    expanded ? "h-10 w-10" : "h-9 w-9",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-all duration-300",
                      expanded ? "h-5 w-5" : "h-[21px] w-[21px]"
                    )}
                    strokeWidth={active ? 2.4 : 2}
                  />
                </span>
                <span
                  className={cn(
                    "overflow-hidden font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.08em] transition-all duration-300 ease-out",
                    active ? "text-primary" : "text-muted-foreground",
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
