"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, CheckCircle2, History, LayoutDashboard, LogOut, Settings, ShieldCheck, TrendingUp, Upload, User, Users, Layers, ArrowUpRight, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

type Item = { label: string; href: string; icon: LucideIcon };
const learning: Item[] = [
  { label: "My learning", href: "/dashboard", icon: LayoutDashboard },
  { label: "Explore courses", href: "/courses", icon: BookOpen },
  { label: "Saved resources", href: "/bookmarks", icon: Bookmark },
  { label: "My progress", href: "/progress", icon: TrendingUp },
  { label: "History", href: "/access-history", icon: History },
  { label: "Solved questions", href: "/solved-questions", icon: CheckCircle2 },
];
const administration: Item[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Content review", href: "/admin/approvals", icon: ShieldCheck },
  { label: "User directory", href: "/admin/user-approvals", icon: Users },
  { label: "Course management", href: "/admin/courses", icon: Layers },
  { label: "Published catalog", href: "/courses", icon: BookOpen },
];
const contribution: Item[] = [
  { label: "Studio overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "My submissions", href: "/contributor/submissions", icon: Upload },
  { label: "Course workspace", href: "/contributor/courses", icon: Layers },
];
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (!user) return null;
  const admin = user.role === "admin";
  const contributor = user.role === "contributor";
  const items = admin ? administration : contributor ? contribution : learning;
  function links(rows: Item[]) {
    return rows.map(({ icon: Icon, ...item }) => {
      const active = pathname === item.href || pathname.startsWith(item.href + "/");
      return <Link onClick={onNavigate} key={item.href} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn("workspace-nav-link", active && "is-active")}><Icon size={18} /><span>{item.label}</span>{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}</Link>;
    });
  }
  return <aside className="workspace-sidebar">
    <Link href="/dashboard" onClick={onNavigate} className="block px-6 pt-7 pb-5"><Logo variant={admin || contributor ? "dark" : "light"} /></Link>
    <div className="mx-6 mb-8 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] opacity-60"><span className="h-1 w-5 bg-current" />{admin ? "Administration" : contributor ? "Contributor studio" : "Your learning space"}</div>
    <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
      <p className="nav-label">{admin ? "Platform" : contributor ? "Create & contribute" : "Discover"}</p>{links(items)}
      {contributor && <><p className="nav-label mt-7">Your learning</p>{links(learning.filter(item => item.href !== "/dashboard"))}</>}
    </nav>
    {contributor && <Link href="/contributor/submissions" onClick={onNavigate} className="studio-note mx-4 my-5 block rounded-xl border border-white/15 bg-white/5 p-4"><Upload size={20} /><p className="mt-3 text-sm font-semibold">Share what you know</p><p className="mt-1 text-xs leading-relaxed opacity-60">Turn your notes into someone?s next breakthrough.</p><span className="mt-3 inline-flex items-center gap-2 text-xs">Open submissions <ArrowUpRight size={14} /></span></Link>}
    <div className="space-y-1 border-t border-current/10 p-3">{links([{ label: "Your profile", href: "/profile", icon: User }, { label: "Preferences", href: "/settings", icon: Settings }])}<button type="button" aria-label="Sign out" onClick={() => void logout()} className="workspace-nav-link w-full"><LogOut size={18} />Sign out</button></div>
  </aside>;
}
