import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TURBO RACERS — 3D Math Car Racing",
  description:
    "A realtime 3D multiplayer arcade car racer. Sprint wide circuits, chain arithmetic speed gates (+, -, x, ÷) and outrun the pack.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#020914",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="overscroll-none bg-[#020914] text-white antialiased">{children}</body>
    </html>
  );
}
