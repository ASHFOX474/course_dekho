import type { StoredFile } from "../storage/files.ts";
import type { ResourceEdit } from '../../resource-edit.ts';
import { queryCreateResourceEdit } from '../db/queries/resource-edit-queries.ts';
import {
  queryRemoveResource,
  queryAccessHistory,
  queryAdminStats,
  queryAllSubmissions,
  queryApproveSubmission,
  queryBookmarks,
  queryCreateBookmark,
  queryCreateEnrollment,
  queryCreateSubmission,
  queryDeleteBookmark,
  queryLearningCourses,
  queryContinueLearning,
  queryDisplayPreference,
  queryEnrollmentRequestsByUser,
  queryEnrollmentRequestsForAdmin,
  queryRecordFolderActivity,
  queryResourceCompletions,
  queryReviewEnrollment,
  querySetResourceCompletion,
  queryUpdateDisplayPreference,
  queryMarkSolved,
  queryRecordAccess,
  queryRejectSubmission,
  querySolvedQuestions,
  queryTopicProgress,
  queryUserProfile,
} from "../db/queries/workspace-queries.ts";
import {
  querySubmissionByPublicId,
  querySubmissionsByContributor,
} from "../db/queries/submission-queries.ts";
import {
  accessHistoryRowToDomain,
  adminStatsRowToDomain,
  bookmarkRowToDomain,
  learningCourseRowToDomain,
  enrollmentRequestRowToDomain,
  solvedQuestionRowToDomain,
  submissionRowToDomain,
  topicProgressRowToDomain,
  userProfileRowToDomain,
} from "../db/row-mappers.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import type {
  AccessHistoryView,
  AdminStats,
  BookmarkTargetType,
  BookmarkView,
  ContinueLearningTarget,
  DisplayTheme,
  EnrollmentRequest,
  LearningOverview,
  ResourceType,
  SolvedQuestionView,
  Submission,
  UserProfile,
} from "../domain/models.ts";

export interface WorkspaceRepository {
  createResourceEdit(resourceId: string, actorId: string, input: ResourceEdit): Promise<string | null>;
  removeResource(resourceId: string): Promise<boolean>;
  getProfile(userId: string): Promise<UserProfile | null>;
  getLearning(userId: string): Promise<LearningOverview>;
  listBookmarks(userId: string): Promise<BookmarkView[]>;
  createBookmark(userId: string, targetType: BookmarkTargetType, targetId: string): Promise<BookmarkView | null>;
  deleteBookmark(userId: string, bookmarkId: string): Promise<boolean>;
  createEnrollment(userId: string, courseId: string): Promise<EnrollmentRequest | null>;
  listEnrollmentRequests(userId: string): Promise<EnrollmentRequest[]>;
  listEnrollmentRequestsForAdmin(): Promise<EnrollmentRequest[]>;
  reviewEnrollment(input: { enrollmentId: string; reviewerId: string; decision: "approved" | "rejected"; reason: string | null; reviewedAt: Date }): Promise<boolean>;
  listResourceCompletions(userId: string, topicId: string): Promise<string[]>;
  setResourceCompletion(userId: string, resourceId: string, completed: boolean, now: Date): Promise<boolean>;
  recordFolderActivity(userId: string, courseId: string, topicId: string | null, openedAt: Date): Promise<boolean>;
  getContinueLearning(userId: string): Promise<ContinueLearningTarget>;
  getDisplayPreference(userId: string): Promise<DisplayTheme>;
  updateDisplayPreference(userId: string, theme: DisplayTheme, now: Date): Promise<boolean>;
  listAccessHistory(userId: string): Promise<AccessHistoryView[]>;
  recordAccess(userId: string, resourceId: string): Promise<boolean>;
  listSolvedQuestions(userId: string): Promise<SolvedQuestionView[]>;
  markSolved(userId: string, resourceId: string): Promise<boolean>;
  listSubmissionsByContributor(contributorId: string): Promise<Submission[]>;
  listAllSubmissions(): Promise<Submission[]>;
  findSubmission(submissionId: string): Promise<Submission | null>;
  createSubmission(input: {
    contributorId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    topicId: string;
    externalUrl?: string;
    file?: StoredFile;
  }): Promise<Submission | null>;
  approveSubmission(input: {
    submissionId: string;
    reviewerId: string;
    reviewedAt: Date;
  }): Promise<Submission | null>;
  rejectSubmission(input: {
    submissionId: string;
    reviewerId: string;
    reason: string;
    reviewedAt: Date;
  }): Promise<Submission | null>;
  getAdminStats(): Promise<AdminStats>;
}

export class PostgresWorkspaceRepository implements WorkspaceRepository {
  createResourceEdit(resourceId: string, actorId: string, input: ResourceEdit): Promise<string | null> {
    return queryCreateResourceEdit(this.executor, resourceId, actorId, input);
  }
  private readonly executor: DatabaseExecutor;

  constructor(executor: DatabaseExecutor) {
    this.executor = executor;
  }

  removeResource(resourceId: string): Promise<boolean> {
    return queryRemoveResource(this.executor, resourceId);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const row = await queryUserProfile(this.executor, userId);
    return row ? userProfileRowToDomain(row) : null;
  }

  async getLearning(userId: string): Promise<LearningOverview> {
    const [courses, topics, enrollmentRequests] = await Promise.all([
      queryLearningCourses(this.executor, userId),
      queryTopicProgress(this.executor, userId),
      queryEnrollmentRequestsByUser(this.executor, userId),
    ]);
    return {
      courses: courses.map(learningCourseRowToDomain),
      topics: topics.map(topicProgressRowToDomain),
      enrollmentRequests: enrollmentRequests.map(enrollmentRequestRowToDomain),
    };
  }

  async listBookmarks(userId: string): Promise<BookmarkView[]> {
    return (await queryBookmarks(this.executor, userId)).map(bookmarkRowToDomain);
  }

  async createBookmark(
    userId: string,
    targetType: BookmarkTargetType,
    targetId: string
  ): Promise<BookmarkView | null> {
    await queryCreateBookmark(this.executor, userId, targetType, targetId);
    const bookmarks = await this.listBookmarks(userId);
    return bookmarks.find(
      (bookmark) => bookmark.targetType === targetType && bookmark.targetId === targetId
    ) ?? null;
  }

  deleteBookmark(userId: string, bookmarkId: string): Promise<boolean> {
    return queryDeleteBookmark(this.executor, userId, bookmarkId);
  }

  async createEnrollment(userId: string, courseId: string): Promise<EnrollmentRequest | null> {
    await queryCreateEnrollment(this.executor, userId, courseId);
    return (await this.listEnrollmentRequests(userId)).find(request => request.courseId === courseId) ?? null;
  }

  async listEnrollmentRequests(userId: string): Promise<EnrollmentRequest[]> {
    return (await queryEnrollmentRequestsByUser(this.executor, userId)).map(enrollmentRequestRowToDomain);
  }

  async listEnrollmentRequestsForAdmin(): Promise<EnrollmentRequest[]> {
    return (await queryEnrollmentRequestsForAdmin(this.executor)).map(enrollmentRequestRowToDomain);
  }

  reviewEnrollment(input: { enrollmentId: string; reviewerId: string; decision: "approved" | "rejected"; reason: string | null; reviewedAt: Date }): Promise<boolean> {
    return queryReviewEnrollment(this.executor, input);
  }

  async listResourceCompletions(userId: string, topicId: string): Promise<string[]> {
    return (await queryResourceCompletions(this.executor, userId, topicId)).map(row => row.content_public_id);
  }

  setResourceCompletion(userId: string, resourceId: string, completed: boolean, now: Date): Promise<boolean> {
    return querySetResourceCompletion(this.executor, userId, resourceId, completed, now);
  }

  recordFolderActivity(userId: string, courseId: string, topicId: string | null, openedAt: Date): Promise<boolean> {
    return queryRecordFolderActivity(this.executor, userId, courseId, topicId, openedAt);
  }

  async getContinueLearning(userId: string): Promise<ContinueLearningTarget> {
    const row = await queryContinueLearning(this.executor, userId);
    const courseId = row.course_public_id;
    const topicId = row.topic_public_id;
    return {
      courseId,
      topicId,
      href: topicId && courseId ? `/courses/${courseId}/topics/${topicId}` : courseId ? `/courses/${courseId}` : "/courses",
    };
  }

  async getDisplayPreference(userId: string): Promise<DisplayTheme> {
    return (await queryDisplayPreference(this.executor, userId)).theme;
  }

  updateDisplayPreference(userId: string, theme: DisplayTheme, now: Date): Promise<boolean> {
    return queryUpdateDisplayPreference(this.executor, userId, theme, now);
  }

  async listAccessHistory(userId: string): Promise<AccessHistoryView[]> {
    return (await queryAccessHistory(this.executor, userId)).map(accessHistoryRowToDomain);
  }

  recordAccess(userId: string, resourceId: string): Promise<boolean> {
    return queryRecordAccess(this.executor, userId, resourceId);
  }

  async listSolvedQuestions(userId: string): Promise<SolvedQuestionView[]> {
    return (await querySolvedQuestions(this.executor, userId)).map(solvedQuestionRowToDomain);
  }

  markSolved(userId: string, resourceId: string): Promise<boolean> {
    return queryMarkSolved(this.executor, userId, resourceId);
  }

  async listSubmissionsByContributor(contributorId: string): Promise<Submission[]> {
    return (await querySubmissionsByContributor(this.executor, contributorId)).map(submissionRowToDomain);
  }

  async listAllSubmissions(): Promise<Submission[]> {
    return (await queryAllSubmissions(this.executor)).map(submissionRowToDomain);
  }

  async findSubmission(submissionId: string): Promise<Submission | null> {
    const row = await querySubmissionByPublicId(this.executor, submissionId);
    return row ? submissionRowToDomain(row) : null;
  }

  async createSubmission(input: {
    contributorId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    topicId: string;
    externalUrl?: string;
    file?: StoredFile;
  }): Promise<Submission | null> {
    const id = await queryCreateSubmission(this.executor, input);
    return id ? this.findSubmission(id) : null;
  }

  async approveSubmission(input: {
    submissionId: string;
    reviewerId: string;
    reviewedAt: Date;
  }): Promise<Submission | null> {
    const changed = await queryApproveSubmission(this.executor, input);
    return changed ? this.findSubmission(input.submissionId) : null;
  }

  async rejectSubmission(input: {
    submissionId: string;
    reviewerId: string;
    reason: string;
    reviewedAt: Date;
  }): Promise<Submission | null> {
    const changed = await queryRejectSubmission(this.executor, input);
    return changed ? this.findSubmission(input.submissionId) : null;
  }

  async getAdminStats(): Promise<AdminStats> {
    return adminStatsRowToDomain(await queryAdminStats(this.executor));
  }
}
