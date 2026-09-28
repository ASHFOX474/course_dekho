'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Bookmark, CheckCircle2, ChevronRight, ExternalLink } from "lucide-react";

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
import { createBookmark, deleteBookmark, getLearning, listBookmarks, listResourceCompletions, recordFolderActivity, setResourceCompletion } from "@/lib/client/workspace-api";
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
  const isLearner = user?.role === "learner" || user?.role === "contributor";
  const bookmarkState = useDatabaseData(
    `topic-bookmarks:${user?.id ?? "anonymous"}:${user?.role ?? "none"}`,
    user?.role === "admin" ? async () => [] : listBookmarks,
    []
  );
  const learning = useDatabaseData(
    `topic-learning:${user?.id ?? "anonymous"}:${params.courseId}`,
    isLearner ? getLearning : async () => ({ courses: [], topics: [], enrollmentRequests: [] }),
    { courses: [], topics: [], enrollmentRequests: [] }
  );
  const completionState = useDatabaseData(
    `topic-resource-completions:${user?.id ?? "anonymous"}:${params.topicId}`,
    isLearner ? (signal) => listResourceCompletions(params.topicId, signal) : async () => [],
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
  const [savingResources, setSavingResources] = useState<string[]>([]);
  const [completionError, setCompletionError] = useState<string | null>(null);
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
  const enrolled = learning.data.courses.some((item) => item.courseId === params.courseId);
  const topicProgress = learning.data.topics.find((item) => item.topicId === params.topicId);

  useEffect(() => {
    if (!isLearner || learning.isLoading || !enrolled) return;
    void recordFolderActivity(params.courseId, params.topicId).catch(() => undefined);
  }, [enrolled, isLearner, learning.isLoading, params.courseId, params.topicId]);

  async function toggleResourceCompletion(resourceId: string, completed: boolean) {
    const previous = completionState.data;
    const optimistic = completed
      ? [...previous.filter(item => item.resourceId !== resourceId), { resourceId, completed: true }]
      : previous.filter(item => item.resourceId !== resourceId);
    completionState.setData(optimistic);
    setSavingResources(current => [...current, resourceId]);
    setCompletionError(null);
    try {
      await setResourceCompletion(resourceId, completed);
      learning.refresh();
    } catch (requestError) {
      completionState.setData(previous);
      setCompletionError(errorMessage(requestError));
    } finally {
      setSavingResources(current => current.filter(id => id !== resourceId));
    }
  }

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

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{topic.name}</h2>
            <p className="text-sm text-slate-500">Browse approved, active resources for this topic.</p>
          </div>
          {isLearner && (enrolled ? <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-2 text-sm font-semibold text-violet-800">{topicProgress?.completed && <CheckCircle2 size={16} />}{topicProgress?.progressPercent ?? 0}% complete</span> : <Link href={`/courses/${course.id}`} className="text-xs font-semibold text-violet-700">Request enrollment to track progress →</Link>)}
        </div>

        {(learning.error || completionState.error || completionError) && <p role="alert" className="text-sm text-rose-600">{completionError ?? learning.error ?? completionState.error}</p>}

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
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleResources.map((resource) => {
                const displayType = resourceTypeLabel(resource.type);
                const bookmarked = bookmarkState.data.some(
                  (bookmark) => bookmark.targetType === "resource" && bookmark.targetId === resource.id
                );
                const completed = completionState.data.some(item => item.resourceId === resource.id && item.completed);
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {user?.role === 'admin' && <><EditResourceButton resource={resource} onSaved={() => setRefreshVersion(value => value + 1)} /><RemoveResourceButton resourceId={resource.id} title={resource.title} onRemoved={() => setResources(current => current.filter(item => item.id !== resource.id))} /></>}
                        {isLearner && <input type="checkbox" checked={completed} disabled={!enrolled || savingResources.includes(resource.id)} onChange={event => void toggleResourceCompletion(resource.id, event.target.checked)} aria-label={`Mark ${resource.title} complete`} className="mr-1 h-4 w-4 accent-violet-600 disabled:opacity-50" />}
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
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
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
