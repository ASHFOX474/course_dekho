"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Download, ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getCourseById, getTopicById } from "@/lib/data/academics";
import { useData } from "@/lib/store/DataContext";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";

export default function ResourceDetailPage() {
  const params = useParams<{ resourceId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { resources, isBookmarked, toggleBookmark } = useData();

  const resource = resources.find((r) => r.id === params.resourceId);

  if (!resource) {
    return (
      <AppShell title="Not found">
        <p className="text-sm text-slate-500">We couldn&apos;t find that resource.</p>
      </AppShell>
    );
  }

  const course = getCourseById(resource.courseId);
  const topic = getTopicById(resource.topicId);
  const bookmarked = user ? isBookmarked("resource", resource.id) : false;

  return (
    <AppShell title={resource.title}>
      <div className="space-y-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-violet-600"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{resource.title}</h2>
              <Badge tone="purple">{resource.type}</Badge>
            </div>
            <p className="text-sm text-slate-500">
              Added by {resource.addedByName} on {formatDate(resource.uploadedAt)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() =>
                toggleBookmark({
                  targetType: "resource",
                  targetId: resource.id,
                  title: resource.title,
                  subtitle: course && topic ? `${course.code} > ${topic.name}` : "",
                  resourceType: resource.type,
                })
              }
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium",
                bookmarked ? "border-violet-600 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} />
              {bookmarked ? "Bookmarked" : "Bookmark"}
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              <Download size={15} />
              Download
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">
          {/* Main column */}
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Description</h3>
              <p className="text-sm leading-relaxed text-slate-600">{resource.description}</p>
            </section>

            {resource.topicsCovered.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Topics Covered</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
                  {resource.topicsCovered.map((t) => (
                    <li key={t}>{t}</li>
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
                    Preview not available in this demo — in production this would render the actual file.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {/* Resource Info sidebar */}
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resource Info</h3>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Type" value={resource.type} />
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
              <InfoRow label="File Size" value={resource.fileSizeLabel ?? "—"} />
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
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value}</dd>
    </div>
  );
}
