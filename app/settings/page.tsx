"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";

const initialToggles = [
  { key: "email", label: "Email me about approval decisions", enabled: true },
  { key: "digest", label: "Weekly progress digest", enabled: true },
  { key: "newContent", label: "Notify me about new resources in my courses", enabled: false },
];

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <SettingsContent />
    </AppShell>
  );
}

function SettingsContent() {
  const [toggles, setToggles] = useState(initialToggles);

  function toggle(key: string) {
    setToggles((prev) => prev.map((t) => (t.key === key ? { ...t, enabled: !t.enabled } : t)));
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Notification Preferences</h3>
        <ul className="space-y-4">
          {toggles.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-700">{t.label}</span>
              <button
                onClick={() => toggle(t.key)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  t.enabled ? "bg-violet-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    t.enabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-xs text-slate-400">
        These toggles are local to this session — nothing is persisted without a real backend.
      </p>
    </div>
  );
}
