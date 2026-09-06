/**
 * lib/utils.ts
 * ------------------------------------------------------------------
 * Small, dependency-free helper functions shared across the app.
 * ------------------------------------------------------------------
 */

/** Joins conditional class names together, skipping falsy values. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Formats an ISO date string like "2024-05-20" as "20 May 2024". */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats an ISO timestamp as a short relative string ("2h ago", "3d ago").
 * Falls back to a plain date once it's more than ~4 weeks old.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < week * 4) return `${Math.floor(diffMs / day)}d ago`;
  return formatDate(iso);
}

/** Clamp a number between 0 and 100 — used for progress percentages. */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
