"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { getUniversityById } from "@/lib/data/academics";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";

export default function ProfilePage() {
  return (
    <AppShell title="Profile">
      <ProfileContent />
    </AppShell>
  );
}

function ProfileContent() {
  const { user } = useAuth();
  if (!user) return null;

  const university = user.universityId ? getUniversityById(user.universityId) : undefined;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-xl font-bold text-white">
            {user.avatarInitials}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{user.name}</p>
            <Badge tone="purple">{user.role[0].toUpperCase() + user.role.slice(1)}</Badge>
          </div>
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Username" value={user.username} />
          <Row label="Email" value={user.email} />
          {university && <Row label="University" value={university.name} />}
          {user.department && <Row label="Department" value={user.department} />}
          {user.yearOfStudy && <Row label="Year of Study" value={user.yearOfStudy} />}
          {user.designation && <Row label="Designation" value={user.designation} />}
        </dl>
      </div>

      <p className="text-center text-xs text-slate-400">
        Profile editing isn&apos;t wired up in this demo — it would PATCH the User table in the real backend.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
