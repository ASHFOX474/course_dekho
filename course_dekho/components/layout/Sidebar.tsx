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
  UserCheck,
  Plus,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Learner/Student navigation */
const learnerNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
  { label: "My Progress", href: "/progress", icon: TrendingUp },
  { label: "Access History", href: "/access-history", icon: History },
  { label: "Solved Questions", href: "/solved-questions", icon: CheckCircle2 },
];

/** Teacher/Contributor navigation */
const teacherNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Suggest Courses", href: "/contributor/courses", icon: Plus },
  { label: "My Submissions", href: "/contributor/submissions", icon: Upload },
  { label: "Bookmarks", href: "/bookmarks", icon: Bookmark },
];

/** Admin navigation */
const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Courses", href: "/courses", icon: BookOpen },
  { label: "Manage Courses", href: "/admin/courses", icon: Layers },
  { label: "Material Approvals", href: "/admin/approvals", icon: ShieldCheck },
  { label: "User Approvals", href: "/admin/user-approvals", icon: UserCheck },
];

const accountNav: NavItem[] = [
  { label: "Profile", href: "/profile", icon: User },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  const theme = getTheme(user.role);
  const navItems =
    user.role === "contributor"
      ? teacherNav
      : user.role === "admin"
        ? adminNav
        : learnerNav;

  return (
    <aside className={cn("flex h-full w-60 shrink-0 flex-col", `border-r ${theme.sidebarBg} ${theme.sidebarBorder}`)}>
      <div className="px-5 py-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {navItems.map((item) => (
          <SidebarLink key={item.href} item={item} active={pathname === item.href || pathname.startsWith(item.href)} theme={theme} />
        ))}
      </nav>

      <div className={cn("space-y-1 border-t px-3 py-3", `border-${theme.dividerColor}`)}>
        {accountNav.map((item) => (
          <SidebarLink key={item.href} item={item} active={pathname === item.href} theme={theme} />
        ))}
        <button
          onClick={() => void logout()}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-500",
            theme.navHoverBg,
            "hover:text-rose-600"
          )}
        >
          <LogOut size={17} />
          Logout
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, active, theme }: { item: NavItem; active: boolean; theme: ReturnType<typeof getTheme> }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? cn(theme.navActiveBg, theme.navActiveText) : cn("text-slate-600", theme.navHoverBg, "hover:text-slate-900")
      )}
    >
      <Icon size={17} />
      {item.label}
    </Link>
  );
}
