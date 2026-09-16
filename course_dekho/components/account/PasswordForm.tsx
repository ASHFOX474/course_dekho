"use client";
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { changePassword, resetPassword } from '@/lib/client/workspace-api';

export function PasswordForm({ token }: { token?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get('newPassword'));
    if (password !== values.get('confirmPassword')) { setError('The new passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      if (token !== undefined) await resetPassword(token, password);
      else await changePassword(String(values.get('currentPassword')), password);
      form.reset(); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update your password.'); }
    finally { setBusy(false); }
  }
  if (done) return <div role="status" className="space-y-3"><p>Your password has been updated. Existing sessions have been signed out.</p><a href="/login" className="font-semibold text-indigo-700 underline">Sign in with your new password</a></div>;
  return <form onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <fieldset disabled={busy} className="space-y-4">
      {token === undefined && <label className="block text-sm font-medium">Current password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>}
      <label className="block text-sm font-medium">New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <label className="block text-sm font-medium">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <p className="text-xs text-slate-500">Use 12–128 characters. Saving signs you out on all devices.</p>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Saving...' : 'Update password'}</button>
    </fieldset>
    {token === undefined && <Link href="/forgot-password" className="block text-sm text-indigo-700 underline">Forgot your password?</Link>}
  </form>;
}
