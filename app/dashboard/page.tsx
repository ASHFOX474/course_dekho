"use client";

import Link from "next/link";
import { BookOpen, Bookmark, CheckCircle2, Layers, ShieldCheck, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useData } from "@/lib/store/DataContext";
import { initialAccessHistory, initialProgress } from "@/lib/data/activity";
import { getCourseById } from "@/lib/data/academics";
import { computeCourseProgress, getContinueLearningTopic, getDashboardStats, getEnrolledCourses } from "@/lib/queries";
import { formatRelativeTime } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/ui/StatCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return <AppShell title="Home">{null}</AppShell>;

  return (
    <AppShell title="Home">
      {user.role === "student" && <StudentDashboard />}
      {user.role === "teacher" && <TeacherDashboard />}
      {user.role === "admin" && <AdminDashboard />}
    </AppShell>
  );
}

// =====================================================================
// STUDENT DASHBOARD — matches the mockup 1:1
// =====================================================================
function StudentDashboard() {
  const { user } = useAuth();
  const { bookmarks } = useData();
  if (!user) return null;

  const myProgress = initialProgress.filter((p) => p.userId === user.id);
  const myBookmarks = bookmarks.filter((b) => b.userId === user.id);
  const myAccessHistory = initialAccessHistory
    .filter((a) => a.userId === user.id)
    .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());

  const stats = getDashboardStats(myProgress, myBookmarks.length);
  const continueLearning = getContinueLearningTopic(myProgress);
  const enrolledCourses = getEnrolledCourses(myProgress);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Welcome back, {user.name.split(" ")[0]}! 👋</h2>
        <p className="text-sm text-slate-500">Continue your learning journey</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Enrolled Courses" value={stats.enrolledCoursesCount} color="violet" href="/courses" />
        <StatCard icon={Layers} label="Topics in Progress" value={stats.topicsInProgressCount} color="sky" href="/progress" />
        <StatCard icon={CheckCircle2} label="Completed Topics" value={stats.completedTopicsCount} color="green" href="/progress" />
        <StatCard icon={Bookmark} label="Bookmarks" value={stats.bookmarksCount} color="rose" href="/bookmarks" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Continue Learning */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Continue Learning</h3>
          {continueLearning ? (
            <Link
              href={`/courses/${continueLearning.course.id}/topics/${continueLearning.topic.id}`}
              className="flex items-center gap-4 rounded-xl border border-slate-100 p-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
                {continueLearning.course.code.split("-")[1] ?? continueLearning.course.code}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {continueLearning.course.code}: {continueLearning.course.name}
                </p>
                <p className="text-xs text-slate-400">Current Topic</p>
                <p className="text-sm font-medium text-slate-700">{continueLearning.topic.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar percent={continueLearning.progress.progressPercent} className="flex-1" />
                  <span className="text-xs font-semibold text-slate-500">{continueLearning.progress.progressPercent}%</span>
                </div>
              </div>
            </Link>
          ) : (
            <p className="text-sm text-slate-400">Nothing in progress yet — start a course from the Courses page.</p>
          )}
        </div>

        {/* Recent Access */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent Access</h3>
          <ul className="space-y-3">
            {myAccessHistory.slice(0, 4).map((entry) => (
              <li key={entry.id}>
                <Link href={`/resources/${entry.resourceId}`} className="flex items-center justify-between gap-3 group">
                  <span className="flex min-w-0 items-center gap-2">
                    <ResourceTypeIcon type={entry.resourceType} />
                    <span className="truncate text-sm text-slate-700 group-hover:text-violet-700">{entry.resourceTitle}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelativeTime(entry.accessedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/access-history" className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline">
            View All History
          </Link>
        </div>
      </div>

      {/* Enrolled Courses */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Enrolled Courses</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {enrolledCourses.map((course) => {
            const percent = computeCourseProgress(myProgress, course.id);
            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="rounded-xl border border-slate-100 p-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
              >
                <p className="text-sm font-semibold text-slate-900">{course.code}</p>
                <p className="mb-2 truncate text-xs text-slate-500">{course.name}</p>
                <ProgressBar percent={percent} />
                <p className="mt-1 text-right text-xs font-medium text-slate-500">{percent}%</p>
              </Link>
            );
          })}
        </div>
        <Link href="/courses" className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline">
          View All Courses
        </Link>
      </div>
    </div>
  );
}

// =====================================================================
// TEACHER DASHBOARD — same visual language, teacher-relevant metrics
// =====================================================================
function TeacherDashboard() {
  const { user } = useAuth();
  const { submissions } = useData();
  if (!user) return null;

  const mine = submissions.filter((s) => s.teacherId === user.id);
  const pending = mine.filter((s) => s.status === "pending");
  const approved = mine.filter((s) => s.status === "approved");
  const rejected = mine.filter((s) => s.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Welcome back, {user.name.split(" ")[0]}! 👋</h2>
        <p className="text-sm text-slate-500">Here&apos;s how your contributions are doing</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Upload} label="Total Submissions" value={mine.length} color="violet" href="/teacher/submissions" />
        <StatCard icon={Layers} label="Pending Review" value={pending.length} color="amber" href="/teacher/submissions" />
        <StatCard icon={CheckCircle2} label="Approved" value={approved.length} color="green" href="/teacher/submissions" />
        <StatCard icon={BookOpen} label="Rejected" value={rejected.length} color="rose" href="/teacher/submissions" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Recent submissions</h3>
        <ul className="divide-y divide-slate-100">
          {mine.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-2 text-slate-700">
                <ResourceTypeIcon type={s.resourceType} />
                {s.title}
              </span>
              <span className="text-xs text-slate-400">{s.courseCode} &gt; {s.topicName}</span>
            </li>
          ))}
        </ul>
        <Link href="/teacher/submissions" className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline">
          Go to My Submissions
        </Link>
      </div>
    </div>
  );
}

// =====================================================================
// ADMIN DASHBOARD — platform-wide overview + shortcut to approval queue
// =====================================================================
function AdminDashboard() {
  const { user } = useAuth();
  const { submissions, resources } = useData();
  if (!user) return null;

  const pending = submissions.filter((s) => s.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Welcome back, {user.name.split(" ")[0]}! 👋</h2>
        <p className="text-sm text-slate-500">Here&apos;s the state of the platform</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Pending Approvals" value={pending.length} color="amber" href="/admin/approvals" />
        <StatCard icon={BookOpen} label="Published Resources" value={resources.length} color="green" href="/courses" />
        <StatCard icon={Upload} label="Total Submissions" value={submissions.length} color="violet" href="/admin/approvals" />
        <StatCard icon={Layers} label="Courses on Platform" value={getCourseById("cse-211") ? 6 : 0} color="sky" href="/courses" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Waiting on your review</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing pending right now — the queue is clear. 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.slice(0, 5).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="flex items-center gap-2 text-slate-700">
                  <ResourceTypeIcon type={s.resourceType} />
                  {s.title}
                </span>
                <span className="text-xs text-slate-400">by {s.teacherName}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/approvals" className="mt-3 inline-block text-xs font-medium text-violet-600 hover:underline">
          Go to Approval Queue
        </Link>
      </div>
    </div>
  );
}
