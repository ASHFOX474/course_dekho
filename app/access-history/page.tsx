"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { resourceTypeLabel } from "@/lib/client/catalog-api";
import { listAccessHistory } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { formatRelativeTime } from "@/lib/utils";

export default function AccessHistoryPage() {
  const { user } = useAuth();
  const { data: entries, isLoading, error } = useDatabaseData(`access:${user?.id ?? "anonymous"}`, listAccessHistory, []);
  return <AppShell title="Access History"><div className="space-y-4">
    <div><h2 className="text-lg font-bold text-slate-900">Access History</h2><p className="text-sm text-slate-500">PostgreSQL access events, most recent first.</p></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><ul className="divide-y divide-slate-100" aria-busy={isLoading}>
      {entries.map((entry) => <li key={entry.id}><Link href={`/resources/${entry.resourceId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <span className="flex min-w-0 items-center gap-3"><ResourceTypeIcon type={resourceTypeLabel(entry.resourceType)} /><span className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{entry.resourceTitle}</p><p className="text-xs text-slate-400">{entry.courseCode} &gt; {entry.topicName}</p></span></span>
        <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(entry.accessedAt)}</span>
      </Link></li>)}
      {!isLoading && entries.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</li>}
    </ul></div>
  </div></AppShell>;
}
