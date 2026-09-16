"use client";
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { requestRecovery } from '@/lib/client/support-api';
export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const result = await requestRecovery({ name: String(form.get('name')), email: String(form.get('email')), identifier: String(form.get('identifier')), message: String(form.get('message')) });
      setTrackingUrl(`${window.location.origin}/support/request/${result.id}#token=${result.accessToken}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your request.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto my-10 max-w-lg space-y-5 rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold">Ask the admin for account help</h1>{trackingUrl ? <section className="space-y-4"><p role="status" className="text-emerald-700">Your request has been sent to the admin.</p><p className="text-sm">Save this private link to read replies and send follow-up messages without logging in. No email notification is sent.</p><label className="block text-sm">Private tracking link<input readOnly value={trackingUrl} onFocus={event => event.target.select()} className="mt-1 w-full rounded-lg border p-3" /></label><a href={trackingUrl} className="inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Open conversation</a></section> : <><p className="text-sm text-slate-600">Forgot your password or cannot sign in? Send a message here. The admin will reply in a private conversation and verify account ownership before arranging recovery.</p>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}<form onSubmit={submit}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm">Your name<input name="name" autoComplete="name" required maxLength={200} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">Contact email<input name="email" type="email" autoComplete="email" required maxLength={254} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">Account username or registered email<input name="identifier" autoComplete="username" required maxLength={254} className="mt-1 w-full rounded-lg border p-2" /></label><label className="block text-sm">How can we help?<textarea name="message" required maxLength={4000} rows={5} className="mt-1 w-full rounded-lg border p-3" placeholder="Describe the sign-in problem. Never include your password." /></label><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Sending...' : 'Send recovery request'}</button></fieldset></form></>}<Link href="/login" className="inline-block text-sm font-semibold text-indigo-700 underline">Back to sign in</Link></main>;
}
