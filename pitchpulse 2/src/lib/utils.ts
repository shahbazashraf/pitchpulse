import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
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
