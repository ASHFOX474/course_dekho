"use client";
import { useState } from "react";
import Link from "next/link";
import { SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { usePreferences } from "@/lib/client/preferences";
import { PasswordForm } from '@/components/account/PasswordForm';
export default function SettingsPage() {
  const { user } = useAuth();
  return <AppShell title="Settings">{user && <><Preferences userId={user.id} /><section className="panel mx-auto mt-6 max-w-2xl p-6"><h2 className="mb-4 text-lg font-semibold">Change password</h2><PasswordForm /></section></>}</AppShell>;
}
function Preferences({ userId }: { userId: string }) {
  const { preferences, update } = usePreferences(userId);
  const [message, setMessage] = useState("");
  function save(next: typeof preferences) { try { update(next); setMessage("Preferences saved in this browser."); } catch { setMessage("Your browser could not save preferences. Check its storage settings."); } }
  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="page-kicker mb-2">Make it yours</p><h2 className="page-title">Workspace preferences</h2><p className="mt-3 text-sm text-slate-500">These settings apply to your account in this browser.</p></div><section className="panel"><div className="panel-heading"><h3>Display & accessibility</h3><SlidersHorizontal size={18} className="text-slate-400" /></div><div className="divide-y divide-slate-100 px-6">{([{ key: "compact", label: "Compact workspace", description: "Reduce page spacing and table row height." }, { key: "reduceMotion", label: "Reduce motion", description: "Turn off interface animations and transitions." }] as const).map(item => <label key={item.key} className="flex cursor-pointer items-center justify-between gap-5 py-6"><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.description}</span></span><input type="checkbox" role="switch" checked={preferences[item.key]} onChange={event => save({ ...preferences, [item.key]: event.target.checked })} className="h-5 w-5 accent-slate-700" /></label>)}</div><div className="border-t border-slate-100 px-6 py-4"><button onClick={() => save({ compact: false, reduceMotion: false })} className="text-xs font-semibold text-slate-600 underline">Restore defaults</button></div></section>{message && <p role="status" className="text-sm text-slate-600">{message}</p>}<Link href="/profile" className="panel flex items-center justify-between p-6"><span><span className="block text-sm font-semibold">Account details</span><span className="mt-1 block text-xs text-slate-500">View your profile and university information.</span></span><ArrowUpRight size={18} /></Link></div>;
}
