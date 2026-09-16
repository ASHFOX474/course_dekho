"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PasswordForm } from '@/components/account/PasswordForm';
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    // Fragment tokens are not sent in HTTP requests, referrers, or server logs.
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    const timer = window.setTimeout(() => { setToken(value); window.history.replaceState(null, '', window.location.pathname); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <main className="mx-auto my-16 max-w-lg space-y-5 rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold">Choose a new password</h1>{token === null ? <p>Loading recovery link...</p> : /^[A-Za-z0-9_-]{43}$/.test(token) ? <PasswordForm token={token} /> : <><p>This recovery link is missing or invalid. Ask your administrator for a new link.</p><Link href="/forgot-password" className="text-indigo-700 underline">Recovery help</Link></>}</main>;
}
