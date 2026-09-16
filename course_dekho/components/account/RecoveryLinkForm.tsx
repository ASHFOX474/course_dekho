"use client";
import { useState, type FormEvent } from 'react';
import { issueRecovery } from '@/lib/client/workspace-api';

export function RecoveryLinkForm({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [expires, setExpires] = useState('');
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const password = String(new FormData(form).get('currentPassword'));
    setBusy(true); setError('');
    try {
      const result = await issueRecovery(userId, password);
      form.reset(); setLink(`${window.location.origin}/reset-password#token=${result.token}`);
      setExpires(new Date(result.expiresAt).toLocaleString());
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to issue recovery link.'); }
    finally { setBusy(false); }
  }
  return <section className="panel space-y-4 p-5" aria-label="Account recovery">
    <h3 className="font-semibold">Account recovery for {name}</h3>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    {link ? <><p role="status" className="text-sm">Recovery link created. Expires {expires}. It can only be used once.</p><label className="block text-sm">Share privately with the verified account owner<input readOnly value={link} onFocus={event => event.target.select()} className="mt-2 w-full rounded-lg border p-3 text-sm" /></label><p className="text-xs text-slate-500">The link is shown only here. Creating another invalidates this one.</p></> : <form onSubmit={submit} className="space-y-4">
      <label className="flex items-start gap-2 text-sm"><input required type="checkbox" className="mt-1" />I have independently verified this person owns the account.</label>
      <label className="block text-sm">Your admin password<input name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Creating...' : 'Create recovery link'}</button>
    </form>}
    <button disabled={busy} className="text-sm underline" onClick={onClose}>Close</button>
  </section>;
}
