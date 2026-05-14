import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { RestTimerProvider } from "@/components/rest-timer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
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
  themeColor: "#0a0a0a",
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
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <StoreProvider>
          <RestTimerProvider>
            <AppShell>{children}</AppShell>
          </RestTimerProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
