import {
  querySubmissionByPublicId,
  querySubmissionsByContributor,
} from "../db/queries/submission-queries.ts";
import { submissionRowToDomain } from "../db/row-mappers.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import type { Submission } from "../domain/models.ts";

export interface SubmissionRepository {
  findByPublicId(submissionPublicId: string): Promise<Submission | null>;
  listByContributor(contributorPublicId: string): Promise<Submission[]>;
}

export class PostgresSubmissionRepository implements SubmissionRepository {
  private readonly executor: DatabaseExecutor;

  constructor(executor: DatabaseExecutor) {
    this.executor = executor;
  }

  async findByPublicId(submissionPublicId: string): Promise<Submission | null> {
    const row = await querySubmissionByPublicId(this.executor, submissionPublicId);
    return row ? submissionRowToDomain(row) : null;
  }

  async listByContributor(contributorPublicId: string): Promise<Submission[]> {
    const rows = await querySubmissionsByContributor(this.executor, contributorPublicId);
    return rows.map(submissionRowToDomain);
  }
}
