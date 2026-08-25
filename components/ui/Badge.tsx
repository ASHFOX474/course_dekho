import { cn } from "@/lib/utils";

/** Supported color themes for the badge. */
type BadgeTone = "neutral" | "purple" | "green" | "yellow" | "red" | "blue";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  purple: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-rose-100 text-rose-700",
  blue: "bg-sky-100 text-sky-700",
};

/** A small rounded pill used to label status ("Pending"), type ("Tutorial") etc. */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Maps a Submission's status to the right badge tone + label. */
export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  if (status === "approved") return <Badge tone="green">Approved</Badge>;
  if (status === "rejected") return <Badge tone="red">Rejected</Badge>;
  return <Badge tone="yellow">Pending</Badge>;
}
