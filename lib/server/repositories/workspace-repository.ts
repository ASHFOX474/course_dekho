import {
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
  queryMarkSolved,
  queryRecordAccess,
  queryRejectSubmission,
  querySolvedQuestions,
  queryTopicProgress,
  queryUpdateProgress,
  queryUserProfile,
} from "../db/queries/workspace-queries.ts";
import {
  querySubmissionByPublicId,
  querySubmissionsByTeacher,
} from "../db/queries/submission-queries.ts";
import {
  accessHistoryRowToDomain,
  adminStatsRowToDomain,
  bookmarkRowToDomain,
  learningCourseRowToDomain,
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
  LearningOverview,
  ResourceType,
  SolvedQuestionView,
  Submission,
  UserProfile,
} from "../domain/models.ts";

export interface WorkspaceRepository {
  getProfile(userId: string): Promise<UserProfile | null>;
  getLearning(userId: string): Promise<LearningOverview>;
  listBookmarks(userId: string): Promise<BookmarkView[]>;
  createBookmark(userId: string, targetType: BookmarkTargetType, targetId: string): Promise<BookmarkView | null>;
  deleteBookmark(userId: string, bookmarkId: string): Promise<boolean>;
  createEnrollment(userId: string, courseId: string): Promise<string | null>;
  updateProgress(userId: string, topicId: string, progressPercent: number, now: Date): Promise<boolean>;
  listAccessHistory(userId: string): Promise<AccessHistoryView[]>;
  recordAccess(userId: string, resourceId: string): Promise<boolean>;
  listSolvedQuestions(userId: string): Promise<SolvedQuestionView[]>;
  markSolved(userId: string, resourceId: string): Promise<boolean>;
  listSubmissionsByTeacher(teacherId: string): Promise<Submission[]>;
  listAllSubmissions(): Promise<Submission[]>;
  findSubmission(submissionId: string): Promise<Submission | null>;
  createSubmission(input: {
    teacherId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    topicId: string;
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
  private readonly executor: DatabaseExecutor;

  constructor(executor: DatabaseExecutor) {
    this.executor = executor;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const row = await queryUserProfile(this.executor, userId);
    return row ? userProfileRowToDomain(row) : null;
  }

  async getLearning(userId: string): Promise<LearningOverview> {
    const [courses, topics] = await Promise.all([
      queryLearningCourses(this.executor, userId),
      queryTopicProgress(this.executor, userId),
    ]);
    return {
      courses: courses.map(learningCourseRowToDomain),
      topics: topics.map(topicProgressRowToDomain),
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

  createEnrollment(userId: string, courseId: string): Promise<string | null> {
    return queryCreateEnrollment(this.executor, userId, courseId);
  }

  updateProgress(
    userId: string,
    topicId: string,
    progressPercent: number,
    now: Date
  ): Promise<boolean> {
    return queryUpdateProgress(this.executor, userId, topicId, progressPercent, now);
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

  async listSubmissionsByTeacher(teacherId: string): Promise<Submission[]> {
    return (await querySubmissionsByTeacher(this.executor, teacherId)).map(submissionRowToDomain);
  }

  async listAllSubmissions(): Promise<Submission[]> {
    return (await queryAllSubmissions(this.executor)).map(submissionRowToDomain);
  }

  async findSubmission(submissionId: string): Promise<Submission | null> {
    const row = await querySubmissionByPublicId(this.executor, submissionId);
    return row ? submissionRowToDomain(row) : null;
  }

  async createSubmission(input: {
    teacherId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    topicId: string;
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
