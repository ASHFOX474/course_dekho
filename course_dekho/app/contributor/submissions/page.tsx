"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Paperclip } from "lucide-react";

import { Attachment } from "@/components/ui/Attachment";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { listCourses, listCourseTopics, resourceTypeLabel, type CourseSummaryDto, type TopicSummaryDto } from "@/lib/client/catalog-api";
import { createSubmission, listOwnSubmissions, type SubmissionDto } from "@/lib/client/workspace-api";
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
  const [revision, setRevision] = useState<SubmissionDto | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const visible = useMemo(() => tab === "all" ? submissions : submissions.filter((submission) => submission.status === tab), [submissions, tab]);
  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: `All (${submissions.length})` },
    ...(["pending", "approved", "rejected"] as SubmissionStatus[]).map((status) => ({ key: status, label: `${status[0].toUpperCase() + status.slice(1)} (${submissions.filter((submission) => submission.status === status).length})` })),
  ];

  async function submit(input: Parameters<typeof createSubmission>[0], onProgress?: (percent: number) => void) {
    setMutationError(null);
    try {
      const created = await createSubmission(input, onProgress);
      setSubmissions((current) => [created, ...current]);
      setShowForm(false);
      setTab("pending");
      setSuccess("Submitted successfully. Your material is awaiting admin review.");
      refresh();
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to create submission.");
      throw requestError;
    }
  }

  return <AppShell title="My Submissions" allowedRoles={["contributor"]}><div className="space-y-4">
    <div className="flex items-center justify-between"><div><p className="page-kicker mb-2">Contributor studio / Publishing desk</p><h2 className="page-title">My submissions</h2><p className="text-sm text-slate-500">Your materials, review feedback, and publishing history.</p></div><button onClick={() => { setRevision(null); setSuccess(null); setMutationError(null); setShowForm(true); }} className="flex items-center gap-1.5 rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-white"><Plus size={15} />New Submission</button></div>
    {success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}
    {(error || mutationError) && <p role="alert" className="text-sm text-rose-600">{mutationError ?? error}</p>}
    <div className="flex gap-2 border-b border-slate-200">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`border-b-2 px-3 py-2 text-sm font-medium ${tab === item.key ? "border-emerald-800 text-emerald-800" : "border-transparent text-slate-500"}`}>{item.label}</button>)}</div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy={isLoading}>
      {visible.map(submission => <article key={submission.id} className="panel flex flex-col p-5"><div className="mb-5 flex items-center justify-between"><span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"><ResourceTypeIcon type={resourceTypeLabel(submission.resourceType)} size={16} />{resourceTypeLabel(submission.resourceType)}</span><StatusBadge status={submission.status} /></div><h3 className="text-base font-semibold">{submission.title}</h3><p className="mt-2 text-xs text-slate-400">{submission.courseCode} / {submission.topicName}</p><p className="my-4 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">{submission.description}</p><Attachment id={submission.id} kind="submissions" />{submission.rejectionReason && <div className="mt-4 rounded-lg border border-rose-100 bg-rose-50 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-500">Reviewer feedback</p><p className="text-xs leading-5 text-rose-800">{submission.rejectionReason}</p></div>}<div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-[10px] text-slate-400">Submitted {formatDate(submission.submittedAt.slice(0, 10))}</span>{submission.status === "rejected" && <button className="text-xs font-semibold text-emerald-800 underline" onClick={() => { setRevision(submission); setSuccess(null); setMutationError(null); setShowForm(true); }}>Revise and resubmit</button>}</div></article>)}
      {isLoading && <p className="col-span-full py-10 text-center text-sm text-slate-400">Loading submissions?</p>}
      {!isLoading && visible.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-emerald-900/20 p-12 text-center"><p className="text-base font-semibold">A new page for your knowledge</p><p className="mt-2 text-sm text-slate-500">No submissions in this view. Use New Submission to share a resource.</p></div>}
    </div>

    {showForm && <NewSubmissionModal initial={revision} onClose={() => setShowForm(false)} onSubmit={submit} />}
  </div></AppShell>;
}

function NewSubmissionModal({ initial, onClose, onSubmit }: { initial: SubmissionDto | null; onClose: () => void; onSubmit: (input: Parameters<typeof createSubmission>[0], onProgress?: (percent: number) => void) => Promise<void> }) {
  const [courses, setCourses] = useState<CourseSummaryDto[]>([]);
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [courseId, setCourseId] = useState(initial?.courseId ?? "");
  const [topicId, setTopicId] = useState(initial?.topicId ?? "");
  const [resourceType, setResourceType] = useState<ResourceType>(initial?.resourceType ?? "study_material");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [externalUrl, setExternalUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const submitting = useRef(false);
  const [file, setFile] = useState<File>();
  const fileInput = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listCourses({}, controller.signal).then((rows) => { setCourses(rows); setCourseId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? ""); }).catch(() => { if (!controller.signal.aborted) setFormError("Unable to load courses or topics. Close the form and try again."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!courseId) return;
    const controller = new AbortController();
    listCourseTopics(courseId, controller.signal).then((rows) => { setTopics(rows); setTopicId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? ""); }).catch(() => { if (!controller.signal.aborted) setFormError("Unable to load courses or topics. Close the form and try again."); });
    return () => controller.abort();
  }, [courseId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !courseId || !topicId || !title.trim() || !description.trim()) return;
    submitting.current = true;
    setUploadProgress(0);
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
      }, setUploadProgress);
    }
    catch (error) { setFormError(error instanceof Error ? error.message : "Unable to submit. Please try again."); }
    finally { submitting.current = false; setIsSubmitting(false); }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="max-h-[90vh] overflow-y-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex justify-between"><h3 className="font-semibold">{initial ? "Revise and resubmit" : "New Submission"}</h3><button disabled={isSubmitting} onClick={onClose} aria-label="Close submission form"><X size={18} /></button></div><form onSubmit={handleSubmit}><fieldset disabled={isSubmitting} className="space-y-3">
    {initial && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Previous rejection: {initial.rejectionReason}. Update the details and attach the revised file or paste its link. This creates a new submission and keeps your original review history.</p>}
    <Field label="Course"><select value={courseId} onChange={(event) => { const value = event.target.value; setCourseId(value); setTopics([]); setTopicId(""); }} required className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Select course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name}</option>)}</select></Field>
    <Field label="Topic"><select value={topicId} onChange={(event) => setTopicId(event.target.value)} required className="w-full rounded-lg border px-3 py-2 text-sm"><option value="">Select topic</option>{topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></Field>
    <Field label="Resource Type"><select value={resourceType} onChange={(event) => setResourceType(event.target.value as ResourceType)} className="w-full rounded-lg border px-3 py-2 text-sm">{resourceTypes.map((type) => <option key={type} value={type}>{resourceTypeLabel(type)}</option>)}</select></Field>
    <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={5000} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-3">
      <input ref={fileInput} type="file" className="sr-only" aria-label="Choose attachment" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip" disabled={isSubmitting} onChange={(event) => {
        const selected = event.target.files?.[0];
        if (selected && (selected.size === 0 || selected.size > 20 * 1024 * 1024)) { setFormError("Choose a non-empty file up to 20 MB."); event.target.value = ""; return; }
        setFormError(null); setFile(selected);
      }} />
      <button type="button" disabled={isSubmitting} onClick={() => fileInput.current?.click()} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-800"><Plus size={18} />{file ? "Change attachment" : "Attach file"}</button>
      {file && <div className="mt-2 flex items-center gap-2 text-sm"><Paperclip size={16} /><span className="min-w-0 flex-1 break-all">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</span><button type="button" disabled={isSubmitting} aria-label="Remove attachment" onClick={() => { setFile(undefined); if (fileInput.current) fileInput.current.value = ""; }}><X size={16} /></button></div>}
      <p className="mt-2 text-xs text-slate-500">PDF, images, Office documents, TXT, CSV or ZIP. One file, up to 20 MB.</p>
    </div>
    <Field label="External URL (Google Drive, GitHub, etc.)"><input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://drive.google.com/... or https://github.com/..." maxLength={2000} className="w-full rounded-lg border px-3 py-2 text-sm" /></Field>
    <p className="text-xs text-slate-500">For Drive links, give your intended learners permission to open the file.</p>
    {formError && <p role="alert" className="text-sm text-rose-600">{formError}</p>}
    {isSubmitting && <div role="status" className="text-sm text-emerald-800"><progress aria-label="Upload progress" max={100} value={uploadProgress} className="w-full" /><p>{uploadProgress < 100 ? `Uploading ${uploadProgress}%` : "Upload complete. Saving submission..."}</p></div>}
    <p className="text-xs text-slate-400">This row starts pending and remains invisible until an admin approves it.</p><button disabled={isSubmitting || !courseId || !topicId} className="w-full rounded-lg bg-emerald-800 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{isSubmitting ? "Submitting..." : "Submit for Review"}</button>
  </fieldset></form></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>{children}</div>; }
