/**
 * lib/data/activity.ts
 * ------------------------------------------------------------------
 * Mock data for the student-activity side of the ERD:
 *   TopicProgress      -> "how far through each topic is this user?"
 *   AccessHistoryEntry -> "what did this user open, and when?"
 *   SolvedQuestion     -> "which Question resources has this user solved?"
 *
 * All of this belongs to the demo STUDENT account (u-student-1) so the
 * Student dashboard / progress / access-history pages have realistic
 * numbers to display. Teachers and admins don't need seeded progress.
 * ------------------------------------------------------------------
 */
import { AccessHistoryEntry, SolvedQuestion, TopicProgress } from "@/lib/types";
import { hoursAgoIso, daysAgoIso } from "@/lib/utils";

const STUDENT_ID = "u-student-1";

/**
 * Topic progress for the demo student.
 * CSE-211 mirrors the roadmap shown in the mockup exactly:
 * Array / Linked List / Stack & Queue / Tree = done, Graph = 60% (current),
 * Greedy / DP = not started.
 */
export const initialProgress: TopicProgress[] = [
  // ---- CSE-211: Data Structures & Algorithms ----
  { userId: STUDENT_ID, topicId: "topic-array", courseId: "cse-211", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(30) },
  { userId: STUDENT_ID, topicId: "topic-linked-list", courseId: "cse-211", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(24) },
  { userId: STUDENT_ID, topicId: "topic-stack-queue", courseId: "cse-211", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(18) },
  { userId: STUDENT_ID, topicId: "topic-tree", courseId: "cse-211", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(10) },
  { userId: STUDENT_ID, topicId: "topic-graph", courseId: "cse-211", progressPercent: 60, completed: false, lastAccessedAt: hoursAgoIso(1) },
  { userId: STUDENT_ID, topicId: "topic-greedy", courseId: "cse-211", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(30) },
  { userId: STUDENT_ID, topicId: "topic-dp", courseId: "cse-211", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(30) },

  // ---- CSE-213: Discrete Mathematics ----
  { userId: STUDENT_ID, topicId: "topic-logic", courseId: "cse-213", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(20) },
  { userId: STUDENT_ID, topicId: "topic-set-theory", courseId: "cse-213", progressPercent: 80, completed: false, lastAccessedAt: daysAgoIso(5) },
  { userId: STUDENT_ID, topicId: "topic-combinatorics", courseId: "cse-213", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(20) },
  { userId: STUDENT_ID, topicId: "topic-graph-theory-dm", courseId: "cse-213", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(20) },

  // ---- CSE-216: Digital Logic Design ----
  { userId: STUDENT_ID, topicId: "topic-boolean-algebra", courseId: "cse-216", progressPercent: 80, completed: false, lastAccessedAt: daysAgoIso(6) },
  { userId: STUDENT_ID, topicId: "topic-combinational-circuits", courseId: "cse-216", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(15) },
  { userId: STUDENT_ID, topicId: "topic-sequential-circuits", courseId: "cse-216", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(15) },
  { userId: STUDENT_ID, topicId: "topic-digital-systems", courseId: "cse-216", progressPercent: 0, completed: false, lastAccessedAt: daysAgoIso(15) },

  // ---- CSE-222: Database Systems ----
  { userId: STUDENT_ID, topicId: "topic-er-model", courseId: "cse-222", progressPercent: 100, completed: true, lastAccessedAt: daysAgoIso(12) },
  { userId: STUDENT_ID, topicId: "topic-normalization", courseId: "cse-222", progressPercent: 90, completed: false, lastAccessedAt: daysAgoIso(3) },
  { userId: STUDENT_ID, topicId: "topic-sql", courseId: "cse-222", progressPercent: 35, completed: false, lastAccessedAt: daysAgoIso(7) },
];

/** "Recent Access" feed shown on the student dashboard. Newest first. */
export const initialAccessHistory: AccessHistoryEntry[] = [
  {
    id: "access-1",
    userId: STUDENT_ID,
    resourceId: "res-dp-1",
    resourceTitle: "Dynamic Programming Notes",
    resourceType: "Study Material",
    courseCode: "CSE-211",
    topicName: "Dynamic Programming",
    accessedAt: hoursAgoIso(2),
  },
  {
    id: "access-2",
    userId: STUDENT_ID,
    resourceId: "res-graph-3",
    resourceTitle: "BUET Final 2024 (Graph)",
    resourceType: "Question",
    courseCode: "CSE-211",
    topicName: "Graph",
    accessedAt: hoursAgoIso(5),
  },
  {
    id: "access-3",
    userId: STUDENT_ID,
    resourceId: "res-graph-2",
    resourceTitle: "Graph Traversal Tutorial",
    resourceType: "Tutorial",
    courseCode: "CSE-211",
    topicName: "Graph",
    accessedAt: daysAgoIso(1),
  },
  {
    id: "access-4",
    userId: STUDENT_ID,
    resourceId: "res-ll-1",
    resourceTitle: "Linked List Slide",
    resourceType: "Slide",
    courseCode: "CSE-211",
    topicName: "Linked List",
    accessedAt: daysAgoIso(2),
  },
  {
    id: "access-5",
    userId: STUDENT_ID,
    resourceId: "res-norm-1",
    resourceTitle: "Database Normalization Notes",
    resourceType: "Study Material",
    courseCode: "CSE-222",
    topicName: "Normalization",
    accessedAt: daysAgoIso(3),
  },
  {
    id: "access-6",
    userId: STUDENT_ID,
    resourceId: "res-graph-1",
    resourceTitle: "Graph Theory Notes",
    resourceType: "Study Material",
    courseCode: "CSE-211",
    topicName: "Graph",
    accessedAt: daysAgoIso(4),
  },
];

/** Which Question-type resources the demo student has already solved. */
export const initialSolvedQuestions: SolvedQuestion[] = [
  { userId: STUDENT_ID, questionResourceId: "res-graph-3", solvedAt: daysAgoIso(4) },
];
