"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/auth/AuthContext";
import { listSolvedQuestions } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { formatDate } from "@/lib/utils";

export default function SolvedQuestionsPage() {
  const { user } = useAuth();
  const { data: solved, isLoading, error } = useDatabaseData(`solved:${user?.id ?? "anonymous"}`, listSolvedQuestions, []);
  return <AppShell title="Solved Questions"><div className="space-y-4">
    <div><h2 className="text-lg font-bold text-slate-900">Solved Questions</h2><p className="text-sm text-slate-500">Solved active question resources from PostgreSQL.</p></div>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><ul className="divide-y divide-slate-100" aria-busy={isLoading}>
      {solved.map((entry) => <li key={entry.id}><Link href={`/resources/${entry.resourceId}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
        <span className="flex items-center gap-3"><CheckCircle2 size={18} className="text-emerald-500" /><span><p className="text-sm font-medium text-slate-800">{entry.title}</p><p className="text-xs text-slate-400">{entry.courseCode} &gt; {entry.topicName}</p></span></span>
        <span className="text-xs text-slate-400">Solved {formatDate(entry.solvedAt.slice(0, 10))}</span>
      </Link></li>)}
      {!isLoading && solved.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No solved questions yet.</li>}
    </ul></div>
  </div></AppShell>;
}
