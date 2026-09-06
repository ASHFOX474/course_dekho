"use client";

import Link from "next/link";
import { BookOpen, Bookmark, CheckCircle2, Layers, ShieldCheck, Upload, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/lib/auth/AuthContext";
import { resourceTypeLabel } from "@/lib/client/catalog-api";
import { getAdminStats, getLearning, listAccessHistory, listBookmarks, listOwnSubmissions, listSubmissionsForReview, type SubmissionDto } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return <AppShell title="Home">{null}</AppShell>;
  return <AppShell title="Home">
    {user.role === "student" && <LearnerDashboard />}
    {user.role === "teacher" && <TeacherDashboard />}
    {user.role === "admin" && <AdminDashboard />}
  </AppShell>;
}

function Welcome({ subtitle }: { subtitle: string }) {
  const { user } = useAuth();
  return <div><h2 className="text-xl font-bold text-slate-900">Welcome back, {user?.name.split(" ")[0]}! 👋</h2><p className="text-sm text-slate-500">{subtitle}</p></div>;
}

function LearnerDashboard() {
  const { user } = useAuth();
  const key = user?.id ?? "anonymous";
  const learning = useDatabaseData(`dashboard-learning:${key}`, getLearning, { courses: [], topics: [] });
  const bookmarks = useDatabaseData(`dashboard-bookmarks:${key}`, listBookmarks, []);
  const access = useDatabaseData(`dashboard-access:${key}`, listAccessHistory, []);
  const completed = learning.data.topics.filter((topic) => topic.completed).length;
  const inProgress = learning.data.topics.filter((topic) => !topic.completed && topic.progressPercent > 0).length;
  const continueLearning = learning.data.topics[0];
  const error = learning.error ?? bookmarks.error ?? access.error;
  return <div className="space-y-6">
    <Welcome subtitle="Live learning activity from PostgreSQL" />
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard icon={BookOpen} label="Enrolled Courses" value={learning.data.courses.length} color="violet" href="/progress" /><StatCard icon={Layers} label="Topics in Progress" value={inProgress} color="sky" href="/progress" /><StatCard icon={CheckCircle2} label="Completed Topics" value={completed} color="green" href="/progress" /><StatCard icon={Bookmark} label="Bookmarks" value={bookmarks.data.length} color="rose" href="/bookmarks" /></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-semibold">Continue Learning</h3>{continueLearning ? <Link href={`/courses/${continueLearning.courseId}/topics/${continueLearning.topicId}`} className="block rounded-xl border p-3 hover:border-violet-200"><p className="text-sm font-semibold">{continueLearning.courseCode}: {continueLearning.courseName}</p><p className="text-sm text-slate-600">{continueLearning.topicName}</p><div className="mt-2 flex items-center gap-2"><ProgressBar percent={continueLearning.progressPercent} className="flex-1" /><span className="text-xs">{continueLearning.progressPercent}%</span></div></Link> : <p className="text-sm text-slate-400">No progress rows yet.</p>}</section>
      <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-semibold">Recent Access</h3><ul className="space-y-3">{access.data.slice(0, 4).map((entry) => <li key={entry.id}><Link href={`/resources/${entry.resourceId}`} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><ResourceTypeIcon type={resourceTypeLabel(entry.resourceType)} /><span className="truncate text-sm">{entry.resourceTitle}</span></span><span className="text-xs text-slate-400">{formatRelativeTime(entry.accessedAt)}</span></Link></li>)}</ul>{access.data.length === 0 && <p className="text-sm text-slate-400">No access events yet.</p>}</section>
    </div>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-semibold">Enrolled Courses</h3><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{learning.data.courses.map((course) => <Link key={course.enrollmentId} href={`/courses/${course.courseId}`} className="rounded-xl border p-3"><p className="text-sm font-semibold">{course.code}</p><p className="mb-2 truncate text-xs text-slate-500">{course.name}</p><ProgressBar percent={course.progressPercent} /><p className="mt-1 text-right text-xs">{course.progressPercent}%</p></Link>)}</div></section>
  </div>;
}

function TeacherDashboard() {
  const { user } = useAuth();
  const result = useDatabaseData(`teacher-dashboard:${user?.id ?? "anonymous"}`, listOwnSubmissions, []);
  const pending = result.data.filter((submission) => submission.status === "pending");
  const approved = result.data.filter((submission) => submission.status === "approved");
  const rejected = result.data.filter((submission) => submission.status === "rejected");
  return <div className="space-y-6"><Welcome subtitle="Live contribution status from PostgreSQL" />{result.error && <p role="alert" className="text-sm text-rose-600">{result.error}</p>}<div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard icon={Upload} label="Total Submissions" value={result.data.length} color="violet" href="/teacher/submissions" /><StatCard icon={Layers} label="Pending Review" value={pending.length} color="amber" href="/teacher/submissions" /><StatCard icon={CheckCircle2} label="Approved" value={approved.length} color="green" href="/teacher/submissions" /><StatCard icon={BookOpen} label="Rejected" value={rejected.length} color="rose" href="/teacher/submissions" /></div><SubmissionList title="Recent submissions" submissions={result.data.slice(0, 5)} /></div>;
}

function AdminDashboard() {
  const { user } = useAuth();
  const submissions = useDatabaseData(`admin-dashboard-submissions:${user?.id ?? "anonymous"}`, listSubmissionsForReview, []);
  const stats = useDatabaseData(`admin-dashboard-stats:${user?.id ?? "anonymous"}`, getAdminStats, { userCount: 0, courseCount: 0, publishedResourceCount: 0, submissionCount: 0 });
  const pending = submissions.data.filter((submission) => submission.status === "pending");
  return <div className="space-y-6"><Welcome subtitle="Live platform state from PostgreSQL" />{(submissions.error || stats.error) && <p role="alert" className="text-sm text-rose-600">{submissions.error ?? stats.error}</p>}<div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard icon={ShieldCheck} label="Pending Approvals" value={pending.length} color="amber" href="/admin/approvals" /><StatCard icon={BookOpen} label="Published Resources" value={stats.data.publishedResourceCount} color="green" href="/courses" /><StatCard icon={Users} label="Active Users" value={stats.data.userCount} color="violet" /><StatCard icon={Layers} label="Active Courses" value={stats.data.courseCount} color="sky" href="/courses" /></div><SubmissionList title="Waiting on your review" submissions={pending.slice(0, 5)} /></div>;
}

function SubmissionList({ title, submissions }: { title: string; submissions: SubmissionDto[] }) {
  return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-semibold">{title}</h3><ul className="divide-y">{submissions.map((submission) => <li key={submission.id} className="flex items-center justify-between py-2.5 text-sm"><span className="flex items-center gap-2"><ResourceTypeIcon type={resourceTypeLabel(submission.resourceType)} />{submission.title}</span><span className="text-xs text-slate-400">{submission.courseCode} &gt; {submission.topicName}</span></li>)}</ul>{submissions.length === 0 && <p className="text-sm text-slate-400">Nothing here.</p>}</section>;
}
