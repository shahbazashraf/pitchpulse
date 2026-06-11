import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Highlight } from "@/types";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export function formatMatchTime(status: string, minute: number | null): string {
  if (status === "HT") return "HT";
  if (status === "FT") return "FT";
  if (status === "AET") return "AET";
  if (status === "PEN") return "PEN";
  if (status === "NS") return "";
  if (status === "PST") return "PST";
  if (minute !== null) return `${minute}'`;
  return status;
}

export function isLiveStatus(status: string): boolean {
  return ["1H", "2H", "HT", "ET", "BT", "P"].includes(status);
}

export function formatKickoff(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatMatchDate(isoDate: string): string {
  const d = new Date(isoDate);
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

export function getDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

export function getLocalDateString(dateInput: Date | number = 0): string {
  const d = dateInput instanceof Date ? dateInput : new Date();
  if (typeof dateInput === "number" && dateInput !== 0) {
    d.setDate(d.getDate() + dateInput);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isOfficialHighlight(h: Highlight): boolean {
  const p = (h.provider ?? "").toLowerCase();
  const c = (h.competition ?? "").toLowerCase();
  return (
    p === "fifa" || p === "uefa" ||
    c.includes("champions league") ||
    c.includes("europa league") ||
    c.includes("conference league") ||
    c.includes("uefa") ||
    c.includes("fifa")
  );
}
