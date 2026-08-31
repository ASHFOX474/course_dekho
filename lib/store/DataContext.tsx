"use client";

/**
 * lib/store/DataContext.tsx
 * ------------------------------------------------------------------
 * Holds the parts of the mock "database" that the UI can actually
 * WRITE to during a session:
 *
 *   - resources   (grows when an admin approves a submission)
 *   - submissions (grows when a teacher submits new content;
 *                  status changes when an admin approves/rejects)
 *   - bookmarks   (grows/shrinks when a user bookmarks/unbookmarks)
 *
 * Everything lives in React state, seeded from lib/data/*. This means
 * changes only last for the current browser session (refreshing the
 * page resets the demo data) — which is expected for a frontend-only
 * prototype. Swapping this for real API calls later is a matter of
 * changing the function BODIES below, not the components that use them.
 * ------------------------------------------------------------------
 */
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { resources as initialResources } from "@/lib/data/resources";
import { initialSubmissions } from "@/lib/data/submissions";
import { initialBookmarks } from "@/lib/data/bookmarks";
import {
  WorkflowPolicyError,
  approvePendingSubmission,
  createPendingSubmission,
  rejectPendingSubmission,
  type NewSubmissionInput,
} from "@/lib/domain/critical-behavior";
import { Bookmark, BookmarkTargetType, Resource, ResourceType, Submission } from "@/lib/types";

export type { NewSubmissionInput } from "@/lib/domain/critical-behavior";

/** Fields needed to bookmark something (id/createdAt are generated). */
export interface NewBookmarkInput {
  targetType: BookmarkTargetType;
  targetId: string;
  title: string;
  subtitle: string;
  resourceType?: ResourceType;
}

interface DataContextValue {
  resources: Resource[];
  submissions: Submission[];
  bookmarks: Bookmark[];

  addSubmission: (input: NewSubmissionInput) => void;
  approveSubmission: (submissionId: string) => void;
  rejectSubmission: (submissionId: string, reason: string) => void;

  isBookmarked: (targetType: BookmarkTargetType, targetId: string) => boolean;
  toggleBookmark: (input: NewBookmarkInput) => void;
  removeBookmark: (bookmarkId: string) => void;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

let nextId = 1000; // simple incrementing id generator for newly-created rows

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [contentState, setContentState] = useState<{ resources: Resource[]; submissions: Submission[] }>({
    resources: initialResources,
    submissions: initialSubmissions,
  });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks);
  const { resources, submissions } = contentState;

  // ---- Teacher: create a new submission (status starts "pending") ----
  function addSubmission(input: NewSubmissionInput) {
    if (!user) return;

    const submissionId = `sub-${nextId++}`;
    const now = new Date().toISOString();

    setContentState((prev) => {
      try {
        const submission = createPendingSubmission(user, input, { submissionId, now });
        return { ...prev, submissions: [submission, ...prev.submissions] };
      } catch (error) {
        if (error instanceof WorkflowPolicyError) return prev;
        throw error;
      }
    });
  }

  // ---- Admin: approve a pending submission -> publishes a live Resource ----
  function approveSubmission(submissionId: string) {
    if (!user) return;

    const resourceId = `res-${nextId++}`;
    const now = new Date().toISOString();

    setContentState((prev) => {
      const submission = prev.submissions.find((item) => item.id === submissionId);
      if (!submission) return prev;

      try {
        const approved = approvePendingSubmission(user, submission, { resourceId, now });
        return {
          resources: [approved.resource, ...prev.resources],
          submissions: prev.submissions.map((item) =>
            item.id === submissionId ? approved.submission : item
          ),
        };
      } catch (error) {
        if (error instanceof WorkflowPolicyError) return prev;
        throw error;
      }
    });
  }

  // ---- Admin: reject a pending submission (with a reason the teacher can see) ----
  function rejectSubmission(submissionId: string, reason: string) {
    if (!user) return;

    const now = new Date().toISOString();

    setContentState((prev) => {
      const submission = prev.submissions.find((item) => item.id === submissionId);
      if (!submission) return prev;

      try {
        const rejected = rejectPendingSubmission(user, submission, reason, now);
        return {
          ...prev,
          submissions: prev.submissions.map((item) => (item.id === submissionId ? rejected : item)),
        };
      } catch (error) {
        if (error instanceof WorkflowPolicyError) return prev;
        throw error;
      }
    });
  }

  // ---- Bookmarks (any logged-in user, any target type) ----
  function isBookmarked(targetType: BookmarkTargetType, targetId: string) {
    if (!user) return false;
    return bookmarks.some((b) => b.userId === user.id && b.targetType === targetType && b.targetId === targetId);
  }

  function toggleBookmark(input: NewBookmarkInput) {
    if (!user) return;

    const existing = bookmarks.find(
      (b) => b.userId === user.id && b.targetType === input.targetType && b.targetId === input.targetId
    );

    if (existing) {
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
      return;
    }

    const bookmark: Bookmark = {
      id: `bm-${nextId++}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      ...input,
    };
    setBookmarks((prev) => [bookmark, ...prev]);
  }

  function removeBookmark(bookmarkId: string) {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  }

  const value = useMemo<DataContextValue>(
    () => ({
      resources,
      submissions,
      bookmarks,
      addSubmission,
      approveSubmission,
      rejectSubmission,
      isBookmarked,
      toggleBookmark,
      removeBookmark,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- functions close over state intentionally
    [resources, submissions, bookmarks, user]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData() must be called from inside <DataProvider>.");
  }
  return context;
}
