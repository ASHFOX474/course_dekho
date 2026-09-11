import { cn } from "@/lib/utils";

/**
 * A simple horizontal progress bar.
 * `percent` should already be clamped between 0 and 100 by the caller
 * (see lib/utils.ts -> clampPercent).
 */
export function ProgressBar({
  percent,
  className,
  trackClassName,
  barClassName,
}: {
  percent: number;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-slate-100", trackClassName, className)}>
      <div
        className={cn("h-full rounded-full bg-violet-600 transition-all", barClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
