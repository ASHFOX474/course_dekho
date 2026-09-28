"use client";
import Link from "next/link";
import { useEffect } from "react";
import { ADMIN_ATTENTION_CHANGED } from "@/lib/client/admin-attention";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, LayoutDashboard, Settings, ShieldCheck, TrendingUp, Upload, Users, Layers, MessageSquare, ClipboardCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { Logo } from "@/components/ui/Logo";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { listEnrollmentRequests, listPendingUsers, listSubmissionsForReview } from "@/lib/client/workspace-api";
import { listSupport } from "@/lib/client/support-api";
import { cn } from "@/lib/utils";
import { courseSections, type CourseNavigation } from "@/lib/course-sections";

type Item = { label: string; href: string; icon: LucideIcon };
const contributorDiscovery: Item[] = [
  { label: "Explore courses", href: "/courses", icon: BookOpen },
  { label: "Bookmark", href: "/bookmarks", icon: Bookmark },
  { label: "Help & suggestions", href: "/support", icon: MessageSquare },
];
const learnerNavigation: Item[] = [
  { label: "My learning", href: "/dashboard", icon: LayoutDashboard },
  { label: "Explore courses", href: "/courses", icon: BookOpen },
  { label: "Bookmark", href: "/bookmarks", icon: Bookmark },
  { label: "My progress", href: "/progress", icon: TrendingUp },
  { label: "Help & suggestions", href: "/support", icon: MessageSquare },
];
const administration: Item[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Content review", href: "/admin/approvals", icon: ShieldCheck },
  { label: "User directory", href: "/admin/user-approvals", icon: Users },
  { label: "Enrollment requests", href: "/admin/enrollments", icon: ClipboardCheck },
  { label: "Academic management", href: "/admin/courses", icon: Layers },
  { label: "Published catalog", href: "/courses", icon: BookOpen },
  { label: "Support inbox", href: "/admin/support", icon: MessageSquare },
];
const contribution: Item[] = [
  { label: "Studio overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "My submissions", href: "/contributor/submissions", icon: Upload },
  { label: "Course workspace", href: "/contributor/courses", icon: Layers },
];
export function Sidebar({ onNavigate, courseNavigation }: { onNavigate?: () => void; courseNavigation?: CourseNavigation }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const contributor = user?.role === "contributor";
  const submissions = useDatabaseData("admin-sidebar-submissions", admin ? listSubmissionsForReview : async () => [], []);
  const pendingUsers = useDatabaseData("admin-sidebar-pending-users", admin ? listPendingUsers : async () => [], []);
  const enrollments = useDatabaseData("admin-sidebar-enrollments", admin ? listEnrollmentRequests : async () => [], []);
  const supportRequests = useDatabaseData("admin-sidebar-support", admin ? listSupport : async () => [], []);
  const refreshSupport = supportRequests.refresh;
  useEffect(() => {
    if (!admin) return;
    window.addEventListener(ADMIN_ATTENTION_CHANGED, refreshSupport);
    return () => window.removeEventListener(ADMIN_ATTENTION_CHANGED, refreshSupport);
  }, [admin, refreshSupport]);
  if (!user) return null;
  const items = admin ? administration : contributor ? contribution : learnerNavigation;
  const alertMap = admin ? {
    "/admin/approvals": submissions.data.some((row) => row.status === "pending"),
    "/admin/user-approvals": pendingUsers.data.length > 0,
    "/admin/enrollments": enrollments.data.some((row) => row.status === "pending"),
    "/admin/support": supportRequests.data.some((ticket) => ticket.status === "open"),
  } : {};
  function links(rows: Item[]) {
    return rows.map(({ icon: Icon, ...item }) => {
      const active = pathname === item.href || pathname.startsWith(item.href + "/");
      const urgent = admin && alertMap[item.href as keyof typeof alertMap];
      return <Link onClick={onNavigate} key={item.href} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn("workspace-nav-link", active && "is-active", urgent && (item.href === "/admin/support" ? "border border-rose-200 bg-rose-50/80 text-rose-700" : "bg-rose-50/80 text-rose-700"))}><Icon size={18} /><span>{item.label}</span>{urgent ? (item.href === "/admin/support" ? <span aria-label="Open support tickets" className="ml-auto h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" /> : <span aria-label="Needs attention" className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">!</span>) : active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}</Link>;
    });
  }
  return <aside className="workspace-sidebar">
    <Link href="/dashboard" onClick={onNavigate} className="block px-6 pt-7 pb-5"><Logo variant={admin || contributor ? "dark" : "light"} /></Link>
    <div className="mx-6 mb-8 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.2em] opacity-60"><span className="h-1 w-5 bg-current" />{admin ? "Administration" : contributor ? "Contributor studio" : "Your learning space"}</div>
    <nav aria-label="Main navigation" className="flex-1 space-y-1 overflow-y-auto px-3">
      {courseNavigation && <div className="course-navigation mb-6">
        <p className="nav-label">This course</p>
        {courseSections.map(section => <button key={section.id} type="button"
          onClick={() => { onNavigate?.(); courseNavigation.onSelect(section.id); }}
          aria-controls={`course-${section.id}`} aria-current={courseNavigation.activeId === section.id ? 'location' : undefined}
          className={cn('workspace-nav-link w-full text-left', courseNavigation.activeId === section.id && 'is-active')}>
          {section.id === 'roadmap' ? <TrendingUp size={18} /> : section.id === 'slides' ? <Layers size={18} /> : <BookOpen size={18} />}
          <span>{section.label}</span>
        </button>)}
      </div>}
      <p className="nav-label">{admin ? "Platform" : contributor ? "Create & contribute" : "Discover"}</p>{links(items)}
      {contributor && <><p className="nav-label mt-7">Discover</p>{links(contributorDiscovery)}</>}
    </nav>
    {user.role === "learner" ? <div className="learner-account-navigation space-y-1 border-t border-current/10 p-3"><Link href="/profile" onClick={onNavigate} aria-label="Open your profile" className="learner-profile-link flex items-center gap-3 rounded-lg p-2"><span className="workspace-avatar">{user.avatarInitials}</span><span className="min-w-0 text-left"><span className="block truncate text-xs font-semibold">{user.name}</span><span className="block text-[10px] capitalize opacity-60">{user.role}</span></span></Link>{links([{ label: "Preferences", href: "/settings", icon: Settings }])}</div> : admin && <div className="space-y-1 border-t border-current/10 p-3">{links([{ label: "Settings", href: "/settings", icon: Settings }])}</div>}
  </aside>;
}
