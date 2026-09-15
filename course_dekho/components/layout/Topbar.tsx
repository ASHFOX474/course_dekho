"use client";
import Link from "next/link";
import { Menu, Search, ChevronRight, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";

export function Topbar({ title, onMenu, menuOpen }: { title?: string; onMenu: () => void; menuOpen: boolean }) {
  const { user } = useAuth();
  if (!user) return null;
  const admin = user.role === "admin";
  return <header className="workspace-topbar">
    <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onMenu} aria-expanded={menuOpen} aria-controls="workspace-navigation" aria-label="Toggle navigation" className="rounded-lg p-2 lg:hidden"><Menu size={21} /></button><span className="hidden text-xs text-slate-400 sm:block">{admin ? "Control center" : user.role === "contributor" ? "Studio" : "CourseDekho"}</span><ChevronRight size={13} className="hidden text-slate-300 sm:block" /><h1 className="truncate text-sm font-semibold">{title ?? "Overview"}</h1></div>
    <div className="flex items-center gap-3 sm:gap-5"><Link href={admin ? "/admin/approvals" : "/courses"} className="hidden items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 sm:flex">{admin ? <ShieldCheck size={16} /> : <Search size={16} />}{admin ? "Review queue" : "Explore catalog"}<ArrowUpRight size={13} /></Link><Link href="/profile" aria-label="Open your profile" className="flex items-center gap-3 border-l border-slate-200 pl-4"><span className="workspace-avatar">{user.avatarInitials}</span><span className="hidden text-left xl:block"><span className="block text-xs font-semibold">{user.name}</span><span className="text-[10px] capitalize text-slate-400">{user.role}</span></span></Link></div>
  </header>;
}
