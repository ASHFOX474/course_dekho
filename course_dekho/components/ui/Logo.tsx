import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

/** The CourseDekho logo mark (icon + wordmark). Used on the login page and in the sidebar. */
export function Logo({ variant = "light", className }: { variant?: "light" | "dark"; className?: string }) {
  const isDark = variant === "dark";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          isDark ? "bg-white/10 text-white" : "bg-violet-600 text-white"
        )}
      >
        <GraduationCap size={20} />
      </span>
      <span className={cn("text-lg font-extrabold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
        CourseDekho
      </span>
    </div>
  );
}
