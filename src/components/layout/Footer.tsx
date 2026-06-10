"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Play, Newspaper, Radio, Globe, ChevronUp,
  Zap, Users, Shield, Youtube,
  MessageSquare, Twitter,
} from "lucide-react";

// ── Static data ───────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "World Cup 2026", href: "/world-cup" },
  { label: "Highlights", href: "/highlights" },
  { label: "Live Streams", href: "/streams" },
  { label: "News", href: "/news" },
  { label: "Competitions", href: "/competitions" },
];

const COMPETITIONS = [
  { label: "FIFA World Cup", href: "/world-cup" },
  { label: "Champions League", href: "/competitions" },
  { label: "Premier League", href: "/competitions" },
  { label: "La Liga", href: "/competitions" },
  { label: "Bundesliga", href: "/competitions" },
  { label: "Serie A", href: "/competitions" },
  { label: "Ligue 1", href: "/competitions" },
  { label: "Europa League", href: "/competitions" },
];

const TOP_TEAMS = [
  { label: "Manchester City", href: "/competitions" },
  { label: "Real Madrid", href: "/competitions" },
  { label: "Barcelona", href: "/competitions" },
  { label: "Liverpool", href: "/competitions" },
  { label: "Bayern Munich", href: "/competitions" },
  { label: "PSG", href: "/competitions" },
  { label: "Arsenal", href: "/competitions" },
  { label: "Dortmund", href: "/competitions" },
];

const TOP_PLAYERS = [
  { label: "Kylian Mbappé", href: "/world-cup" },
  { label: "Erling Haaland", href: "/world-cup" },
  { label: "Jude Bellingham", href: "/world-cup" },
  { label: "Vinícius Jr.", href: "/world-cup" },
  { label: "Mohamed Salah", href: "/world-cup" },
  { label: "Kevin De Bruyne", href: "/world-cup" },
  { label: "Lionel Messi", href: "/world-cup" },
  { label: "Pedri", href: "/world-cup" },
];

const SOCIAL = [
  { icon: Twitter, label: "Twitter/X", href: "#", color: "hover:text-blue-400" },
  { icon: Youtube, label: "YouTube", href: "#", color: "hover:text-red-500" },
  { icon: MessageSquare, label: "Reddit", href: "#", color: "hover:text-orange-500" },
];

// WC 2026 first match: June 11, 2026 22:00 UTC (Mexico vs. host opener)
const WC_START = new Date("2026-06-11T22:00:00Z").getTime();

// ── Countdown ─────────────────────────────────────────────────────────────────

function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(targetMs - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (remaining <= 0) return null;

  const totalSecs = Math.floor(remaining / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return { days, hours, mins, secs };
}

function CountdownWidget() {
  const cd = useCountdown(WC_START);

  return (
    <div className="bg-pitch-card/60 border border-pitch-border/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-pitch-gold" />
        <span className="text-xs font-bold text-pitch-gold uppercase tracking-wider">World Cup 2026</span>
      </div>
      {cd ? (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { val: cd.days, label: "Days" },
            { val: cd.hours, label: "Hrs" },
            { val: cd.mins, label: "Min" },
            { val: cd.secs, label: "Sec" },
          ].map(({ val, label }) => (
            <div key={label} className="bg-pitch-dark/60 rounded-xl py-2 px-1">
              <div className="text-lg font-black text-pitch-green tabular-nums">
                {String(val).padStart(2, "0")}
              </div>
              <div className="text-[9px] text-pitch-text-muted uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 justify-center py-2">
          <span className="w-2 h-2 rounded-full bg-pitch-green animate-pulse" />
          <span className="text-sm font-bold text-pitch-green">Underway!</span>
        </div>
      )}
      <Link
        href="/world-cup"
        className="mt-3 block text-center text-xs text-pitch-text-secondary hover:text-pitch-green transition-colors font-medium"
      >
        Full World Cup Hub →
      </Link>
    </div>
  );
}

// ── Back to Top ───────────────────────────────────────────────────────────────

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-pitch-green text-pitch-dark flex items-center justify-center shadow-green-glow hover:bg-pitch-green-dim transition-colors cursor-pointer"
        >
          <ChevronUp className="w-5 h-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Link column ───────────────────────────────────────────────────────────────

function FooterLinkCol({ title, icon, links }: {
  title: string;
  icon: React.ReactNode;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-pitch-green">{icon}</span>
        <span className="text-xs font-bold text-pitch-text-primary uppercase tracking-wider">{title}</span>
      </div>
      <ul className="space-y-2">
        {links.map(({ label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="text-sm text-pitch-text-secondary hover:text-pitch-green transition-colors duration-150"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Main footer ───────────────────────────────────────────────────────────────

export default function Footer() {
  return (
    <>
      <BackToTop />

      <footer className="mt-16 border-t border-pitch-border/40 bg-pitch-dark/80 backdrop-blur-glass">
        <div className="container mx-auto px-4 py-12 space-y-10">

          {/* Top section: Brand + Newsletter */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8 border-b border-pitch-border/30"
          >
            {/* Brand */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-pitch-green/15 border border-pitch-green/25 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-pitch-green" />
                </div>
                <span className="text-xl font-black text-pitch-text-primary">
                  Kick<span className="text-pitch-green">Streaming</span>
                </span>
              </div>
              <p className="text-sm text-pitch-text-secondary max-w-xs leading-relaxed">
                Your premium football hub — live scores, World Cup 2026, highlights, streams, and AI-powered news. Free. Always.
              </p>
              {/* Social */}
              <div className="flex items-center gap-3">
                {SOCIAL.map(({ icon: Icon, label, href, color }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className={`w-9 h-9 rounded-xl bg-pitch-card/60 border border-pitch-border/40 flex items-center justify-center text-pitch-text-secondary ${color} transition-colors duration-150 cursor-pointer`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
              {/* Live indicator */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-pitch-text-muted">
                  <Radio className="w-3 h-3 text-pitch-green" />
                  Live data powered by
                  <span className="text-pitch-text-secondary font-medium">ESPN & FIFA WC2026 API</span>
                </span>
              </div>
            </div>

            {/* Newsletter + Countdown */}
            <div className="space-y-4">
              <CountdownWidget />
              <div className="bg-pitch-card/40 border border-pitch-border/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Newspaper className="w-4 h-4 text-pitch-blue" />
                  <span className="text-xs font-bold text-pitch-text-primary uppercase tracking-wider">Football Digest</span>
                </div>
                <p className="text-xs text-pitch-text-muted mb-3">Get top football stories delivered daily.</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className="flex-1 px-3 py-2 rounded-xl bg-pitch-dark/60 border border-pitch-border/40 text-sm text-pitch-text-primary placeholder:text-pitch-text-muted focus:outline-none focus:border-pitch-green/40 transition-colors"
                  />
                  <button className="px-4 py-2 rounded-xl bg-pitch-green text-pitch-dark text-sm font-bold hover:bg-pitch-green-dim transition-colors cursor-pointer shrink-0">
                    Subscribe
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Links grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-8 border-b border-pitch-border/30"
          >
            <FooterLinkCol
              title="Navigate"
              icon={<Globe className="w-3.5 h-3.5" />}
              links={NAV_LINKS}
            />
            <FooterLinkCol
              title="Competitions"
              icon={<Trophy className="w-3.5 h-3.5" />}
              links={COMPETITIONS}
            />
            <FooterLinkCol
              title="Top Teams"
              icon={<Shield className="w-3.5 h-3.5" />}
              links={TOP_TEAMS}
            />
            <div className="space-y-6">
              <FooterLinkCol
                title="Players"
                icon={<Users className="w-3.5 h-3.5" />}
                links={TOP_PLAYERS}
              />
            </div>
          </motion.div>

          {/* Bottom bar */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-pitch-text-muted"
          >
            <div className="flex items-center gap-1">
              <Play className="w-3 h-3 text-pitch-green" />
              <span>© 2026 KickStreaming. All rights reserved.</span>
              <span className="mx-2 opacity-30">·</span>
              <span>Data: ESPN, FIFA WC2026 API</span>
            </div>
            <div className="flex items-center gap-4">
              {["Privacy Policy", "Terms of Service", "DMCA", "Cookie Policy"].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="hover:text-pitch-text-secondary transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </motion.div>

        </div>
      </footer>
    </>
  );
}
