"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Dumbbell, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Today", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNav = pathname === "/login" || pathname.startsWith("/select");

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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <main
        className="flex-1 px-4 sm:px-6"
        style={{
          paddingTop: "max(1.5rem, env(safe-area-inset-top))",
          paddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around">
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
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
