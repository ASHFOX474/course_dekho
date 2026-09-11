"use client";

/**
 * app/page.tsx — the "/" route.
 * This page renders nothing itself; it just decides where to send the
 * visitor based on whether they're already logged in.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [isLoading, user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-400">Loading CourseDekho...</p>
    </div>
  );
}
