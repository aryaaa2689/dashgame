import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-barlow",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono-tel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JUNGLE DASHERS — Wild 3D Sprint Racing",
  description:
    "A realtime 3D multiplayer arcade racer. Sprint floating jungle circuits, chain arithmetic speed pickups and outrun the pack.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05100b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${mono.variable}`}>
      <body className="overscroll-none bg-[#05100b] text-hud antialiased">{children}</body>
    </html>
  );
}
