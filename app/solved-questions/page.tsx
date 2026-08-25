"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { initialSolvedQuestions } from "@/lib/data/activity";
import { getResourceById } from "@/lib/data/resources";
import { formatDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";

export default function SolvedQuestionsPage() {
  return (
    <AppShell title="Solved Questions">
      <SolvedQuestionsContent />
    </AppShell>
  );
}

function SolvedQuestionsContent() {
  const { user } = useAuth();
  const solved = initialSolvedQuestions
    .filter((s) => s.userId === user?.id)
    .map((s) => ({ ...s, resource: getResourceById(s.questionResourceId) }))
    .filter((s) => s.resource);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Solved Questions</h2>
        <p className="text-sm text-slate-500">Question-type resources you&apos;ve marked as solved.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {solved.map(({ resource, solvedAt }) => (
            <li key={resource!.id}>
              <Link href={`/resources/${resource!.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <span className="flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-500" />
                  <span>
                    <p className="text-sm font-medium text-slate-800">{resource!.title}</p>
                    <p className="text-xs text-slate-400">{resource!.courseId.toUpperCase()}</p>
                  </span>
                </span>
                <span className="text-xs text-slate-400">Solved {formatDate(solvedAt.slice(0, 10))}</span>
              </Link>
            </li>
          ))}
          {solved.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              No solved questions yet — open a Question resource and mark it solved.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
