import { ValidationError, mapErrorToApi } from "../api/errors.ts";
import {
  toAccessHistoryDto,
  toAdminStatsDto,
  toBookmarkDto,
  toLearningOverviewDto,
  toSolvedQuestionDto,
  toSubmissionDto,
  toUserProfileDto,
} from "../api/mappers.ts";
import {
  validateBookmarkRequest,
  validateCreateEnrollmentRequest,
  validateCreateSubmissionRequest,
  validateProgressRequest,
  validatePublicId,
  validateRejectSubmissionRequest,
} from "../api/validation.ts";
import { requireRole } from "../auth/authorization.ts";
import { assertTrustedOrigin, readSessionToken } from "../auth/session.ts";
import type { AuthApplicationService } from "../auth/service.ts";
import type { AuthenticatedUser, UserRole } from "../domain/models.ts";
import type { WorkspaceService } from "./service.ts";

const allRoles: readonly UserRole[] = ["student", "teacher", "admin"];
const learnerRoles: readonly UserRole[] = ["student", "teacher"];

interface WorkspaceHttpDependencies {
  authService: Pick<AuthApplicationService, "getSessionUser">;
  workspaceService: WorkspaceService;
  appOrigin?: string;
  onUnexpectedError?: (error: unknown) => void;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      vary: "Cookie",
    },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: { "cache-control": "private, no-store", vary: "Cookie" } });
}

async function readJsonObject(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new ValidationError("Request validation failed.", {
      body: ["Content-Type must be application/json."],
    });
  }
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request validation failed.", {
      body: ["Request body must contain valid JSON."],
    });
  }
}

function errorResponse(error: unknown, dependencies: WorkspaceHttpDependencies): Response {
  const mapped = mapErrorToApi(error);
  if (mapped.status === 500) dependencies.onUnexpectedError?.(error);
  return jsonResponse(mapped.body, mapped.status);
}

function applicationOrigin(request: Request, configured?: string): string {
  return configured ?? new URL(request.url).origin;
}

async function actorFor(
  request: Request,
  dependencies: WorkspaceHttpDependencies,
  roles: readonly UserRole[]
): Promise<AuthenticatedUser> {
  const token = readSessionToken(request);
  const actor = token ? await dependencies.authService.getSessionUser(token) : null;
  return requireRole(actor, roles);
}

function assertSafeMutation(request: Request, dependencies: WorkspaceHttpDependencies): void {
  assertTrustedOrigin(request, applicationOrigin(request, dependencies.appOrigin));
}

export function createWorkspaceHttpHandlers(dependencies: WorkspaceHttpDependencies) {
  return {
    async getProfile(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, allRoles);
        return jsonResponse({ data: toUserProfileDto(await dependencies.workspaceService.getProfile(actor)) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async getLearning(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, learnerRoles);
        return jsonResponse({ data: toLearningOverviewDto(await dependencies.workspaceService.getLearning(actor)) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async createEnrollment(request: Request): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        const input = validateCreateEnrollmentRequest(await readJsonObject(request));
        return jsonResponse({ data: await dependencies.workspaceService.createEnrollment(actor, input.courseId) }, 201);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async updateProgress(request: Request, topicId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        const publicId = validatePublicId(topicId, "topicId");
        const input = validateProgressRequest(await readJsonObject(request));
        const learning = await dependencies.workspaceService.updateProgress(actor, publicId, input.progressPercent);
        return jsonResponse({ data: toLearningOverviewDto(learning) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async listBookmarks(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, learnerRoles);
        const rows = await dependencies.workspaceService.listBookmarks(actor);
        return jsonResponse({ data: rows.map(toBookmarkDto) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async createBookmark(request: Request): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        const input = validateBookmarkRequest(await readJsonObject(request));
        const bookmark = await dependencies.workspaceService.createBookmark(actor, input);
        return jsonResponse({ data: toBookmarkDto(bookmark) }, 201);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async deleteBookmark(request: Request, bookmarkId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        await dependencies.workspaceService.deleteBookmark(actor, validatePublicId(bookmarkId, "bookmarkId"));
        return emptyResponse(204);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async listAccessHistory(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, learnerRoles);
        const rows = await dependencies.workspaceService.listAccessHistory(actor);
        return jsonResponse({ data: rows.map(toAccessHistoryDto) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async recordAccess(request: Request, resourceId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        await dependencies.workspaceService.recordAccess(actor, validatePublicId(resourceId, "resourceId"));
        return emptyResponse(204);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async listSolvedQuestions(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, learnerRoles);
        const rows = await dependencies.workspaceService.listSolvedQuestions(actor);
        return jsonResponse({ data: rows.map(toSolvedQuestionDto) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async markSolved(request: Request, resourceId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, learnerRoles);
        const rows = await dependencies.workspaceService.markSolved(actor, validatePublicId(resourceId, "resourceId"));
        return jsonResponse({ data: rows.map(toSolvedQuestionDto) }, 201);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async listSubmissions(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, ["teacher", "admin"]);
        const rows = await dependencies.workspaceService.listSubmissions(actor);
        return jsonResponse({ data: rows.map(toSubmissionDto) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async createSubmission(request: Request): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, ["teacher"]);
        const input = validateCreateSubmissionRequest(await readJsonObject(request));
        const submission = await dependencies.workspaceService.createSubmission(actor, input);
        return jsonResponse({ data: toSubmissionDto(submission) }, 201);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async approveSubmission(request: Request, submissionId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, ["admin"]);
        const submission = await dependencies.workspaceService.approveSubmission(
          actor,
          validatePublicId(submissionId, "submissionId")
        );
        return jsonResponse({ data: toSubmissionDto(submission) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async rejectSubmission(request: Request, submissionId: string): Promise<Response> {
      try {
        assertSafeMutation(request, dependencies);
        const actor = await actorFor(request, dependencies, ["admin"]);
        const id = validatePublicId(submissionId, "submissionId");
        const input = validateRejectSubmissionRequest(await readJsonObject(request));
        const submission = await dependencies.workspaceService.rejectSubmission(actor, id, input.reason);
        return jsonResponse({ data: toSubmissionDto(submission) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },

    async getAdminStats(request: Request): Promise<Response> {
      try {
        const actor = await actorFor(request, dependencies, ["admin"]);
        return jsonResponse({ data: toAdminStatsDto(await dependencies.workspaceService.getAdminStats(actor)) }, 200);
      } catch (error) { return errorResponse(error, dependencies); }
    },
  };
}
