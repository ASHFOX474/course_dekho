import type {
  AccessHistoryDto,
  AdminStatsDto,
  ApiErrorDto,
  BookmarkDto,
  CreateBookmarkRequestDto,
  CreateSubmissionRequestDto,
  LearningOverviewDto,
  SolvedQuestionDto,
  SubmissionDto,
  UserProfileDto,
} from "@/lib/server/api/dtos";

interface DataEnvelope<T> { data: T }

export class WorkspaceApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorDto["error"]["code"],
    message: string
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  try { return await response.json(); } catch { return null; }
}

function apiError(body: unknown): ApiErrorDto["error"] | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = body.error;
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    !("message" in error) ||
    typeof error.code !== "string" ||
    typeof error.message !== "string"
  ) return null;
  return error as ApiErrorDto["error"];
}

async function requestData<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: options.body === undefined ? { accept: "application/json" } : {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  const body = await readBody(response);
  if (!response.ok) {
    const error = apiError(body);
    throw new WorkspaceApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.message ?? "The database request failed."
    );
  }
  if (response.status === 204) return undefined as T;
  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new WorkspaceApiError(502, "INTERNAL_ERROR", "The API returned an invalid response.");
  }
  return (body as DataEnvelope<T>).data;
}

export const getProfile = (signal?: AbortSignal) =>
  requestData<UserProfileDto>("/api/v1/me/profile", { signal });
export const getLearning = (signal?: AbortSignal) =>
  requestData<LearningOverviewDto>("/api/v1/me/learning", { signal });
export const listBookmarks = (signal?: AbortSignal) =>
  requestData<BookmarkDto[]>("/api/v1/me/bookmarks", { signal });
export const createBookmark = (input: CreateBookmarkRequestDto) =>
  requestData<BookmarkDto>("/api/v1/me/bookmarks", { method: "POST", body: input });
export const deleteBookmark = (bookmarkId: string) =>
  requestData<void>(`/api/v1/me/bookmarks/${encodeURIComponent(bookmarkId)}`, { method: "DELETE" });
export const createEnrollment = (courseId: string) =>
  requestData<{ id: string }>("/api/v1/enrollments", { method: "POST", body: { courseId } });
export const updateProgress = (topicId: string, progressPercent: number) =>
  requestData<LearningOverviewDto>(`/api/v1/me/progress/${encodeURIComponent(topicId)}`, {
    method: "PUT",
    body: { progressPercent },
  });
export const listAccessHistory = (signal?: AbortSignal) =>
  requestData<AccessHistoryDto[]>("/api/v1/me/access-history", { signal });
export const recordResourceAccess = (resourceId: string) =>
  requestData<void>(`/api/v1/resources/${encodeURIComponent(resourceId)}/access`, { method: "POST" });
export const listSolvedQuestions = (signal?: AbortSignal) =>
  requestData<SolvedQuestionDto[]>("/api/v1/me/solved-questions", { signal });
export const markResourceSolved = (resourceId: string) =>
  requestData<SolvedQuestionDto[]>(`/api/v1/resources/${encodeURIComponent(resourceId)}/solved`, { method: "POST" });
export const listOwnSubmissions = (signal?: AbortSignal) =>
  requestData<SubmissionDto[]>("/api/v1/submissions/mine", { signal });
export const listSubmissionsForReview = (signal?: AbortSignal) =>
  requestData<SubmissionDto[]>("/api/v1/admin/submissions", { signal });
export const createSubmission = (input: CreateSubmissionRequestDto) =>
  requestData<SubmissionDto>("/api/v1/submissions", { method: "POST", body: input });
export const approveSubmission = (submissionId: string) =>
  requestData<SubmissionDto>(`/api/v1/admin/submissions/${encodeURIComponent(submissionId)}/approve`, { method: "POST" });
export const rejectSubmission = (submissionId: string, reason: string) =>
  requestData<SubmissionDto>(`/api/v1/admin/submissions/${encodeURIComponent(submissionId)}/reject`, { method: "POST", body: { reason } });
export const getAdminStats = (signal?: AbortSignal) =>
  requestData<AdminStatsDto>("/api/v1/admin/stats", { signal });

export type {
  AccessHistoryDto,
  AdminStatsDto,
  BookmarkDto,
  LearningOverviewDto,
  SolvedQuestionDto,
  SubmissionDto,
  UserProfileDto,
};
