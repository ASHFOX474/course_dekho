"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { approveEnrollment, listEnrollmentRequests, rejectEnrollment } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";

export default function EnrollmentRequestsPage() {
  const requests = useDatabaseData("admin-enrollment-requests", listEnrollmentRequests, []);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function approve(id: string) {
    setBusyId(id); setError("");
    try { await approveEnrollment(id); requests.refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to approve this request."); }
    finally { setBusyId(null); }
  }

  async function reject(id: string) {
    if (!reason.trim()) { setError("Enter a rejection reason."); return; }
    setBusyId(id); setError("");
    try { await rejectEnrollment(id, reason.trim()); setRejectingId(null); setReason(""); requests.refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to reject this request."); }
    finally { setBusyId(null); }
  }

  return <AppShell title="Enrollment requests" allowedRoles={["admin"]}>
    <div className="space-y-5">
      <div><p className="page-kicker mb-2">Learner access</p><h2 className="page-title">Enrollment requests</h2><p className="mt-2 text-sm text-slate-500">Approve course access or reject it with a reason.</p></div>
      {(requests.error || error) && <p role="alert" className="text-sm text-rose-600">{error || requests.error}</p>}
      <div className="space-y-3" aria-busy={requests.isLoading}>
        {requests.data.map(request => <article key={request.id} className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="font-semibold text-slate-900">{request.user.name}</p><p className="text-xs text-slate-500">{request.userEmail}</p><p className="mt-2 text-sm text-slate-700">{request.courseCode} · {request.courseName}</p><p className="mt-1 text-xs capitalize text-slate-400">{request.status} · {new Date(request.requestedAt).toLocaleString()}</p>{request.rejectionReason && <p className="mt-2 text-sm text-rose-700">Reason: {request.rejectionReason}</p>}</div>
            {request.status === "pending" && <div className="flex gap-2"><button type="button" disabled={busyId === request.id} onClick={() => void approve(request.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Check size={16} />Approve</button><button type="button" disabled={busyId === request.id} onClick={() => { setRejectingId(request.id); setReason(""); setError(""); }} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"><X size={16} />Reject</button></div>}
          </div>
          {rejectingId === request.id && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4"><label className="block text-sm font-medium text-rose-900">Rejection reason<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-slate-900" /></label><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setRejectingId(null)} className="px-3 py-2 text-sm">Cancel</button><button type="button" disabled={busyId === request.id} onClick={() => void reject(request.id)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Confirm rejection</button></div></div>}
        </article>)}
        {!requests.isLoading && requests.data.length === 0 && <p className="panel p-8 text-center text-sm text-slate-500">No enrollment requests yet.</p>}
      </div>
    </div>
  </AppShell>;
}
