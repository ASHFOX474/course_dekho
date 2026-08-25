"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  History,
  Home,
  LogOut,
  LucideIcon,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Every role sees these — reading, browsing and tracking their own activity. */
const commonNavItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { label: "My Progress", href: "/progress", icon: TrendingUp },
  { label: "Access History", href: "/access-history", icon: History },
  { label: "Solved Questions", href: "/solved-questions", icon: CheckCircle2 },
];

const teacherNavItems: NavItem[] = [{ label: "My Submissions", href: "/teacher/submissions", icon: Upload }];

const adminNavItems: NavItem[] = [{ label: "Approval Queue", href: "/admin/approvals", icon: ShieldCheck }];

const accountNavItems: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  // Build the nav list based on role: everyone gets the common items,
  // plus one extra role-specific item for teachers/admins.
  const roleNavItems = user.role === "teacher" ? teacherNavItems : user.role === "admin" ? adminNavItems : [];

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="px-5 py-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {commonNavItems.map((item) => (
          <SidebarLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        {roleNavItems.length > 0 && (
          <>
            <div className="my-2 border-t border-slate-100" />
            {roleNavItems.map((item) => (
              <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>

      <div className="space-y-1 border-t border-slate-100 px-3 py-3">
        {accountNavItems.map((item) => (
          <SidebarLink key={item.href} item={item} active={pathname === item.href} />
        ))}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-rose-600"
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-violet-50 text-violet-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon size={17} />
      {item.label}
    </Link>
  );
}
