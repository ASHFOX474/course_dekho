import { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const colorClasses = {
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  green: "bg-green-50 text-green-600",
  rose: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
};

/** One of the small metric cards at the top of a dashboard (e.g. "Enrolled Courses: 8"). */
export function StatCard({
  icon: Icon,
  label,
  value,
  color = "violet",
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color?: keyof typeof colorClasses;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", colorClasses[color])}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
      {href && (
        <Link href={href} className="mt-2 inline-block text-xs font-medium text-violet-600 hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}
