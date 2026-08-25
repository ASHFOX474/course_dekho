"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Layers } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { initialProgress } from "@/lib/data/activity";
import { getCourseById, getTopicById } from "@/lib/data/academics";
import { computeCourseProgress, getDashboardStats, getEnrolledCourses } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { useData } from "@/lib/store/DataContext";

type Tab = "courses" | "topics";

export default function ProgressPage() {
  const { user } = useAuth();
  const { bookmarks } = useData();
  const [tab, setTab] = useState<Tab>("courses");

  if (!user) return <AppShell title="My Progress">{null}</AppShell>;

  const myProgress = initialProgress.filter((p) => p.userId === user.id);
  const myBookmarks = bookmarks.filter((b) => b.userId === user.id);
  const enrolledCourses = getEnrolledCourses(myProgress);
  const stats = getDashboardStats(myProgress, myBookmarks.length);

  const overallPercent =
    myProgress.length === 0
      ? 0
      : Math.round(myProgress.reduce((sum, p) => sum + p.progressPercent, 0) / myProgress.length);

  return (
    <AppShell title="My Progress">
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-slate-900">My Progress</h2>

        <div className="flex gap-1 border-b border-slate-200">
          {(["courses", "topics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 pb-2.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              By {t}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
          {/* Left: by-courses or by-topics breakdown */}
          <div className="space-y-3">
            {tab === "courses" &&
              enrolledCourses.map((course) => {
                const percent = computeCourseProgress(myProgress, course.id);
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{course.code}</p>
                        <p className="text-xs text-slate-500">{course.name}</p>
                      </div>
                      <span className="text-sm font-bold text-violet-600">{percent}%</span>
                    </div>
                    <ProgressBar percent={percent} />
                  </Link>
                );
              })}

            {tab === "topics" &&
              myProgress
                .slice()
                .sort((a, b) => b.progressPercent - a.progressPercent)
                .map((p) => {
                  const course = getCourseById(p.courseId);
                  const topic = getTopicById(p.topicId);
                  if (!course || !topic) return null;
                  return (
                    <Link
                      key={p.topicId}
                      href={`/courses/${course.id}/topics/${topic.id}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-300"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{topic.name}</p>
                          <p className="text-xs text-slate-500">{course.code}</p>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            p.completed ? "text-emerald-600" : p.progressPercent > 0 ? "text-violet-600" : "text-slate-400"
                          )}
                        >
                          {p.progressPercent}%
                        </span>
                      </div>
                      <ProgressBar percent={p.progressPercent} />
                    </Link>
                  );
                })}
          </div>

          {/* Right: overall summary */}
          <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-center">
              <CircularProgress percent={overallPercent} size={120} strokeWidth={10} sublabel="Overall" />
            </div>

            <div className="space-y-3 border-t border-slate-100 pt-4 text-sm">
              <SummaryRow icon={Layers} label="Total Courses" value={stats.enrolledCoursesCount} />
              <SummaryRow icon={CheckCircle2} label="Completed Topics" value={stats.completedTopicsCount} />
              <SummaryRow icon={Layers} label="In Progress" value={stats.topicsInProgressCount} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-500">
        <Icon size={15} />
        {label}
      </span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
