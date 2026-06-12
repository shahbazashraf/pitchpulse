"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Moon, Sun, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/world-cup", label: "🏆 World Cup", accent: true },
  { href: "/competitions", label: "Competitions" },
  { href: "/news", label: "News" },
  { href: "/highlights", label: "Highlights" },
  { href: "/streams", label: "Streams" },
];

export default function Navbar() {
  const [dark, setDark] = useState<boolean>(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) setDark(saved === 'dark');
    else setDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <header className="bg-pitch-card border-b border-pitch-border shadow-glass relative z-40">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-text-primary shrink-0">
          Kick<span className="text-pitch-green">Streaming</span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex space-x-4 items-center">
          {NAV_LINKS.map(({ href, label, accent }) => (
            <li key={href}>
              <Link
                href={href}
                className={accent
                  ? "text-yellow-400 hover:text-yellow-300 transition font-semibold"
                  : "text-text-secondary hover:text-text-primary transition"}
              >
                {label}
              </Link>
            </li>
          ))}
          <li>
            <button
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark mode"
              className="p-2 rounded-full hover:bg-pitch-glow transition"
            >
              {dark ? <Moon size={20} className="text-text-primary" /> : <Sun size={20} className="text-text-primary" />}
            </button>
          </li>
        </ul>

        {/* Mobile right side */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setDark(!dark)}
            aria-label="Toggle dark mode"
            className="p-2 rounded-full hover:bg-pitch-glow transition"
          >
            {dark ? <Moon size={18} className="text-text-primary" /> : <Sun size={18} className="text-text-primary" />}
          </button>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="p-2 rounded-full hover:bg-pitch-glow transition"
          >
            {menuOpen ? <X size={20} className="text-text-primary" /> : <Menu size={20} className="text-text-primary" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-pitch-border bg-pitch-card">
          <ul className="flex flex-col py-2">
            {NAV_LINKS.map(({ href, label, accent }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-5 py-3 text-sm font-medium transition ${accent
                    ? "text-yellow-400 hover:text-yellow-300"
                    : "text-text-secondary hover:text-text-primary"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
