"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useData } from "@/lib/store/DataContext";
import { ResourceType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

type TabKey = "all" | ResourceType;

const typeTabs: ResourceType[] = ["Study Material", "Practice Material", "Tutorial", "Question"];

export default function AdminApprovalsPage() {
  return (
    <AppShell title="Approval Queue" allowedRoles={["admin"]}>
      <AdminApprovalsContent />
    </AppShell>
  );
}

function AdminApprovalsContent() {
  const { submissions, approveSubmission, rejectSubmission } = useData();
  const [tab, setTab] = useState<TabKey>("all");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const visible = useMemo(
    () => (tab === "all" ? submissions : submissions.filter((s) => s.resourceType === tab)),
    [submissions, tab]
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: `All (${submissions.length})` },
    ...typeTabs.map((t) => ({ key: t, label: `${t} (${submissions.filter((s) => s.resourceType === t).length})` })),
  ];

  function confirmReject(id: string) {
    if (!reason.trim()) return;
    rejectSubmission(id, reason.trim());
    setRejectingId(null);
    setReason("");
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Approval Queue</h2>
        <p className="text-sm text-slate-500">Review and take action on pending submissions.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Submitted By</th>
              <th className="px-4 py-3 font-medium">Course / Topic</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted At</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{s.title}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ResourceTypeIcon type={s.resourceType} size={14} />
                    {s.resourceType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{s.teacherName}</td>
                <td className="px-4 py-3 text-slate-500">
                  {s.courseCode} &gt; {s.topicName}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(s.submittedAt.slice(0, 10))}</td>
                <td className="px-4 py-3">
                  {s.status === "pending" ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => approveSubmission(s.id)}
                        title="Approve"
                        className="rounded-full bg-emerald-50 p-1.5 text-emerald-600 hover:bg-emerald-100"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setRejectingId(s.id)}
                        title="Reject"
                        className="rounded-full bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-right text-xs text-slate-400">
                      by {s.reviewedByName ?? "—"}
                    </p>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-slate-900">Reject submission</h3>
            <p className="mb-3 text-sm text-slate-500">Let the teacher know why, so they can resubmit correctly.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="e.g. Duplicate content, please revise..."
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setReason("");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmReject(rejectingId)}
                disabled={!reason.trim()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
