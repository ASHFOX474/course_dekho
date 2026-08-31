import type { DatabaseExecutor } from "../db/executor.ts";
import { PostgresAuthRepository } from "./auth-repository.ts";
import { PostgresCatalogRepository } from "./catalog-repository.ts";
import { PostgresSubmissionRepository } from "./submission-repository.ts";

export function createRepositories(executor: DatabaseExecutor) {
  return {
    auth: new PostgresAuthRepository(executor),
    catalog: new PostgresCatalogRepository(executor),
    submissions: new PostgresSubmissionRepository(executor),
  };
}
