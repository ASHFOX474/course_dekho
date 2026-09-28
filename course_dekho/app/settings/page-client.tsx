'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Moon, Sun } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDisplayPreference, updateDisplayPreference } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { PasswordForm } from '@/components/account/PasswordForm';

export default function SettingsPage() {
  const { user } = useAuth();
  return <AppShell title="Settings">{user && <><ThemePreference userId={user.id} /><section className="panel mx-auto mt-6 max-w-2xl p-6"><h2 className="mb-4 text-lg font-semibold">Change password</h2><PasswordForm /></section></>}</AppShell>;
}

function ThemePreference({ userId }: { userId: string }) {
  const preference = useDatabaseData(`settings-display-preference:${userId}`, getDisplayPreference, { theme: "light" as const });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (preference.isLoading || preference.error) return;
    document.documentElement.dataset.theme = preference.data.theme;
  }, [preference.data.theme, preference.error, preference.isLoading]);

  async function save(theme: "light" | "dark") {
    setSaving(true); setMessage("");
    try {
      const saved = await updateDisplayPreference(theme);
      preference.setData(saved);
      setMessage("Theme saved for your account.");
    } catch (requestError) {
      setMessage(requestError instanceof Error ? requestError.message : "Unable to save your theme.");
    } finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-2xl space-y-6"><div><p className="page-kicker mb-2">Make it yours</p><h2 className="page-title">Workspace preferences</h2><p className="mt-3 text-sm text-slate-500">Your theme follows your account across sign-ins.</p></div><section className="panel"><div className="panel-heading"><h3>Mode / Theme</h3></div><div className="grid gap-3 p-6 sm:grid-cols-2">{([['light', Sun, 'Light'], ['dark', Moon, 'Dark']] as const).map(([theme, Icon, label]) => <button key={theme} type="button" disabled={saving || preference.isLoading} aria-pressed={preference.data.theme === theme} onClick={() => void save(theme)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${preference.data.theme === theme ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-700 hover:border-violet-300'}`}><Icon size={20} /><span><span className="block text-sm font-semibold">{label}</span><span className="text-xs opacity-70">Use the {label.toLowerCase()} authenticated workspace.</span></span></button>)}</div></section>{(preference.error || message) && <p role={preference.error ? "alert" : "status"} className="text-sm text-slate-600">{preference.error ?? message}</p>}<Link href="/profile" className="panel flex items-center justify-between p-6"><span><span className="block text-sm font-semibold">Account details</span><span className="mt-1 block text-xs text-slate-500">View your profile and university information.</span></span><ArrowUpRight size={18} /></Link></div>;
}
