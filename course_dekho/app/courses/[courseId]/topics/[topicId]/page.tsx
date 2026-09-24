"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Bookmark, ChevronRight, ExternalLink } from "lucide-react";

import { ResourceLinkForm } from '@/components/ui/ResourceLinkForm';
import { RemoveResourceButton } from '@/components/ui/RemoveResourceButton';
import { EditResourceButton } from '@/components/ui/EditResourceButton';
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getCourse,
  listCourseTopics,
  listTopicResources,
  courseResourceTypeLabel as resourceTypeLabel,
  type ApprovedResourceDto,
  type CourseSummaryDto,
  type TopicSummaryDto,
} from "@/lib/client/catalog-api";
import { createBookmark, deleteBookmark, listBookmarks } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import type { ResourceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isCourseResource, topicResourceTypes } from "@/lib/resource-placement";

const ALL = "All";
type FilterTab = typeof ALL | ResourceType;

const filterTabs: FilterTab[] = [
  ALL,
  "Tutorial",
  "Question",
  "Practice",
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load topic resources.";
}

export default function TopicResourcesPage() {
  const params = useParams<{ courseId: string; topicId: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const bookmarkState = useDatabaseData(
    `topic-bookmarks:${user?.id ?? "anonymous"}:${user?.role ?? "none"}`,
    user?.role === "admin" ? async () => [] : listBookmarks,
    []
  );
  const [addingResource, setAddingResource] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [course, setCourse] = useState<CourseSummaryDto | null>(null);
  const [topic, setTopic] = useState<TopicSummaryDto | null>(null);
  const [resources, setResources] = useState<ApprovedResourceDto[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>(ALL);
  const [resolvedRequest, setResolvedRequest] = useState("");
  const [error, setError] = useState<string | null>(null);
  const requestKey = `${params.courseId}:${params.topicId}`;
  const isLoading = resolvedRequest !== requestKey;

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    Promise.all([
      getCourse(params.courseId, controller.signal),
      listCourseTopics(params.courseId, controller.signal),
      listTopicResources(params.topicId, controller.signal),
    ])
      .then(([courseResponse, topicResponse, resourceResponse]) => {
        const matchingTopic = topicResponse.find((item) => item.id === params.topicId);
        if (!matchingTopic) throw new Error("Topic not found in this course.");
        setCourse(courseResponse);
        setTopic(matchingTopic);
        setResources(resourceResponse);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedRequest(requestKey);
      });

    return () => controller.abort();
  }, [isAuthLoading, params.courseId, params.topicId, requestKey, user, refreshVersion]);

  const visibleResources = useMemo(
    () =>
      resources.filter((resource) => !isCourseResource(resource.type) &&
        (activeFilter === ALL || resourceTypeLabel(resource.type) === activeFilter)),
    [activeFilter, resources]
  );

  async function toggleResourceBookmark(resourceId: string) {
    try {
      const existing = bookmarkState.data.find(
        (bookmark) => bookmark.targetType === "resource" && bookmark.targetId === resourceId
      );
      if (existing) {
        await deleteBookmark(existing.id);
        bookmarkState.setData((current) => current.filter((bookmark) => bookmark.id !== existing.id));
      } else {
        const created = await createBookmark({ targetType: "resource", targetId: resourceId });
        bookmarkState.setData((current) => [created, ...current]);
      }
      bookmarkState.refresh();
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (isLoading || isAuthLoading) {
    return (
      <AppShell title="Resources">
        <p className="text-sm text-slate-400">Loading approved resources...</p>
      </AppShell>
    );
  }

  if (!course || !topic || error) {
    return (
      <AppShell title="Not found">
        <p role="alert" className="text-sm text-slate-500">
          {error ?? "We couldn't find that topic."}
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title={topic.name}>
      <div className="space-y-5">
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
          <p className="text-sm text-slate-500">
            Browse approved, active resources for this topic
          </p>
        </div>

        {user?.role === 'admin' && <div><button className="action-primary" onClick={() => setAddingResource(true)}>Add resource link</button></div>}
        {user?.role === 'admin' && addingResource && <ResourceLinkForm courseId={course.id} topicId={topic.id} topicName={topic.name} defaultResourceType={topicResourceTypes.find(type => resourceTypeLabel(type) === activeFilter)} onClose={() => setAddingResource(false)} onSaved={() => { setAddingResource(false); setRefreshVersion(value => value + 1); }} />}

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((filter) => (
            <button
              key={filter}
              type="button"
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

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                const displayType = resourceTypeLabel(resource.type);
                const bookmarked = bookmarkState.data.some(
                  (bookmark) => bookmark.targetType === "resource" && bookmark.targetId === resource.id
                );
                return (
                  <tr key={resource.id} className="cursor-pointer hover:bg-slate-50"
                    title="Double-click to open resource"
                    onDoubleClick={event => {
                      if ((event.target as Element).closest('a, button, input, select, textarea')) return;
                      router.push(`/resources/${resource.id}`);
                    }}>
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
                    <td className="px-4 py-3 text-slate-500">{resource.addedBy.name}</td>
                    <td className="px-4 py-3 text-slate-500">{resource.year ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {user?.role === 'admin' && <><EditResourceButton resource={resource} onSaved={() => setRefreshVersion(value => value + 1)} /><RemoveResourceButton resourceId={resource.id} title={resource.title} onRemoved={() => setResources(current => current.filter(item => item.id !== resource.id))} /></>}
                        {user?.role !== "admin" && <button
                          type="button"
                          onClick={() => void toggleResourceBookmark(resource.id)}
                          title={bookmarked ? "Remove bookmark" : "Bookmark this resource"}
                          className={cn(
                            "rounded-md p-1.5 hover:bg-slate-100",
                            bookmarked ? "text-violet-600" : "text-slate-400"
                          )}
                        >
                          <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
                        </button>}
                        <Link href={`/resources/${resource.id}`} title="Open resource and attachments" aria-label={`Open ${resource.title}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"><ExternalLink size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visibleResources.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                    No approved active resources of this type yet.
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
