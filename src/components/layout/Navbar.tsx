"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Trophy, Users, Newspaper, Radio, Bell, User, Menu, X, Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",            label: "Scores",      icon: Zap },
  { href: "/competitions",label: "Competitions", icon: Trophy },
  { href: "/teams",       label: "Teams",        icon: Users },
  { href: "/streams",     label: "Streams",      icon: Radio },
  { href: "/news",        label: "News",         icon: Newspaper },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="sticky top-0 z-50 glass border-b border-pitch-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <div className="relative w-7 h-7">
                <div className="w-7 h-7 rounded-lg bg-pitch-green flex items-center justify-center shadow-green-glow group-hover:shadow-[0_0_24px_rgba(0,230,118,0.6)] transition-shadow duration-300">
                  <Zap className="w-4 h-4 text-pitch-black fill-pitch-black" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-pitch-red rounded-full border border-pitch-black animate-pulse-live" />
              </div>
              <span className="font-bold text-lg tracking-tight text-pitch-text-primary group-hover:text-gradient-green transition-all duration-300">
                PitchPulse
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-pitch-green bg-pitch-green/10"
                        : "text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-lg border border-pitch-green/30 bg-pitch-green/5"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40 transition-colors"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-lg text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
              </button>
              <Link
                href="/account"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pitch-green/10 border border-pitch-green/20 text-pitch-green text-sm font-medium hover:bg-pitch-green/20 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                Sign in
              </Link>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded-lg text-pitch-text-secondary hover:bg-pitch-muted/40 transition-colors"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className="fixed top-0 right-0 h-full w-72 z-50 glass border-l border-pitch-border flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-pitch-border">
                <span className="font-bold text-pitch-text-primary">Menu</span>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-pitch-muted/40 text-pitch-text-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                        isActive
                          ? "text-pitch-green bg-pitch-green/10 border border-pitch-green/20"
                          : "text-pitch-text-secondary hover:text-pitch-text-primary hover:bg-pitch-muted/40",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-pitch-border">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-pitch-green text-pitch-black font-semibold text-sm"
                >
                  <User className="w-4 h-4" />
                  Sign in
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
