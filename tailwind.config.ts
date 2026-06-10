import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        jakarta: ["var(--font-jakarta)", "sans-serif"],
      },
      colors: {
        "text-primary": "#F0F4FF",
        "text-secondary": "#8899BB",
        "text-muted": "#4A5A7A",
        // KickStreaming Design System
        pitch: {
          black: "#050810",
          dark: "#0A0F1E",
          card: "#0D1528",
          border: "#1A2440",
          muted: "#1E2D4A",
          // Accent: Electric Green (FIFA/football energy)
          green: "#00E676",
          "green-dim": "#00C853",
          "green-glow": "rgba(0,230,118,0.15)",
          // Secondary: Electric Blue
          blue: "#0EA5E9",
          "blue-dim": "#0284C7",
          "blue-glow": "rgba(14,165,233,0.15)",
          // Alert: Vivid Red (cards)
          red: "#FF3D3D",
          "red-dim": "#E53935",
          // Warning: Gold (yellow cards)
          gold: "#FFD600",
          "gold-dim": "#F9A825",
          // Text
          "text-primary": "#F0F4FF",
          "text-secondary": "#8899BB",
          "text-muted": "#4A5A7A",
        },
      },
      backgroundImage: {
        // Glassmorphism gradient base
        "glass-card": "linear-gradient(135deg, rgba(13,21,40,0.9) 0%, rgba(10,15,30,0.95) 100%)",
        "glass-hover": "linear-gradient(135deg, rgba(20,32,58,0.95) 0%, rgba(13,21,40,0.98) 100%)",
        "pitch-gradient": "linear-gradient(180deg, #050810 0%, #0A0F1E 50%, #050810 100%)",
        "hero-gradient": "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,230,118,0.15) 0%, transparent 60%)",
        "green-glow": "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,230,118,0.1) 0%, transparent 70%)",
      },
      backdropBlur: {
        xs: "2px",
        glass: "12px",
        heavy: "24px",
      },
      boxShadow: {
        "glass": "0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)",
        "glass-hover": "0 0 0 1px rgba(0,230,118,0.2), 0 8px 32px rgba(0,0,0,0.6)",
        "green-glow": "0 0 20px rgba(0,230,118,0.25), 0 0 60px rgba(0,230,118,0.1)",
        "blue-glow": "0 0 20px rgba(14,165,233,0.25)",
        "card": "0 1px 0 rgba(255,255,255,0.05), 0 -1px 0 rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.5)",
        "live-pulse": "0 0 0 0 rgba(255,61,61,0.7)",
      },
      animation: {
        "pulse-live": "pulse-live 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "score-pop": "score-pop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right": "slide-in-right 0.4s cubic-bezier(0.16,1,0.3,1)",
        "fade-in": "fade-in 0.3s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
        "ticker": "ticker 20s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-live": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "score-pop": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(40px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "ticker": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,230,118,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(0,230,118,0.35), 0 0 80px rgba(0,230,118,0.1)" },
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
