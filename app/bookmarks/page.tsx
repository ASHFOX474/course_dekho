"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Bookmark as BookmarkIcon, FileQuestion, Layers, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useData } from "@/lib/store/DataContext";
import { Bookmark } from "@/lib/types";
import { formatRelativeTime, cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { ResourceTypeIcon } from "@/components/ui/ResourceTypeIcon";

type FilterTab = "All" | "Courses" | "Topics" | "Resources" | "Questions";

function matchesFilter(bookmark: Bookmark, filter: FilterTab): boolean {
  if (filter === "All") return true;
  if (filter === "Courses") return bookmark.targetType === "course";
  if (filter === "Topics") return bookmark.targetType === "topic";
  if (filter === "Questions") return bookmark.targetType === "resource" && bookmark.resourceType === "Question";
  // "Resources" = any resource bookmark that ISN'T a Question (those get their own tab)
  return bookmark.targetType === "resource" && bookmark.resourceType !== "Question";
}

function targetHref(bookmark: Bookmark): string {
  if (bookmark.targetType === "course") return `/courses/${bookmark.targetId}`;
  if (bookmark.targetType === "resource") return `/resources/${bookmark.targetId}`;
  return "/courses"; // topic bookmarks don't have their own page without a course id, so send them browsing
}

const targetIcon: Record<Bookmark["targetType"], typeof BookOpen> = {
  course: BookOpen,
  topic: Layers,
  resource: FileQuestion,
};

export default function BookmarksPage() {
  const { user } = useAuth();
  const { bookmarks, removeBookmark } = useData();
  const [filter, setFilter] = useState<FilterTab>("All");
  const [search, setSearch] = useState("");

  const myBookmarks = useMemo(
    () => (user ? bookmarks.filter((b) => b.userId === user.id) : []),
    [bookmarks, user]
  );

  const counts: Record<FilterTab, number> = {
    All: myBookmarks.length,
    Courses: myBookmarks.filter((b) => matchesFilter(b, "Courses")).length,
    Topics: myBookmarks.filter((b) => matchesFilter(b, "Topics")).length,
    Resources: myBookmarks.filter((b) => matchesFilter(b, "Resources")).length,
    Questions: myBookmarks.filter((b) => matchesFilter(b, "Questions")).length,
  };

  const visible = myBookmarks
    .filter((b) => matchesFilter(b, filter))
    .filter((b) => (search.trim() ? b.title.toLowerCase().includes(search.trim().toLowerCase()) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <AppShell title="Bookmarks">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">My Bookmarks</h2>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bookmarks..."
              className="rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-violet-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(counts) as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === tab ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 text-slate-600 hover:border-violet-300"
              )}
            >
              {tab} ({counts[tab]})
            </button>
          ))}
        </div>

        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {visible.map((bookmark) => {
            const Icon = targetIcon[bookmark.targetType];
            return (
              <div key={bookmark.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={targetHref(bookmark)} className="flex min-w-0 flex-1 items-center gap-3">
                  {bookmark.targetType === "resource" && bookmark.resourceType ? (
                    <ResourceTypeIcon type={bookmark.resourceType} />
                  ) : (
                    <span className="flex items-center justify-center rounded-md bg-violet-50 p-1.5 text-violet-600">
                      <Icon size={16} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{bookmark.title}</p>
                    <p className="truncate text-xs text-slate-400">{bookmark.subtitle}</p>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-400">{formatRelativeTime(bookmark.createdAt)}</span>
                  <button
                    onClick={() => removeBookmark(bookmark.id)}
                    title="Remove bookmark"
                    className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-400">
              <BookmarkIcon size={28} />
              <p className="text-sm">No bookmarks here yet.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
