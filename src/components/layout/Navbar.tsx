"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function Navbar() {
  const [dark, setDark] = useState<boolean>(true);

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
    <header className="bg-pitch-card border-b border-pitch-border shadow-glass">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="text-2xl font-bold text-text-primary">
          PitchPulse
        </Link>
        <ul className="flex space-x-4 items-center">
          <li>
            <Link href="/" className="text-text-secondary hover:text-text-primary transition">
              Home
            </Link>
          </li>
          <li>
            <Link href="/world-cup" className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition font-semibold">
              🏆 <span className="hidden sm:inline">World Cup</span>
            </Link>
          </li>
          <li>
            <Link href="/competitions" className="text-text-secondary hover:text-text-primary transition">
              Competitions
            </Link>
          </li>
          <li>
            <Link href="/news" className="text-text-secondary hover:text-text-primary transition">
              News
            </Link>
          </li>
          <li>
            <Link href="/highlights" className="text-text-secondary hover:text-text-primary transition">
              Highlights
            </Link>
          </li>
          <li>
            <Link href="/streams" className="text-text-secondary hover:text-text-primary transition">
              Streams
            </Link>
          </li>
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
      </nav>
    </header>
  );
}
