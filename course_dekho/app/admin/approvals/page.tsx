"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import { Attachment } from "@/components/ui/Attachment";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { resourceTypeLabel } from "@/lib/client/catalog-api";
import { approveSubmission, listSubmissionsForReview, rejectSubmission, type SubmissionDto } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import type { ResourceType } from "@/lib/server/domain/models";
import { formatDate } from "@/lib/utils";

type TabKey = "all" | ResourceType;
const typeTabs: ResourceType[] = ["study_material", "practice_material", "book", "tutorial", "slide", "question", "leetcode_problem"];

export default function AdminApprovalsPage() {
  const { user } = useAuth();
  const { data: submissions, setData: setSubmissions, isLoading, error, refresh } = useDatabaseData(`admin-submissions:${user?.id ?? "anonymous"}`, listSubmissionsForReview, []);
  const [tab, setTab] = useState<TabKey>("all");
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const visible = useMemo(() => submissions.filter(row => (tab === "all" || row.resourceType === tab) && (status === "all" || row.status === status) && `${row.title} ${row.contributor.name} ${row.courseCode}`.toLowerCase().includes(search.toLowerCase())), [submissions, tab, status, search]);
  const tabs = [{ key: "all" as const, label: `All (${submissions.length})` }, ...typeTabs.map((type) => ({ key: type, label: `${resourceTypeLabel(type)} (${submissions.filter((submission) => submission.resourceType === type).length})` }))];

  function replace(updated: SubmissionDto) {
    setSubmissions((current) => current.map((submission) => submission.id === updated.id ? updated : submission));
    refresh();
  }
  async function approve(id: string) {
    setWorkingId(id); setMutationError(null);
    try { replace(await approveSubmission(id)); }
    catch (requestError) { setMutationError(requestError instanceof Error ? requestError.message : "Unable to approve."); }
    finally { setWorkingId(null); }
  }
  async function reject(id: string) {
    if (!reason.trim()) return;
    setWorkingId(id); setMutationError(null);
    try { replace(await rejectSubmission(id, reason.trim())); setRejectingId(null); setReason(""); }
    catch (requestError) { setMutationError(requestError instanceof Error ? requestError.message : "Unable to reject."); }
    finally { setWorkingId(null); }
  }

  return <AppShell title="Material Approvals" allowedRoles={["admin"]}><div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="page-kicker mb-2">Moderation / Content</p><h2 className="page-title">Content review</h2><p className="mt-2 text-sm text-slate-500">Inspect materials and placement before making a publication decision.</p></div><button onClick={refresh} className="action-secondary">Refresh queue</button></div>
    <div className="grid grid-cols-3 gap-3">{["pending", "approved", "rejected"].map(value => <button key={value} onClick={() => setStatus(value)} className={`rounded-lg border bg-white p-4 text-left ${status === value ? "border-slate-600 ring-1 ring-slate-600" : "border-slate-200"}`}><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{value}</span><strong className="mt-2 block text-2xl">{submissions.filter(row => row.status === value).length}</strong></button>)}</div>
    <div className="flex flex-wrap gap-3"><input aria-label="Search submissions" placeholder="Search title, contributor or course?" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm" /><select aria-label="Review status" value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 text-xs"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
    {(error || mutationError) && <p role="alert" className="text-sm text-rose-600">{mutationError ?? error}</p>}
    <div className="flex flex-wrap gap-2 border-b">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`border-b-2 px-3 py-2 text-sm ${tab === item.key ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500"}`}>{item.label}</button>)}</div>
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full text-left text-sm" aria-busy={isLoading}><thead className="bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Contributor</th><th className="px-4 py-3">Course / Topic</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">
      {visible.map((submission) => <tr key={submission.id}><td className="px-4 py-3 font-medium">{submission.title}<p className="mt-1 max-w-xs text-xs font-normal leading-5 text-slate-500">{submission.description}</p>{submission.rejectionReason && <p className="mt-2 text-xs text-rose-600">{submission.rejectionReason}</p>}<Attachment id={submission.id} kind="submissions" /></td><td className="px-4 py-3"><span className="flex items-center gap-2"><ResourceTypeIcon type={resourceTypeLabel(submission.resourceType)} size={14} />{resourceTypeLabel(submission.resourceType)}</span></td><td className="px-4 py-3 text-slate-500">{submission.contributor.name}</td><td className="px-4 py-3 text-slate-500">{submission.courseCode} &gt; {submission.topicName}</td><td className="px-4 py-3"><StatusBadge status={submission.status} /></td><td className="px-4 py-3 text-slate-500">{formatDate(submission.submittedAt.slice(0, 10))}</td><td className="px-4 py-3">{submission.status === "pending" ? <div className="flex justify-end gap-2"><button disabled={workingId === submission.id} onClick={() => void approve(submission.id)} title="Approve" className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40"><Check size={14} />Approve</button><button disabled={workingId === submission.id} onClick={() => setRejectingId(submission.id)} title="Reject" className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2.5 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40"><X size={14} />Reject</button></div> : <p className="text-right text-xs text-slate-400">by {submission.reviewedBy?.name ?? "—"}</p>}</td></tr>)}
      {!isLoading && visible.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nothing here.</td></tr>}
    </tbody></table></div>
    {rejectingId && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"><h3 className="font-semibold">Reject submission</h3><p className="mb-3 text-sm text-slate-500">Explain what needs to change. The contributor will see this feedback.</p><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} autoFocus className="mb-3 w-full rounded-lg border px-3 py-2 text-sm" /><div className="flex justify-end gap-2"><button onClick={() => { setRejectingId(null); setReason(""); }} className="px-3 py-2 text-sm">Cancel</button><button onClick={() => void reject(rejectingId)} disabled={!reason.trim() || workingId === rejectingId} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Reject</button></div></div></div>}
  </div></AppShell>;
}
