"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Circle } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getCourse,
  listCourseResources,
  listCourseTopics,
  resourceTypeLabel,
  type ApprovedResourceDto,
  type CourseSummaryDto,
  type TopicSummaryDto,
} from "@/lib/client/catalog-api";
import { cn } from "@/lib/utils";

type Tab = "roadmap" | "resources" | "announcements";

const announcements = [
  {
    title: "Midterm exam schedule released",
    date: "2024-05-12",
    body: "Check the university notice board for room assignments.",
  },
  {
    title: "New Graph resources added",
    date: "2024-05-05",
    body: "A fresh set of BFS/DFS practice problems has been uploaded to the Graph topic.",
  },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load this course.";
}

export default function CourseRoadmapPage() {
  const params = useParams<{ courseId: string }>();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [course, setCourse] = useState<CourseSummaryDto | null>(null);
  const [topics, setTopics] = useState<TopicSummaryDto[]>([]);
  const [resources, setResources] = useState<ApprovedResourceDto[]>([]);
  const [tab, setTab] = useState<Tab>("roadmap");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [resolvedCourseId, setResolvedCourseId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isLoading = resolvedCourseId !== params.courseId;

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    Promise.all([
      getCourse(params.courseId, controller.signal),
      listCourseTopics(params.courseId, controller.signal),
      listCourseResources(params.courseId, controller.signal),
    ])
      .then(([courseResponse, topicResponse, resourceResponse]) => {
        setCourse(courseResponse);
        setTopics(topicResponse);
        setResources(resourceResponse);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedCourseId(params.courseId);
      });

    return () => controller.abort();
  }, [isAuthLoading, params.courseId, user]);

  const selectedTopic =
    topics.find((topic) => topic.id === selectedTopicId) ?? topics[0];

  if (isLoading || isAuthLoading) {
    return (
      <AppShell title="Course">
        <p className="text-sm text-slate-400">Loading course roadmap...</p>
      </AppShell>
    );
  }

  if (!course || error) {
    return (
      <AppShell title="Course not found">
        <p role="alert" className="text-sm text-slate-500">
          {error ?? "We couldn't find that course."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title={course.code}>
      <div className="space-y-5">
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/courses" className="hover:text-violet-600">
            Courses
          </Link>
          <ChevronRight size={12} />
          <span className="text-slate-600">{course.code}</span>
        </p>

        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {course.code}: {course.name}
          </h2>
          {course.description && (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{course.description}</p>
          )}
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {(["roadmap", "resources", "announcements"] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "border-b-2 px-3 pb-2.5 text-sm font-medium capitalize transition-colors",
                tab === item
                  ? "border-violet-600 text-violet-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "roadmap" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <div className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              {topics.map((topic) => {
                const isSelected = topic.id === selectedTopic?.id;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isSelected ? "bg-violet-50" : "hover:bg-slate-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 text-slate-500"
                      )}
                    >
                      {topic.sequenceOrder}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        isSelected ? "text-violet-700" : "text-slate-700"
                      )}
                    >
                      {topic.name}
                    </span>
                    <Circle size={14} className="text-slate-300" />
                  </button>
                );
              })}

              {topics.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  No active topics are available.
                </p>
              )}
            </div>

            {selectedTopic ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-bold text-slate-900">{selectedTopic.name}</h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {selectedTopic.description}
                </p>

                <div className="my-5 border-t border-slate-100" />

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Topics in this section
                </p>
                {selectedTopic.subtopics.length > 0 ? (
                  <ul className="mb-5 space-y-2">
                    {selectedTopic.subtopics.map((subtopic) => (
                      <li key={subtopic} className="text-sm text-slate-600">
                        {subtopic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-5 text-sm text-slate-400">No active subtopics.</p>
                )}

                <Link
                  href={`/courses/${course.id}/topics/${selectedTopic.id}`}
                  className="inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  View Resources
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400 shadow-sm">
                This course does not have an active roadmap yet.
              </div>
            )}
          </div>
        )}

        {tab === "resources" && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                {resources.map((resource) => {
                  const topic = topics.find((item) => item.id === resource.topicId);
                  const displayType = resourceTypeLabel(resource.type);
                  return (
                    <tr key={resource.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/resources/${resource.id}`}
                          className="flex items-center gap-2 font-medium text-slate-700 hover:text-violet-700"
                        >
                          <ResourceTypeIcon type={displayType} />
                          {resource.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{displayType}</td>
                      <td className="px-4 py-3 text-slate-500">{topic?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{resource.addedBy.name}</td>
                    </tr>
                  );
                })}
                {resources.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      No approved active resources are available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "announcements" && (
          <div className="space-y-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.title}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {announcement.title}
                  </p>
                  <time className="text-xs text-slate-400">{announcement.date}</time>
                </div>
                <p className="mt-1 text-sm text-slate-500">{announcement.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
