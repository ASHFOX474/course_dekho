"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SupportConversation } from '@/components/support/SupportConversation';
export default function PublicRequestPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    const timer = window.setTimeout(() => { setToken(value); window.history.replaceState(null, '', window.location.pathname); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-10"><h1 className="text-2xl font-bold">Your recovery conversation</h1><p className="text-sm text-slate-600">Check this private conversation for admin replies. We do not send email notifications.</p>{token === null ? <p>Loading...</p> : /^[A-Za-z0-9_-]{43}$/.test(token) ? <><label className="block text-sm">Save this private link to return later<input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/support/request/${requestId}#token=${token}`} onFocus={event => event.target.select()} className="mt-1 w-full rounded-lg border p-3" /></label><SupportConversation id={requestId} token={token} /></> : <p role="alert">Open the full private tracking link you saved when submitting your request.</p>}<Link href="/login" className="text-indigo-700 underline">Back to login</Link></main>;
}
