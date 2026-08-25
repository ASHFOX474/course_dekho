"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { initialAccessHistory } from "@/lib/data/activity";
import { formatRelativeTime } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

export default function AccessHistoryPage() {
  return (
    <AppShell title="Access History">
      <AccessHistoryContent />
    </AppShell>
  );
}

function AccessHistoryContent() {
  const { user } = useAuth();
  const entries = initialAccessHistory
    .filter((a) => a.userId === user?.id)
    .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Access History</h2>
        <p className="text-sm text-slate-500">Everything you&apos;ve opened, most recent first.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link href={`/resources/${entry.resourceId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="flex min-w-0 items-center gap-3">
                  <ResourceTypeIcon type={entry.resourceType} />
                  <span className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{entry.resourceTitle}</p>
                    <p className="text-xs text-slate-400">
                      {entry.courseCode} &gt; {entry.topicName}
                    </p>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(entry.accessedAt)}</span>
              </Link>
            </li>
          ))}
          {entries.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</li>}
        </ul>
      </div>
    </div>
  );
}
