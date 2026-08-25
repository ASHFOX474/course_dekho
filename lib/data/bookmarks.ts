/**
 * lib/data/bookmarks.ts
 * ------------------------------------------------------------------
 * Seed data for the "bookmarks" table.
 *
 * Per the spec, a user can bookmark ANYTHING — not just resources —
 * so this seed set deliberately includes one course-level, one
 * topic-level, and several resource-level bookmarks.
 *
 * Like submissions, this is only the INITIAL state; runtime
 * add/remove happens through DataProvider (lib/store/DataContext.tsx).
 * ------------------------------------------------------------------
 */
import { Bookmark } from "@/lib/types";
import { daysAgoIso } from "@/lib/utils";

const STUDENT_ID = "u-student-1";

export const initialBookmarks: Bookmark[] = [
  {
    id: "bm-1",
    userId: STUDENT_ID,
    targetType: "resource",
    targetId: "res-dp-1",
    title: "Dynamic Programming Notes",
    subtitle: "CSE-211 > Dynamic Programming",
    resourceType: "Study Material",
    createdAt: daysAgoIso(2),
  },
  {
    id: "bm-2",
    userId: STUDENT_ID,
    targetType: "resource",
    targetId: "res-graph-3",
    title: "BUET DSA Final 2024",
    subtitle: "CSE-211 > Graph",
    resourceType: "Question",
    createdAt: daysAgoIso(3),
  },
  {
    id: "bm-3",
    userId: STUDENT_ID,
    targetType: "resource",
    targetId: "res-norm-1",
    title: "Database Normalization Notes",
    subtitle: "CSE-222 > Normalization",
    resourceType: "Study Material",
    createdAt: daysAgoIso(6),
  },
  {
    id: "bm-4",
    userId: STUDENT_ID,
    targetType: "resource",
    targetId: "res-dp-2",
    title: "LeetCode DP Problems List",
    subtitle: "CSE-211 > Dynamic Programming",
    resourceType: "LeetCode Problem",
    createdAt: daysAgoIso(9),
  },
  {
    id: "bm-5",
    userId: STUDENT_ID,
    targetType: "topic",
    targetId: "topic-graph",
    title: "Graph",
    subtitle: "CSE-211 > Topic",
    createdAt: daysAgoIso(11),
  },
  {
    id: "bm-6",
    userId: STUDENT_ID,
    targetType: "course",
    targetId: "cse-222",
    title: "CSE-222: Database Systems",
    subtitle: "BUET > Course",
    createdAt: daysAgoIso(15),
  },
];
