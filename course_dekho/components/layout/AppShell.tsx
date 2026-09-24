"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserRole } from "@/lib/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { WorkspacePreferences } from "@/components/layout/WorkspacePreferences";
import { Topbar } from "@/components/layout/Topbar";
import type { CourseNavigation } from "@/lib/course-sections";

/**
 * Wraps every authenticated page with the Sidebar + Topbar and makes
 * sure only a logged-in user (of the right role, if `allowedRoles` is
 * given) can see the page content.
 */
export function AppShell({
  children,
  title,
  allowedRoles,
  courseNavigation,
}: {
  children: ReactNode;
  title?: string;
  allowedRoles?: UserRole[];
  courseNavigation?: CourseNavigation;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Not logged in -> bounce to the login page.
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading CourseDekho...</p>
      </div>
    );
  }

  const roleIsAllowed = !allowedRoles || allowedRoles.includes(user.role);

  return (
    <div className={`workspace workspace-${user.role}`}>
      <WorkspacePreferences userId={user.id} />
      <a href="#main-content" className="skip-link">Skip to content</a>
      {menuOpen && <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      <div id="workspace-navigation" className={`workspace-navigation ${menuOpen ? "is-open" : ""}`}><Sidebar courseNavigation={courseNavigation} onNavigate={() => setMenuOpen(false)} /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setMenuOpen(open => !open)} menuOpen={menuOpen} />
        <main id="main-content" className="workspace-main"><div className="workspace-content">
          {roleIsAllowed ? (
            children
          ) : (
            <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <ShieldAlert className="mx-auto mb-3 text-rose-500" size={32} />
              <h2 className="text-lg font-semibold text-slate-900">Access restricted</h2>
              <p className="mt-1 text-sm text-slate-500">
                This page is only available to {allowedRoles?.join(" or ")} accounts. You&apos;re logged in as a{" "}
                {user.role}.
              </p>
            </div>
          )}
        </div></main>
      </div>
    </div>
  );
}
