"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Download, ImageIcon } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  formatFileSize,
  getApprovedResource,
  getCourse,
  listCourseTopics,
  resourceTypeLabel,
  type ApprovedResourceDto,
  type CourseSummaryDto,
  type TopicSummaryDto,
} from "@/lib/client/catalog-api";
import {
  createBookmark,
  deleteBookmark,
  listBookmarks,
  listSolvedQuestions,
  markResourceSolved,
  recordResourceAccess,
} from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { cn, formatDate } from "@/lib/utils";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load this resource.";
}

export default function ResourceDetailPage() {
  const params = useParams<{ resourceId: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isLearner = user?.role === "student" || user?.role === "teacher";
  const bookmarks = useDatabaseData(
    `resource-bookmarks:${user?.id ?? "anonymous"}:${user?.role ?? "none"}`,
    isLearner ? listBookmarks : async () => [],
    []
  );
  const solved = useDatabaseData(
    `resource-solved:${user?.id ?? "anonymous"}:${user?.role ?? "none"}`,
    isLearner ? listSolvedQuestions : async () => [],
    []
  );
  const [resource, setResource] = useState<ApprovedResourceDto | null>(null);
  const [course, setCourse] = useState<CourseSummaryDto | null>(null);
  const [topic, setTopic] = useState<TopicSummaryDto | null>(null);
  const [resolvedResourceId, setResolvedResourceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isLoading = resolvedResourceId !== params.resourceId;

  useEffect(() => {
    if (isAuthLoading || !user) return;
    const controller = new AbortController();

    getApprovedResource(params.resourceId, controller.signal)
      .then(async (resourceResponse) => {
        const [courseResponse, topicResponse] = await Promise.all([
          getCourse(resourceResponse.courseId, controller.signal),
          listCourseTopics(resourceResponse.courseId, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setResource(resourceResponse);
        setCourse(courseResponse);
        setTopic(topicResponse.find((item) => item.id === resourceResponse.topicId) ?? null);
        setError(null);
        if (user.role !== "admin") void recordResourceAccess(resourceResponse.id).catch(() => undefined);
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolvedResourceId(params.resourceId);
      });

    return () => controller.abort();
  }, [isAuthLoading, params.resourceId, user]);

  if (isLoading || isAuthLoading) {
    return (
      <AppShell title="Resource">
        <p className="text-sm text-slate-400">Loading approved resource...</p>
      </AppShell>
    );
  }

  if (!resource || error) {
    return (
      <AppShell title="Not found">
        <p role="alert" className="text-sm text-slate-500">
          {error ?? "We couldn't find that approved resource."}
        </p>
      </AppShell>
    );
  }

  const displayType = resourceTypeLabel(resource.type);
  const bookmark = bookmarks.data.find(
    (item) => item.targetType === "resource" && item.targetId === resource.id
  );
  const bookmarked = Boolean(bookmark);
  const isSolved = solved.data.some((item) => item.resourceId === resource.id);
  async function toggleResourceBookmark() {
    try {
      if (bookmark) {
        await deleteBookmark(bookmark.id);
        bookmarks.setData((current) => current.filter((item) => item.id !== bookmark.id));
      } else {
        const created = await createBookmark({ targetType: "resource", targetId: resource!.id });
        bookmarks.setData((current) => [created, ...current]);
      }
      bookmarks.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function markSolved() {
    try {
      solved.setData(await markResourceSolved(resource!.id));
      solved.refresh();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  return (
    <AppShell title={resource.title}>
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-violet-600"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{resource.title}</h2>
              <Badge tone="purple">{displayType}</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Added by {resource.addedBy.name} on {formatDate(resource.uploadedAt)}
            </p>
          </div>

          <div className="flex gap-2">
            {isLearner && <button
              type="button"
              onClick={() => void toggleResourceBookmark()}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium",
                bookmarked
                  ? "border-violet-600 bg-violet-50 text-violet-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </button>}
            {isLearner && resource.type === "question" && <button
              type="button"
              disabled={isSolved}
              onClick={() => void markSolved()}
              className="rounded-lg border border-emerald-200 px-3.5 py-2 text-sm font-medium text-emerald-700 disabled:bg-emerald-50"
            >
              {isSolved ? "Solved" : "Mark solved"}
            </button>}
            <button
              type="button"
              disabled
              title="File delivery will be enabled by the storage API"
              className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-slate-300 px-3.5 py-2 text-sm font-semibold text-white"
            >
              <Download size={15} />
              Download
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Description</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                {resource.description || "No description was supplied."}
              </p>
            </section>

            {resource.topicsCovered.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Topics Covered</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                  {resource.topicsCovered.map((coveredTopic) => (
                    <li key={coveredTopic}>{coveredTopic}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">Preview</h3>
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-300">
                <div className="text-center">
                  <ImageIcon size={28} className="mx-auto mb-1" />
                  <p className="text-xs">
                    Preview requires the future signed-file delivery API.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resource Info</h3>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Type" value={displayType} />
              <InfoRow label="Topic" value={topic?.name ?? "—"} />
              <InfoRow
                label="Course"
                value={
                  course ? (
                    <Link href={`/courses/${course.id}`} className="text-violet-600 hover:underline">
                      {course.code}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="Year" value={resource.year ?? "—"} />
              <InfoRow label="File Size" value={formatFileSize(resource.fileSizeBytes) ?? "—"} />
              <InfoRow label="Views" value={resource.views} />
              <InfoRow label="Downloads" value={resource.downloads} />
            </dl>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-700">{value}</dd>
    </div>
  );
}
