import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { LiveTicker } from "@/components/live/LiveTicker";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "PitchPulse — Live Football Scores, Streams & Stats",
    template: "%s | PitchPulse",
  },
  description:
    "Live football scores, match streams, lineups, stats, and commentary for the FIFA World Cup 2026 and all major competitions.",
  keywords: [
    "FIFA World Cup 2026", "live football scores", "watch World Cup free",
    "live football stream", "match lineups", "football commentary",
    "live soccer scores", "World Cup 2026 live",
  ],
  openGraph: {
    type: "website",
    siteName: "PitchPulse",
    title: "PitchPulse — Live Football Scores, Streams & Stats",
    description: "Live scores, free streams and real-time stats for the FIFA World Cup 2026.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PitchPulse — Live Football",
    description: "FIFA World Cup 2026 live scores, streams, and stats.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#00E676",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakartaSans.variable} dark`}>
      <body className="bg-pitch-black text-pitch-text-primary antialiased min-h-screen font-jakarta">
        <Providers>
          <div className="relative min-h-screen bg-pitch-gradient">
            {/* Ambient background glow */}
            <div className="fixed inset-0 bg-hero-gradient pointer-events-none z-0" />
            <div className="fixed top-0 left-1/4 w-96 h-96 bg-pitch-green/5 rounded-full blur-3xl pointer-events-none z-0" />
            <div className="fixed bottom-1/4 right-1/4 w-64 h-64 bg-pitch-blue/5 rounded-full blur-3xl pointer-events-none z-0" />

            <div className="relative z-10 flex flex-col min-h-screen">
              <LiveTicker />
              <Navbar />
              <main className="flex-1">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
