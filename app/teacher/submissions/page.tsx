"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useData } from "@/lib/store/DataContext";
import { getTopicsByCourse, courses } from "@/lib/data/academics";
import { resourceTypeFilters } from "@/lib/data/resources";
import { ResourceType, SubmissionStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { StatusBadge } from "@/components/ui/Badge";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

type TabKey = "all" | SubmissionStatus;

export default function TeacherSubmissionsPage() {
  return (
    <AppShell title="My Submissions" allowedRoles={["teacher"]}>
      <TeacherSubmissionsContent />
    </AppShell>
  );
}

function TeacherSubmissionsContent() {
  const { user } = useAuth();
  const { submissions, addSubmission } = useData();
  const [tab, setTab] = useState<TabKey>("all");
  const [showForm, setShowForm] = useState(false);

  const mine = useMemo(() => submissions.filter((s) => s.teacherId === user?.id), [submissions, user]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: `All (${mine.length})` },
    { key: "pending", label: `Pending (${mine.filter((s) => s.status === "pending").length})` },
    { key: "approved", label: `Approved (${mine.filter((s) => s.status === "approved").length})` },
    { key: "rejected", label: `Rejected (${mine.filter((s) => s.status === "rejected").length})` },
  ];

  const visible = tab === "all" ? mine : mine.filter((s) => s.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">My Submissions</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <Plus size={15} />
          New Submission
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
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
              <th className="px-4 py-3 font-medium">Topic / Course</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{s.title}</p>
                  {s.status === "rejected" && s.rejectionReason && (
                    <p className="mt-0.5 text-xs text-rose-500">Reason: {s.rejectionReason}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ResourceTypeIcon type={s.resourceType} size={14} />
                    {s.resourceType}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {s.courseCode} &gt; {s.topicName}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">{formatDate(s.submittedAt.slice(0, 10))}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  Nothing here yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <NewSubmissionModal onClose={() => setShowForm(false)} onSubmit={addSubmission} />}
    </div>
  );
}

function NewSubmissionModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: {
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    courseCode: string;
    topicId: string;
    topicName: string;
  }) => void;
}) {
  const [courseId, setCourseId] = useState(courses[0].id);
  const topicsForCourse = getTopicsByCourse(courseId);
  const [topicId, setTopicId] = useState(topicsForCourse[0]?.id ?? "");
  const [resourceType, setResourceType] = useState<ResourceType>(resourceTypeFilters[0]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  function handleCourseChange(id: string) {
    setCourseId(id);
    const topics = getTopicsByCourse(id);
    setTopicId(topics[0]?.id ?? "");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const course = courses.find((c) => c.id === courseId);
    const topic = topicsForCourse.find((t) => t.id === topicId);
    if (!course || !topic || !title.trim()) return;

    onSubmit({
      resourceType,
      title: title.trim(),
      description: description.trim() || "No description provided.",
      courseId: course.id,
      courseCode: course.code,
      topicId: topic.id,
      topicName: topic.name,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">New Submission</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Course</label>
            <select
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Topic</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            >
              {topicsForCourse.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Resource Type</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as ResourceType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            >
              {resourceTypeFilters.map((rt) => (
                <option key={rt} value={rt}>
                  {rt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="e.g. Binary Search Practice Sheet"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Briefly describe what this resource covers..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>

          <p className="text-xs text-slate-400">
            This will be sent to an Admin for review. It will only become visible to students once approved.
          </p>

          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Submit for Review
          </button>
        </form>
      </div>
    </div>
  );
}
