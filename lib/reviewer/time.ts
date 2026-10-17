"use client";

import { useSyncExternalStore } from "react";

// German relative times for comment meta: "gerade eben", "vor 5 Min.",
// "vor 2 Std.", "gestern", "vor 3 Tagen", then a date.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const dateYearFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short", year: "numeric" });

export function relativeTime(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, now - then);
  if (diff < MIN) return "gerade eben";
  if (diff < HOUR) return `vor ${Math.floor(diff / MIN)} Min.`;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (then >= startOfToday.getTime()) return `vor ${Math.floor(diff / HOUR)} Std.`;
  const days = Math.ceil((startOfToday.getTime() - then) / DAY);
  if (days <= 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  const sameYear = new Date(then).getFullYear() === new Date(now).getFullYear();
  return (sameYear ? dateFormat : dateYearFormat).format(then);
}

// One shared minute clock. Null on the server and during hydration, so times
// render only in the browser and never mismatch.
let now = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now || (now = Date.now()),
    () => null,
  );
}
