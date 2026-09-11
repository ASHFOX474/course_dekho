"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserRole } from "@/lib/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

/**
 * Wraps every authenticated page with the Sidebar + Topbar and makes
 * sure only a logged-in user (of the right role, if `allowedRoles` is
 * given) can see the page content.
 */
export function AppShell({
  children,
  title,
  allowedRoles,
}: {
  children: ReactNode;
  title?: string;
  allowedRoles?: UserRole[];
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
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
        </main>
      </div>
    </div>
  );
}
