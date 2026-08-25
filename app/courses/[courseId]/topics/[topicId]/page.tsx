"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bookmark, ChevronRight, Download } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getCourseById, getTopicById } from "@/lib/data/academics";
import { useData } from "@/lib/store/DataContext";
import { ResourceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

const ALL = "All";
type FilterTab = typeof ALL | ResourceType;

const filterTabs: FilterTab[] = [
  ALL,
  "Study Material",
  "Practice Material",
  "Book",
  "Tutorial",
  "Slide",
  "Question",
  "LeetCode Problem",
];

export default function TopicResourcesPage() {
  const params = useParams<{ courseId: string; topicId: string }>();
  const course = getCourseById(params.courseId);
  const topic = getTopicById(params.topicId);

  const { user } = useAuth();
  const { resources, isBookmarked, toggleBookmark } = useData();
  const [activeFilter, setActiveFilter] = useState<FilterTab>(ALL);

  const topicResources = useMemo(
    () => resources.filter((r) => r.topicId === params.topicId),
    [resources, params.topicId]
  );

  const visibleResources =
    activeFilter === ALL ? topicResources : topicResources.filter((r) => r.type === activeFilter);

  if (!course || !topic) {
    return (
      <AppShell title="Not found">
        <p className="text-sm text-slate-500">We couldn&apos;t find that topic.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={topic.name}>
      <div className="space-y-5">
        {/* Breadcrumb */}
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <Link href="/courses" className="hover:text-violet-600">
            Courses
          </Link>
          <ChevronRight size={12} />
          <Link href={`/courses/${course.id}`} className="hover:text-violet-600">
            {course.code}
          </Link>
          <ChevronRight size={12} />
          <span>{topic.name}</span>
          <ChevronRight size={12} />
          <span className="text-slate-600">Resources</span>
        </p>

        <div>
          <h2 className="text-lg font-bold text-slate-900">{topic.name}</h2>
          <p className="text-sm text-slate-500">Browse all resources for this topic</p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activeFilter === filter
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-slate-200 text-slate-600 hover:border-violet-300"
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Added By</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleResources.map((resource) => {
                const bookmarked = user ? isBookmarked("resource", resource.id) : false;
                return (
                  <tr key={resource.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/resources/${resource.id}`}
                        className="flex items-center gap-2 font-medium text-slate-700 hover:text-violet-700"
                      >
                        <ResourceTypeIcon type={resource.type} />
                        {resource.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{resource.type}</td>
                    <td className="px-4 py-3 text-slate-500">{resource.addedByName}</td>
                    <td className="px-4 py-3 text-slate-500">{resource.year ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            toggleBookmark({
                              targetType: "resource",
                              targetId: resource.id,
                              title: resource.title,
                              subtitle: `${course.code} > ${topic.name}`,
                              resourceType: resource.type,
                            })
                          }
                          title={bookmarked ? "Remove bookmark" : "Bookmark this resource"}
                          className={cn(
                            "rounded-md p-1.5 hover:bg-slate-100",
                            bookmarked ? "text-violet-600" : "text-slate-400"
                          )}
                        >
                          <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
                        </button>
                        <button title="Download" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100">
                          <Download size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visibleResources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    No resources of this type yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
