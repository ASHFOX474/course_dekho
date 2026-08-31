import type {
  ApiErrorCode,
  ApiErrorDto,
  ApprovedResourceDto,
  CourseSummaryDto,
  SemesterSummaryDto,
  TopicSummaryDto,
  UniversitySummaryDto,
} from "@/lib/server/api/dtos";
import type { ResourceType } from "@/lib/types";

interface DataEnvelope<T> {
  data: T;
}

export interface CourseListFilters {
  universityId?: string;
  semesterId?: string;
  query?: string;
}

export class CatalogApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, error: ApiErrorDto["error"]) {
    super(error.message);
    this.name = "CatalogApiError";
    this.status = status;
    this.code = error.code;
    this.fieldErrors = error.fieldErrors;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isApiError(value: unknown): value is ApiErrorDto {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

async function getData<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { accept: "application/json" },
    signal,
  });
  const body = await readJson(response);

  if (!response.ok) {
    if (isApiError(body)) throw new CatalogApiError(response.status, body.error);
    throw new CatalogApiError(response.status, {
      code: "INTERNAL_ERROR",
      message: "The catalog request failed.",
    });
  }

  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new CatalogApiError(502, {
      code: "INTERNAL_ERROR",
      message: "The catalog returned an invalid response.",
    });
  }

  return (body as DataEnvelope<T>).data;
}

export function listUniversities(signal?: AbortSignal): Promise<UniversitySummaryDto[]> {
  return getData("/api/v1/universities", signal);
}

export function listSemesters(
  universityId: string,
  signal?: AbortSignal
): Promise<SemesterSummaryDto[]> {
  return getData(
    `/api/v1/universities/${encodeURIComponent(universityId)}/semesters`,
    signal
  );
}

export function listCourses(
  filters: CourseListFilters = {},
  signal?: AbortSignal
): Promise<CourseSummaryDto[]> {
  const query = new URLSearchParams();
  if (filters.universityId) query.set("universityId", filters.universityId);
  if (filters.semesterId) query.set("semesterId", filters.semesterId);
  if (filters.query?.trim()) query.set("query", filters.query.trim());
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return getData(`/api/v1/courses${suffix}`, signal);
}

export function getCourse(courseId: string, signal?: AbortSignal): Promise<CourseSummaryDto> {
  return getData(`/api/v1/courses/${encodeURIComponent(courseId)}`, signal);
}

export function listCourseTopics(
  courseId: string,
  signal?: AbortSignal
): Promise<TopicSummaryDto[]> {
  return getData(`/api/v1/courses/${encodeURIComponent(courseId)}/topics`, signal);
}

export function listCourseResources(
  courseId: string,
  signal?: AbortSignal
): Promise<ApprovedResourceDto[]> {
  return getData(`/api/v1/courses/${encodeURIComponent(courseId)}/resources`, signal);
}

export function listTopicResources(
  topicId: string,
  signal?: AbortSignal
): Promise<ApprovedResourceDto[]> {
  return getData(`/api/v1/topics/${encodeURIComponent(topicId)}/resources`, signal);
}

export function getApprovedResource(
  resourceId: string,
  signal?: AbortSignal
): Promise<ApprovedResourceDto> {
  return getData(`/api/v1/resources/${encodeURIComponent(resourceId)}`, signal);
}

const resourceTypeLabels: Record<ApprovedResourceDto["type"], ResourceType> = {
  study_material: "Study Material",
  practice_material: "Practice Material",
  book: "Book",
  tutorial: "Tutorial",
  slide: "Slide",
  question: "Question",
  leetcode_problem: "LeetCode Problem",
};

export function resourceTypeLabel(type: ApprovedResourceDto["type"]): ResourceType {
  return resourceTypeLabels[type];
}

export function formatFileSize(fileSizeBytes: number | null): string | null {
  if (fileSizeBytes === null) return null;
  if (fileSizeBytes < 1024) return `${fileSizeBytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = fileSizeBytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export type {
  ApprovedResourceDto,
  CourseSummaryDto,
  SemesterSummaryDto,
  TopicSummaryDto,
  UniversitySummaryDto,
};
