'use client';

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import { getProfile } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { useState, type FormEvent } from 'react';
import { updateProfile } from '@/lib/client/workspace-api';
import type { UserProfileDto } from '@/lib/server/api/dtos';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { data: profile, isLoading, error, refresh } = useDatabaseData(
    `profile:${user?.id ?? "anonymous"}`,
    getProfile,
    null
  );
  return (
    <AppShell title="Profile">
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading your profile...</p>
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
          <p className="mt-5 text-center text-xs text-slate-400">Your account and academic information.</p>
          <ProfileEditor key={profile.user.id} profile={profile} onSaved={async () => { await refreshUser(); refresh(); }} />
        </div>
      )}
    </AppShell>
  );
}

function ProfileEditor({ profile, onSaved }: { profile: UserProfileDto; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const role = profile.user.role;
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      await updateProfile({ name: String(form.get('name')), ...(role !== 'admin' ? { department: String(form.get('department') ?? '') } : {}), ...(role === 'learner' ? { yearOfStudy: form.get('yearOfStudy') ? Number(form.get('yearOfStudy')) : null } : {}), ...(role === 'contributor' ? { designation: String(form.get('designation') ?? '') } : {}) });
      setEditing(false); setMessage('Profile saved.'); await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save profile.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 border-t border-slate-100 pt-5">
    {message && <p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="mb-3 text-sm text-rose-600">{error}</p>}
    {!editing ? <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" onClick={() => { setEditing(true); setMessage(''); }}>Edit profile</button> : <form onSubmit={submit}>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm">Name<input name="name" required maxLength={200} defaultValue={profile.user.name} className={inputClass} autoComplete="name" /></label>
        {role !== 'admin' && <label className="block text-sm">Department<input name="department" maxLength={100} defaultValue={profile.department ?? ''} className={inputClass} /></label>}
        {role === 'learner' && <label className="block text-sm">Year of study<select name="yearOfStudy" defaultValue={profile.yearOfStudy ?? ''} className={inputClass}><option value="">Not specified</option>{[1, 2, 3, 4, 5, 6].map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
        {role === 'contributor' && <label className="block text-sm">Designation<input name="designation" maxLength={100} defaultValue={profile.designation ?? ''} className={inputClass} /></label>}
        <div className="flex gap-3"><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white" type="submit">{busy ? 'Saving...' : 'Save profile'}</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
      </fieldset>
    </form>}
  </section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-50 pb-2"><dt className="text-slate-400">{label}</dt><dd className="text-right font-medium text-slate-800">{value}</dd></div>;
}
