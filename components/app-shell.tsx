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

  // iOS-26-style floating tab bar. It sits full size (icon + label) at the top
  // of a page, then shrinks into a compact icons-only pill while you scroll
  // down through content (food log, workout sets…), and pops back to full size
  // when you scroll up, reach the top, or tap it. Just a presentation toggle —
  // every tab and link behaves exactly as before.
  const [collapsed, setCollapsed] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg ?? navigator.serviceWorker.register("/sw.js"))
      .catch(() => undefined);
  }, []);

  // Landing on a new tab puts you at the top, so start expanded.
  useEffect(() => {
    setCollapsed(false);
    lastY.current = typeof window !== "undefined" ? window.scrollY : 0;
  }, [pathname]);

  useEffect(() => {
    if (hideNav) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;
        // Near the top → always expanded. Otherwise collapse on a downward
        // scroll and expand on an upward one (small threshold debounces jitter).
        if (y < 32) {
          setCollapsed(false);
        } else if (delta > 8) {
          setCollapsed(true);
        } else if (delta < -8) {
          setCollapsed(false);
        }
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
          onPointerDown={() => setCollapsed(false)}
          className={cn(
            "pointer-events-auto flex items-center rounded-[26px] border border-border/60 bg-background/70 shadow-[0_12px_44px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition-all duration-300 ease-out",
            collapsed ? "gap-1 p-1.5" : "gap-1.5 p-2"
          )}
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl transition-all duration-300 ease-out",
                  collapsed ? "h-11 w-11 gap-0" : "h-14 w-16 gap-1",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground active:bg-muted/40"
                )}
              >
                <Icon
                  className={cn(
                    "transition-all duration-300",
                    collapsed ? "h-[22px] w-[22px]" : "h-[19px] w-[19px]"
                  )}
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "overflow-hidden font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em] transition-all duration-300 ease-out",
                    collapsed
                      ? "max-h-0 opacity-0"
                      : "max-h-3 opacity-100"
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
