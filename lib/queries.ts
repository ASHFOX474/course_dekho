/**
 * lib/queries.ts
 * ------------------------------------------------------------------
 * The "service layer" of the app.
 *
 * Nothing in here is hardcoded — every number (progress %, stat card
 * counts, etc.) is DERIVED from the raw mock-data tables. This is the
 * layer you would swap out for real `fetch("/api/...")` calls once
 * the Postgres backend is ready; the React components wouldn't need
 * to change at all.
 * ------------------------------------------------------------------
 */
import { courses, getCourseById, getTopicsByCourse } from "@/lib/data/academics";
import { TopicProgress, Course } from "@/lib/types";
import { clampPercent } from "@/lib/utils";

/** Average progress (0-100) across every topic of a course for one user. */
export function computeCourseProgress(progress: TopicProgress[], courseId: string): number {
  const topicIds = getTopicsByCourse(courseId).map((t) => t.id);
  if (topicIds.length === 0) return 0;

  const relevant = progress.filter((p) => topicIds.includes(p.topicId));
  if (relevant.length === 0) return 0;

  const total = relevant.reduce((sum, p) => sum + p.progressPercent, 0);
  return clampPercent(total / topicIds.length);
}

/** A course counts as "enrolled" once the user has at least one progress record in it. */
export function getEnrolledCourses(progress: TopicProgress[]): Course[] {
  const enrolledIds = new Set(progress.map((p) => p.courseId));
  return courses.filter((c) => enrolledIds.has(c.id));
}

export interface DashboardStats {
  enrolledCoursesCount: number;
  topicsInProgressCount: number; // started, but not yet completed
  completedTopicsCount: number;
  bookmarksCount: number;
}

/** Computes the four stat cards on the student dashboard. */
export function getDashboardStats(progress: TopicProgress[], bookmarksCount: number): DashboardStats {
  const enrolledCoursesCount = getEnrolledCourses(progress).length;
  const completedTopicsCount = progress.filter((p) => p.completed).length;
  const topicsInProgressCount = progress.filter((p) => !p.completed && p.progressPercent > 0).length;

  return {
    enrolledCoursesCount,
    topicsInProgressCount,
    completedTopicsCount,
    bookmarksCount,
  };
}

/**
 * Picks the single topic the student should "Continue Learning" —
 * the most recently accessed topic that isn't finished yet.
 */
export function getContinueLearningTopic(progress: TopicProgress[]) {
  const inProgress = progress.filter((p) => !p.completed && p.progressPercent > 0);
  if (inProgress.length === 0) return undefined;

  const mostRecent = [...inProgress].sort(
    (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  )[0];

  const topic = getTopicsByCourse(mostRecent.courseId).find((t) => t.id === mostRecent.topicId);
  const course = getCourseById(mostRecent.courseId);
  if (!topic || !course) return undefined;

  return { topic, course, progress: mostRecent };
}

/** Progress % + status icon info for a single topic, used on the roadmap page. */
export function getTopicProgress(progress: TopicProgress[], topicId: string): TopicProgress | undefined {
  return progress.find((p) => p.topicId === topicId);
}
