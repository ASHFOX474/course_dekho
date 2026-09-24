import type {
  AccessHistoryDto,
  AdminStatsDto,
  ApiErrorDto,
  BookmarkDto,
  CreateBookmarkRequestDto,
  CreateSubmissionRequestDto,
  DirectoryUserDto,
  LearningOverviewDto,
  PendingUserDto,
  SolvedQuestionDto,
  SubmissionDto,
  UserProfileDto,
} from "@/lib/server/api/dtos";

import type { AcademicMutation, AcademicRecord } from '@/lib/academic-management';

export const listAcademicRecords = (signal?: AbortSignal) =>
  requestData<AcademicRecord[]>('/api/v1/admin/academics', { signal });
export const mutateAcademicRecord = (input: AcademicMutation) =>
  requestData<{ id: string }>('/api/v1/admin/academics', { method: 'POST', body: input });

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
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: options.body === undefined || options.body instanceof FormData ? { accept: "application/json" } : {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
    signal: options.signal,
  });
  const body = await readBody(response);
  if (!response.ok) {
    const error = apiError(body);
    throw new WorkspaceApiError(
      response.status,
      error?.code ?? "INTERNAL_ERROR",
      error?.fieldErrors ? Object.values(error.fieldErrors).flat().join(" ") : error?.message ?? "The database request failed."
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
export const updateProfile = (input: { name: string; department?: string; yearOfStudy?: number | null; designation?: string }) =>
  requestData<void>('/api/v1/me/profile', { method: 'PUT', body: input });
export const changePassword = (currentPassword: string, newPassword: string) =>
  requestData<void>('/api/v1/me/password', { method: 'POST', body: { currentPassword, newPassword } });
export const issueRecovery = (userId: string, currentPassword: string) =>
  requestData<{ token: string; expiresAt: string }>(`/api/v1/admin/users/${encodeURIComponent(userId)}/recovery`, { method: 'POST', body: { currentPassword } });
export const resetPassword = (token: string, newPassword: string) =>
  requestData<void>('/api/v1/auth/reset-password', { method: 'POST', body: { token, newPassword } });
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
export const createSubmission = (input: CreateSubmissionRequestDto & { file?: File }, onProgress?: (percent: number) => void) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) body.append(key, value);
  if (onProgress) return new Promise<SubmissionDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/submissions');
    xhr.setRequestHeader('accept', 'application/json');
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
    };
    xhr.onerror = () => reject(new Error('Connection lost. Check My Submissions before retrying.'));
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.onload = () => {
      let response: unknown;
      try { response = JSON.parse(xhr.responseText); } catch { reject(new Error('Unexpected server response. Check My Submissions before retrying.')); return; }
      if (xhr.status < 200 || xhr.status >= 300) {
        const error = apiError(response);
        reject(new WorkspaceApiError(xhr.status, error?.code ?? 'INTERNAL_ERROR', error?.fieldErrors ? Object.values(error.fieldErrors).flat().join(' ') : error?.message ?? 'Submission failed.'));
      } else if (typeof response === 'object' && response !== null && 'data' in response) {
        resolve((response as DataEnvelope<SubmissionDto>).data);
      } else reject(new Error('The server returned an invalid submission.'));
    };
    xhr.send(body);
  });
  return requestData<SubmissionDto>("/api/v1/submissions", { method: "POST", body });
};
export const approveSubmission = (submissionId: string) =>
  requestData<SubmissionDto>(`/api/v1/admin/submissions/${encodeURIComponent(submissionId)}/approve`, { method: "POST" });
export const publishResourceLink = (input: CreateSubmissionRequestDto) =>
  requestData<SubmissionDto>('/api/v1/admin/resource-links', { method: 'POST', body: input });
export const rejectSubmission = (submissionId: string, reason: string) =>
  requestData<SubmissionDto>(`/api/v1/admin/submissions/${encodeURIComponent(submissionId)}/reject`, { method: "POST", body: { reason } });
export const getAdminStats = (signal?: AbortSignal) =>
  requestData<AdminStatsDto>("/api/v1/admin/stats", { signal });
export const createCourse = (input: { universityId: string; semesterId: string; code: string; name: string; description: string }) =>
  requestData<{ id: string }>("/api/v1/admin/courses", { method: "POST", body: input });

// Separate from Material Approvals (submissions) above: this reviews
// learner/contributor self-registrations, not content.
export const listPendingUsers = (signal?: AbortSignal) =>
  requestData<PendingUserDto[]>("/api/v1/admin/users", { signal });
export const approveUser = (userId: string) =>
  requestData<null>(`/api/v1/admin/users/${encodeURIComponent(userId)}/approve`, { method: "POST" });
export const rejectUser = (userId: string, reason: string) =>
  requestData<null>(`/api/v1/admin/users/${encodeURIComponent(userId)}/reject`, {
    method: "POST",
    body: { reason },
  });

// Full user directory ("how many people are using this") + removal.
// Deactivation, never hard deletion -- the database itself refuses to
// hard-delete a user row.
export const listAllUsers = (signal?: AbortSignal) =>
  requestData<DirectoryUserDto[]>("/api/v1/admin/users/all", { signal });
export const deactivateUser = (userId: string) =>
  requestData<null>(`/api/v1/admin/users/${encodeURIComponent(userId)}/deactivate`, { method: "POST" });

export type {
  AccessHistoryDto,
  AdminStatsDto,
  BookmarkDto,
  DirectoryUserDto,
  LearningOverviewDto,
  PendingUserDto,
  SolvedQuestionDto,
  SubmissionDto,
  UserProfileDto,
};

export const removeResource = (resourceId: string) =>
  requestData<void>(`/api/v1/admin/resources/${encodeURIComponent(resourceId)}`, { method: 'DELETE' });

export const editResource = (resourceId: string, input: import('@/lib/resource-edit').ResourceEdit) =>
  requestData<void>(`/api/v1/admin/resources/${encodeURIComponent(resourceId)}`, { method: 'PATCH', body: input });
