import type { Pool } from "pg";

import { ConflictError, InvalidTransitionError, NotFoundError } from "../api/errors.ts";
import { requireRole } from "../auth/authorization.ts";
import { withTransaction } from "../db/transaction.ts";
import type {
  AuthenticatedUser,
  BookmarkTargetType,
  ResourceType,
} from "../domain/models.ts";
import {
  PostgresWorkspaceRepository,
  type WorkspaceRepository,
} from "../repositories/workspace-repository.ts";
import type { DatabaseExecutor } from "../db/executor.ts";

const learnerRoles = ["student", "teacher"] as const;
const allRoles = ["student", "teacher", "admin"] as const;

interface WorkspaceServiceDependencies {
  pool: Pick<Pool, "connect" | "query">;
  repositoryFactory?: (executor: DatabaseExecutor) => WorkspaceRepository;
  now?: () => Date;
}

export class WorkspaceService {
  private readonly pool: Pick<Pool, "connect" | "query">;
  private readonly repositoryFactory: (executor: DatabaseExecutor) => WorkspaceRepository;
  private readonly now: () => Date;

  constructor(dependencies: WorkspaceServiceDependencies) {
    this.pool = dependencies.pool;
    this.repositoryFactory =
      dependencies.repositoryFactory ?? ((executor) => new PostgresWorkspaceRepository(executor));
    this.now = dependencies.now ?? (() => new Date());
  }

  private repository(): WorkspaceRepository {
    return this.repositoryFactory(this.pool as DatabaseExecutor);
  }

  async getProfile(actor: AuthenticatedUser) {
    requireRole(actor, allRoles);
    const profile = await this.repository().getProfile(actor.id);
    if (!profile) throw new NotFoundError("Profile not found.");
    return profile;
  }

  async getLearning(actor: AuthenticatedUser) {
    requireRole(actor, learnerRoles);
    return this.repository().getLearning(actor.id);
  }

  async listBookmarks(actor: AuthenticatedUser) {
    requireRole(actor, learnerRoles);
    return this.repository().listBookmarks(actor.id);
  }

  async createBookmark(
    actor: AuthenticatedUser,
    input: { targetType: BookmarkTargetType; targetId: string }
  ) {
    requireRole(actor, learnerRoles);
    const bookmark = await this.repository().createBookmark(actor.id, input.targetType, input.targetId);
    if (!bookmark) throw new NotFoundError("Bookmark target not found or unavailable.");
    return bookmark;
  }

  async deleteBookmark(actor: AuthenticatedUser, bookmarkId: string): Promise<void> {
    requireRole(actor, learnerRoles);
    if (!(await this.repository().deleteBookmark(actor.id, bookmarkId))) {
      throw new NotFoundError("Bookmark not found.");
    }
  }

  async createEnrollment(actor: AuthenticatedUser, courseId: string) {
    requireRole(actor, learnerRoles);
    const id = await this.repository().createEnrollment(actor.id, courseId);
    if (!id) throw new NotFoundError("Active course not found.");
    return { id };
  }

  async updateProgress(actor: AuthenticatedUser, topicId: string, progressPercent: number) {
    requireRole(actor, learnerRoles);
    if (!(await this.repository().updateProgress(actor.id, topicId, progressPercent, this.now()))) {
      throw new ConflictError("Progress requires an active enrollment for this topic's course.");
    }
    return this.repository().getLearning(actor.id);
  }

  async listAccessHistory(actor: AuthenticatedUser) {
    requireRole(actor, learnerRoles);
    return this.repository().listAccessHistory(actor.id);
  }

  async recordAccess(actor: AuthenticatedUser, resourceId: string): Promise<void> {
    requireRole(actor, learnerRoles);
    if (!(await this.repository().recordAccess(actor.id, resourceId))) {
      throw new NotFoundError("Approved active resource not found.");
    }
  }

  async listSolvedQuestions(actor: AuthenticatedUser) {
    requireRole(actor, learnerRoles);
    return this.repository().listSolvedQuestions(actor.id);
  }

  async markSolved(actor: AuthenticatedUser, resourceId: string) {
    requireRole(actor, learnerRoles);
    if (!(await this.repository().markSolved(actor.id, resourceId))) {
      throw new NotFoundError("Approved active question not found.");
    }
    return this.repository().listSolvedQuestions(actor.id);
  }

  async listSubmissions(actor: AuthenticatedUser) {
    requireRole(actor, ["teacher", "admin"]);
    return actor.role === "admin"
      ? this.repository().listAllSubmissions()
      : this.repository().listSubmissionsByTeacher(actor.id);
  }

  async createSubmission(
    actor: AuthenticatedUser,
    input: {
      resourceType: ResourceType;
      title: string;
      description: string;
      courseId: string;
      topicId: string;
    }
  ) {
    requireRole(actor, ["teacher"]);
    const submission = await this.repository().createSubmission({ teacherId: actor.id, ...input });
    if (!submission) throw new NotFoundError("Active course/topic combination not found.");
    return submission;
  }

  async approveSubmission(actor: AuthenticatedUser, submissionId: string) {
    requireRole(actor, ["admin"]);
    return withTransaction(this.pool, async (client) => {
      const repository = this.repositoryFactory(client);
      const reviewed = await repository.approveSubmission({
        submissionId,
        reviewerId: actor.id,
        reviewedAt: this.now(),
      });
      if (reviewed) return reviewed;
      const existing = await repository.findSubmission(submissionId);
      if (!existing) throw new NotFoundError("Submission not found.");
      throw new InvalidTransitionError("Only pending submissions can be approved.");
    });
  }

  async rejectSubmission(actor: AuthenticatedUser, submissionId: string, reason: string) {
    requireRole(actor, ["admin"]);
    return withTransaction(this.pool, async (client) => {
      const repository = this.repositoryFactory(client);
      const reviewed = await repository.rejectSubmission({
        submissionId,
        reviewerId: actor.id,
        reason,
        reviewedAt: this.now(),
      });
      if (reviewed) return reviewed;
      const existing = await repository.findSubmission(submissionId);
      if (!existing) throw new NotFoundError("Submission not found.");
      throw new InvalidTransitionError("Only pending submissions can be rejected.");
    });
  }

  async getAdminStats(actor: AuthenticatedUser) {
    requireRole(actor, ["admin"]);
    return this.repository().getAdminStats();
  }
}
