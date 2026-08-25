"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getCourseById, getTopicsByCourse } from "@/lib/data/academics";
import { initialProgress } from "@/lib/data/activity";
import { useData } from "@/lib/store/DataContext";
import { getTopicProgress } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

type Tab = "roadmap" | "resources" | "announcements";

const announcements = [
  { title: "Midterm exam schedule released", date: "2024-05-12", body: "Check the university notice board for room assignments." },
  { title: "New Graph resources added", date: "2024-05-05", body: "A fresh set of BFS/DFS practice problems has been uploaded to the Graph topic." },
];

export default function CourseRoadmapPage() {
  const params = useParams<{ courseId: string }>();
  const course = getCourseById(params.courseId);
  const topics = getTopicsByCourse(params.courseId);

  const { user } = useAuth();
  const { resources } = useData();
  const [tab, setTab] = useState<Tab>("roadmap");
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id);

  const myProgress = user ? initialProgress.filter((p) => p.userId === user.id) : [];
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? topics[0];
  const selectedProgress = selectedTopic ? getTopicProgress(myProgress, selectedTopic.id) : undefined;

  const courseResources = useMemo(
    () => resources.filter((r) => r.courseId === params.courseId),
    [resources, params.courseId]
  );

  if (!course) {
    return (
      <AppShell title="Course not found">
        <p className="text-sm text-slate-500">We couldn&apos;t find that course.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={course.code}>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/courses" className="hover:text-violet-600">
            Courses
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-600">{course.code}</span>
        </p>

        <h2 className="text-lg font-bold text-slate-900">
          {course.code}: {course.name}
        </h2>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {(["roadmap", "resources", "announcements"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 px-3 pb-2.5 text-sm font-medium capitalize transition-colors",
                tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "roadmap" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            {/* Topic list */}
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {topics.map((topic) => {
                const progress = getTopicProgress(myProgress, topic.id);
                const percent = progress?.progressPercent ?? 0;
                const isSelected = topic.id === selectedTopic?.id;

                return (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        percent === 100 ? "bg-emerald-100 text-emerald-700" : isSelected ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {topic.sequenceOrder}
                    </span>
                    <span className={cn("flex-1 text-sm font-medium", isSelected ? "text-violet-700" : "text-slate-700")}>
                      {topic.name}
                    </span>
                    {percent === 100 ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : percent > 0 ? (
                      <span className="text-xs font-semibold text-violet-600">{percent}%</span>
                    ) : (
                      <Circle size={14} className="text-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected topic detail */}
            {selectedTopic && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedTopic.name}</h3>
                    <p className="mt-1 max-w-md text-sm text-slate-500">{selectedTopic.description}</p>
                  </div>
                  <CircularProgress percent={selectedProgress?.progressPercent ?? 0} sublabel="Complete" />
                </div>

                <div className="my-5 border-t border-slate-100" />

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Topics in this section</p>
                <ul className="mb-5 space-y-2">
                  {selectedTopic.subtopics.map((sub) => (
                    <li key={sub} className="text-sm text-slate-600">
                      {sub}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/courses/${course.id}/topics/${selectedTopic.id}`}
                  className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  View Resources
                </Link>
              </div>
            )}
          </div>
        )}

        {tab === "resources" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Topic</th>
                  <th className="px-4 py-3 font-medium">Added By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courseResources.map((resource) => {
                  const topic = topics.find((t) => t.id === resource.topicId);
                  return (
                    <tr key={resource.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/resources/${resource.id}`} className="flex items-center gap-2 font-medium text-slate-700 hover:text-violet-700">
                          <ResourceTypeIcon type={resource.type} />
                          {resource.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{resource.type}</td>
                      <td className="px-4 py-3 text-slate-500">{topic?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{resource.addedByName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "announcements" && (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div key={a.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                <p className="mt-1 text-sm text-slate-500">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
