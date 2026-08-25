"use client";

import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

const roleLabel: Record<string, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};

export function Topbar({ title }: { title?: string }) {
  const { user } = useAuth();
  if (!user) return null;

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
            className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
            {user.avatarInitials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{user.name}</p>
            <p className="text-xs leading-tight text-slate-500">{roleLabel[user.role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
