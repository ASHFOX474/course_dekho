"use client";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { getProfile } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";

export default function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading, error } = useDatabaseData(
    `profile:${user?.id ?? "anonymous"}`,
    getProfile,
    null
  );
  return (
    <AppShell title="Profile">
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading profile from PostgreSQL...</p>
      ) : error || !profile ? (
        <p role="alert" className="text-sm text-rose-600">{error ?? "Profile not found."}</p>
      ) : (
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-xl font-bold text-white">
              {profile.user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{profile.user.name}</p>
              <Badge tone="purple">{profile.user.role[0].toUpperCase() + profile.user.role.slice(1)}</Badge>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            <Row label="Username" value={profile.user.username} />
            <Row label="Email" value={profile.user.email} />
            {profile.university && <Row label="University" value={profile.university.name} />}
            {profile.department && <Row label="Department" value={profile.department} />}
            {profile.yearOfStudy !== null && <Row label="Year of Study" value={String(profile.yearOfStudy)} />}
            {profile.designation && <Row label="Designation" value={profile.designation} />}
          </dl>
          <p className="mt-5 text-center text-xs text-slate-400">This profile is read directly from the active role-profile row.</p>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-50 pb-2"><dt className="text-slate-400">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>;
}
