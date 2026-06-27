import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { RestTimerProvider } from "@/components/rest-timer";

// Forge design system typography: Hanken Grotesk for UI text, JetBrains Mono
// for the tabular numbers / labels. Exposed as CSS variables that globals.css
// wires into Tailwind's --font-sans / --font-mono, so the whole app picks them
// up without touching individual components.
const forgeSans = Hanken_Grotesk({
  variable: "--font-forge-sans",
  subsets: ["latin"],
});

const forgeMono = JetBrains_Mono({
  variable: "--font-forge-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gym Tracker",
  description: "Upper-body push / pull / pump tracker with PR progression",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Gym",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1613",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${forgeSans.variable} ${forgeMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {/* Forge warm-amber glow as its own fixed layer behind the app, so we
            don't need `background-attachment: fixed` on <body> (which breaks
            position:fixed on iOS). pointer-events-none + -z-10 keep it inert
            and behind all content. */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            backgroundImage:
              "radial-gradient(120% 70% at 50% -10%, oklch(0.32 0.05 75 / 0.35), transparent 55%)",
          }}
        />
        <StoreProvider>
          <RestTimerProvider>
            <AppShell>{children}</AppShell>
          </RestTimerProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
