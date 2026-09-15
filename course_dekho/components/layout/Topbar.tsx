"use client";

import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getTheme } from "@/lib/theme";

export function Topbar({ title }: { title?: string }) {
  const { user } = useAuth();
  if (!user) return null;

  const theme = getTheme(user.role);
  const roleLabel: Record<string, string> = {
    learner: "Learner",
    contributor: "Contributor",
    admin: "Admin",
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      {title ? (
        <h1 className="text-base font-semibold text-slate-900">{title}</h1>
      ) : (
        <div className="relative w-full max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search for courses, topics, resources..."
            className={`w-full rounded-full border ${theme.inputBorder} bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 ${theme.inputFocusBorder} ${theme.inputFocusBg} focus:outline-none`}
          />
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-full p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <Bell size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${theme.avatarBg} ${theme.avatarText} text-sm font-semibold`}>
            {user.avatarInitials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${theme.badgeBg} ${theme.badgeText}`}>
              {roleLabel[user.role]}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
