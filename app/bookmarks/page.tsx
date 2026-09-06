"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Bookmark as BookmarkIcon, FileQuestion, Layers, Search, Trash2 } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";
import { useAuth } from "@/lib/auth/AuthContext";
import { resourceTypeLabel } from "@/lib/client/catalog-api";
import { deleteBookmark, listBookmarks, type BookmarkDto } from "@/lib/client/workspace-api";
import { useDatabaseData } from "@/lib/client/use-database-data";
import { cn, formatRelativeTime } from "@/lib/utils";

type FilterTab = "All" | "Courses" | "Topics" | "Resources" | "Questions";

function matchesFilter(bookmark: BookmarkDto, filter: FilterTab): boolean {
  if (filter === "All") return true;
  if (filter === "Courses") return bookmark.targetType === "course";
  if (filter === "Topics") return bookmark.targetType === "topic";
  if (filter === "Questions") return bookmark.targetType === "resource" && bookmark.resourceType === "question";
  return bookmark.targetType === "resource" && bookmark.resourceType !== "question";
}

function targetHref(bookmark: BookmarkDto): string {
  if (bookmark.targetType === "course") return `/courses/${bookmark.targetId}`;
  if (bookmark.targetType === "resource") return `/resources/${bookmark.targetId}`;
  return bookmark.courseId ? `/courses/${bookmark.courseId}/topics/${bookmark.targetId}` : "/courses";
}

const targetIcon = { course: BookOpen, topic: Layers, resource: FileQuestion };

export default function BookmarksPage() {
  const { user } = useAuth();
  const { data: bookmarks, setData: setBookmarks, isLoading, error, refresh } = useDatabaseData(
    `bookmarks:${user?.id ?? "anonymous"}`,
    listBookmarks,
    []
  );
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(
    (["All", "Courses", "Topics", "Resources", "Questions"] as FilterTab[]).map((tab) => [
      tab,
      bookmarks.filter((bookmark) => matchesFilter(bookmark, tab)).length,
    ])
  ) as Record<FilterTab, number>, [bookmarks]);
  const visible = useMemo(() => bookmarks
    .filter((bookmark) => matchesFilter(bookmark, filter))
    .filter((bookmark) => !search.trim() || bookmark.title.toLowerCase().includes(search.trim().toLowerCase())),
  [bookmarks, filter, search]);

  async function remove(id: string) {
    setRemovingId(id);
    setMutationError(null);
    try {
      await deleteBookmark(id);
      setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
      refresh();
    } catch (requestError) {
      setMutationError(requestError instanceof Error ? requestError.message : "Unable to remove bookmark.");
    } finally { setRemovingId(null); }
  }

  return <AppShell title="Bookmarks"><div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">My Bookmarks</h2><p className="text-sm text-slate-500">Saved targets from PostgreSQL.</p></div>
      <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bookmarks..." className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-violet-400 focus:outline-none" /></div>
    </div>
    {(error || mutationError) && <p role="alert" className="text-sm text-rose-600">{mutationError ?? error}</p>}
    <div className="flex flex-wrap gap-2">{(Object.keys(counts) as FilterTab[]).map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", filter === tab ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600")}>{tab} ({counts[tab]})</button>)}</div>
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm" aria-busy={isLoading}>
      {visible.map((bookmark) => {
        const Icon = targetIcon[bookmark.targetType];
        return <div key={bookmark.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href={targetHref(bookmark)} className="flex min-w-0 flex-1 items-center gap-3">
            {bookmark.targetType === "resource" && bookmark.resourceType ? <ResourceTypeIcon type={resourceTypeLabel(bookmark.resourceType)} /> : <span className="rounded-md bg-violet-50 p-1.5 text-violet-600"><Icon size={16} /></span>}
            <span className="min-w-0"><p className="truncate text-sm font-medium text-slate-800">{bookmark.title}</p><p className="truncate text-xs text-slate-400">{bookmark.subtitle}</p></span>
          </Link>
          <div className="flex shrink-0 items-center gap-3"><span className="text-xs text-slate-400">{formatRelativeTime(bookmark.createdAt)}</span><button onClick={() => void remove(bookmark.id)} disabled={removingId === bookmark.id} title="Remove bookmark" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={15} /></button></div>
        </div>;
      })}
      {!isLoading && visible.length === 0 && <div className="flex flex-col items-center gap-2 py-14 text-slate-400"><BookmarkIcon size={28} /><p className="text-sm">No bookmarks here yet.</p></div>}
    </div>
  </div></AppShell>;
}
