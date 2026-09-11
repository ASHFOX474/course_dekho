import { NotFoundError } from "../api/errors.ts";
import type {
  ApprovedResource,
  Course,
  CourseFilters,
  SemesterSummary,
  Topic,
  UniversitySummary,
} from "../domain/models.ts";
import type { CatalogRepository } from "../repositories/catalog-repository.ts";

export interface CatalogApplicationService {
  listUniversities(): Promise<UniversitySummary[]>;
  listSemesters(universityPublicId: string): Promise<SemesterSummary[]>;
  listCourses(filters?: CourseFilters): Promise<Course[]>;
  getCourse(coursePublicId: string): Promise<Course>;
  listTopics(coursePublicId: string): Promise<Topic[]>;
  listCourseResources(coursePublicId: string): Promise<ApprovedResource[]>;
  listTopicResources(topicPublicId: string): Promise<ApprovedResource[]>;
  getApprovedResource(resourcePublicId: string): Promise<ApprovedResource>;
}

export class CatalogService implements CatalogApplicationService {
  private readonly repository: CatalogRepository;

  constructor(repository: CatalogRepository) {
    this.repository = repository;
  }

  listUniversities(): Promise<UniversitySummary[]> {
    return this.repository.listUniversities();
  }

  async listSemesters(universityPublicId: string): Promise<SemesterSummary[]> {
    if (!(await this.repository.findUniversity(universityPublicId))) {
      throw new NotFoundError("University not found.");
    }
    return this.repository.listSemesters(universityPublicId);
  }

  listCourses(filters: CourseFilters = {}): Promise<Course[]> {
    return this.repository.listCourses(filters);
  }

  async getCourse(coursePublicId: string): Promise<Course> {
    const course = await this.repository.findCourse(coursePublicId);
    if (!course) throw new NotFoundError("Course not found.");
    return course;
  }

  async listTopics(coursePublicId: string): Promise<Topic[]> {
    await this.getCourse(coursePublicId);
    return this.repository.listTopics(coursePublicId);
  }

  async listCourseResources(coursePublicId: string): Promise<ApprovedResource[]> {
    await this.getCourse(coursePublicId);
    return this.repository.listApprovedResourcesByCourse(coursePublicId);
  }

  async listTopicResources(topicPublicId: string): Promise<ApprovedResource[]> {
    if (!(await this.repository.findTopic(topicPublicId))) {
      throw new NotFoundError("Topic not found.");
    }
    return this.repository.listApprovedResources(topicPublicId);
  }

  async getApprovedResource(resourcePublicId: string): Promise<ApprovedResource> {
    const resource = await this.repository.findApprovedResource(resourcePublicId);
    if (!resource) throw new NotFoundError("Resource not found.");
    return resource;
  }
}
