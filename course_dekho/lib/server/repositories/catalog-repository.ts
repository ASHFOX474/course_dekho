import {
  queryActiveCourse,
  queryActiveCourses,
  queryActiveSemesters,
  queryActiveTopic,
  queryActiveTopics,
  queryActiveUniversities,
  queryActiveUniversity,
  queryApprovedResource,
  queryApprovedResources,
  queryApprovedResourcesByCourse,
} from "../db/queries/catalog-queries.ts";
import {
  approvedResourceRowToDomain,
  courseRowToDomain,
  semesterRowToDomain,
  topicRowToDomain,
  universityRowToDomain,
} from "../db/row-mappers.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import type {
  ApprovedResource,
  Course,
  CourseFilters,
  SemesterSummary,
  Topic,
  UniversitySummary,
} from "../domain/models.ts";

export interface CatalogRepository {
  listUniversities(): Promise<UniversitySummary[]>;
  findUniversity(universityPublicId: string): Promise<UniversitySummary | null>;
  listSemesters(universityPublicId: string): Promise<SemesterSummary[]>;
  listCourses(filters?: CourseFilters): Promise<Course[]>;
  findCourse(coursePublicId: string): Promise<Course | null>;
  listTopics(coursePublicId: string): Promise<Topic[]>;
  findTopic(topicPublicId: string): Promise<Topic | null>;
  listApprovedResourcesByCourse(coursePublicId: string): Promise<ApprovedResource[]>;
  listApprovedResources(topicPublicId: string): Promise<ApprovedResource[]>;
  findApprovedResource(resourcePublicId: string): Promise<ApprovedResource | null>;
}

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly executor: DatabaseExecutor;

  constructor(executor: DatabaseExecutor) {
    this.executor = executor;
  }

  async listUniversities(): Promise<UniversitySummary[]> {
    const rows = await queryActiveUniversities(this.executor);
    return rows.map(universityRowToDomain);
  }

  async findUniversity(universityPublicId: string): Promise<UniversitySummary | null> {
    const row = await queryActiveUniversity(this.executor, universityPublicId);
    return row ? universityRowToDomain(row) : null;
  }

  async listSemesters(universityPublicId: string): Promise<SemesterSummary[]> {
    const rows = await queryActiveSemesters(this.executor, universityPublicId);
    return rows.map(semesterRowToDomain);
  }

  async listCourses(filters: CourseFilters = {}): Promise<Course[]> {
    const rows = await queryActiveCourses(this.executor, filters);
    return rows.map(courseRowToDomain);
  }

  async findCourse(coursePublicId: string): Promise<Course | null> {
    const row = await queryActiveCourse(this.executor, coursePublicId);
    return row ? courseRowToDomain(row) : null;
  }

  async listTopics(coursePublicId: string): Promise<Topic[]> {
    const rows = await queryActiveTopics(this.executor, coursePublicId);
    return rows.map(topicRowToDomain);
  }

  async findTopic(topicPublicId: string): Promise<Topic | null> {
    const row = await queryActiveTopic(this.executor, topicPublicId);
    return row ? topicRowToDomain(row) : null;
  }

  async listApprovedResourcesByCourse(
    coursePublicId: string
  ): Promise<ApprovedResource[]> {
    const rows = await queryApprovedResourcesByCourse(this.executor, coursePublicId);
    return rows.map(approvedResourceRowToDomain);
  }

  async listApprovedResources(topicPublicId: string): Promise<ApprovedResource[]> {
    const rows = await queryApprovedResources(this.executor, topicPublicId);
    return rows.map(approvedResourceRowToDomain);
  }

  async findApprovedResource(resourcePublicId: string): Promise<ApprovedResource | null> {
    const row = await queryApprovedResource(this.executor, resourcePublicId);
    return row ? approvedResourceRowToDomain(row) : null;
  }
}
