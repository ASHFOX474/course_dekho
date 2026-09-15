"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Paperclip } from "lucide-react";

import { Attachment } from "@/components/ui/Attachment";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { listCourses, listCourseTopics, resourceTypeLabel, type CourseSummaryDto, type TopicSummaryDto } from "@/lib/client/catalog-api";
import { createSubmission, listOwnSubmissions } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import type { ResourceType, SubmissionStatus } from "@/lib/server/domain/models";
import { formatDate } from "@/lib/utils";

const resourceTypes: ResourceType[] = ["study_material", "practice_material", "book", "tutorial", "slide", "question", "leetcode_problem"];
type TabKey = "all" | SubmissionStatus;

export default function ContributorSubmissionsPage() {
  const { user } = useAuth();
  const { data: submissions, setData: setSubmissions, isLoading, error, refresh } = useDatabaseData(`submissions:${user?.id ?? "anonymous"}`, listOwnSubmissions, []);
  const [tab, setTab] = useState<TabKey>("all");
  const [showForm, setShowForm] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const visible = useMemo(() => tab === "all" ? submissions : submissions.filter((submission) => submission.status === tab), [submissions, tab]);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: `All (${submissions.length})` },
    ...(["pending", "approved", "rejected"] as SubmissionStatus[]).map((status) => ({ key: status, label: `${status[0].toUpperCase() + status.slice(1)} (${submissions.filter((submission) => submission.status === status).length})` })),
  ];

  async function submit(input: Parameters<typeof createSubmission>[0]) {
    setMutationError(null);
    try {
      const created = await createSubmission(input);
      setSubmissions((current) => [created, ...current]);
      setShowForm(false);
      refresh();
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to create submission.");
      throw requestError;
    }
  }

  return <AppShell title="My Submissions" allowedRoles={["contributor"]}><div className="space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">My Submissions</h2><p className="text-sm text-slate-500">Live contributor submission records.</p></div><button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white"><Plus size={15} />New Submission</button></div>
    {(error || mutationError) && <p role="alert" className="text-sm text-rose-600">{mutationError ?? error}</p>}
    <div className="flex gap-2 border-b border-slate-200">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === item.key ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500"}`}>{item.label}</button>)}</div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full text-left text-sm" aria-busy={isLoading}><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Topic / Course</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Submitted</th></tr></thead><tbody className="divide-y divide-slate-100">
      {visible.map((submission) => <tr key={submission.id}><td className="px-4 py-3"><p className="font-medium text-slate-800">{submission.title}</p><Attachment id={submission.id} kind="submissions" />{submission.rejectionReason && <p className="text-xs text-rose-500">Reason: {submission.rejectionReason}</p>}</td><td className="px-4 py-3"><span className="flex items-center gap-2"><ResourceTypeIcon type={resourceTypeLabel(submission.resourceType)} size={14} />{resourceTypeLabel(submission.resourceType)}</span></td><td className="px-4 py-3 text-slate-500">{submission.courseCode} &gt; {submission.topicName}</td><td className="px-4 py-3"><StatusBadge status={submission.status} /></td><td className="px-4 py-3 text-slate-500">{formatDate(submission.submittedAt.slice(0, 10))}</td></tr>)}
      {!isLoading && visible.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nothing here yet.</td></tr>}
    </tbody></table></div>
    {showForm && <NewSubmissionModal onClose={() => setShowForm(false)} onSubmit={submit} />}
  </div></AppShell>;
}

function NewSubmissionModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (input: Parameters<typeof createSubmission>[0]) => Promise<void> }) {
  const [courses, setCourses] = useState<CourseSummaryDto[]>([]);
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("study_material");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [file, setFile] = useState<File>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCourses({}, controller.signal).then((rows) => { setCourses(rows); setCourseId(rows[0]?.id ?? ""); }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    listCourseTopics(courseId, controller.signal).then((rows) => { setTopics(rows); setTopicId(rows[0]?.id ?? ""); }).catch(() => undefined);
    return () => controller.abort();
  }, [courseId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!courseId || !topicId || !title.trim() || !description.trim()) return;
    setFormError(null);
    setIsSubmitting(true);
    try { 
      await onSubmit({ 
        resourceType, 
        title: title.trim(), 
        description: description.trim(), 
        courseId, 
        topicId,
        externalUrl: externalUrl.trim() || undefined,
        file
      }); 
    }
    catch (error) { setFormError(error instanceof Error ? error.message : "Unable to submit. Please try again."); }
    finally { setIsSubmitting(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex justify-between"><h3 className="font-semibold">New Submission</h3><button disabled={isSubmitting} onClick={onClose} aria-label="Close submission form"><X size={18} /></button></div><form onSubmit={handleSubmit} className="space-y-3">
    <Field label="Course"><select value={courseId} onChange={(event) => { const value = event.target.value; setCourseId(value); if (!value) { setTopics([]); setTopicId(""); } }} required className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</select></Field>
    <Field label="Topic"><select value={topicId} onChange={(event) => setTopicId(event.target.value)} required className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Select topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></Field>
    <Field label="Resource Type"><select value={resourceType} onChange={(event) => setResourceType(event.target.value as ResourceType)} className="w-full rounded-lg border px-3 py-2 text-sm">{resourceTypes.map((type) => <option key={type} value={type}>{resourceTypeLabel(type)}</option>)}</select></Field>
    <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={5000} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 p-3">
      <input ref={fileInput} type="file" className="sr-only" aria-label="Choose attachment" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip" disabled={isSubmitting} onChange={(event) => {
        const selected = event.target.files?.[0];
        if (selected && (selected.size === 0 || selected.size > 20 * 1024 * 1024)) { setFormError("Choose a non-empty file up to 20 MB."); event.target.value = ""; return; }
        setFormError(null); setFile(selected);
      }} />
      <button type="button" disabled={isSubmitting} onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-violet-700"><Plus size={18} />{file ? "Change attachment" : "Attach file"}</button>
      {file && <div className="mt-2 flex items-center gap-2 text-sm"><Paperclip size={16} /><span className="min-w-0 flex-1 break-all">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" disabled={isSubmitting} aria-label="Remove attachment" onClick={() => { setFile(undefined); if (fileInput.current) fileInput.current.value = ""; }}><X size={16} /></button></div>}
      <p className="mt-2 text-xs text-slate-500">PDF, images, Office documents, TXT, CSV or ZIP. One file, up to 20 MB.</p>
    </div>
    <Field label="External URL (Google Drive, GitHub, etc.)"><input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://drive.google.com/... or https://github.com/..." maxLength={2000} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <p className="text-xs text-slate-500">For Drive links, give your intended learners permission to open the file.</p>
    {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
    <p className="text-xs text-slate-400">This row starts pending and remains invisible until an admin approves it.</p><button disabled={isSubmitting || !courseId || !topicId} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{isSubmitting ? "Submitting..." : "Submit for Review"}</button>
  </form></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>{children}</div>; }
