import { mapErrorToApi } from "../api/errors.ts";
import {
  toApprovedResourceDto,
  toCourseDto,
  toSemesterDto,
  toTopicDto,
  toUniversityDto,
} from "../api/mappers.ts";
import { validateCourseListQuery, validatePublicId } from "../api/validation.ts";
import { requireRole } from "../auth/authorization.ts";
import { readSessionToken } from "../auth/session.ts";
import type { AuthApplicationService } from "../auth/service.ts";
import type { UserRole } from "../domain/models.ts";
import type { CatalogApplicationService } from "./service.ts";

const catalogRoles: readonly UserRole[] = ["student", "teacher", "admin"];

interface CatalogHttpDependencies {
  authService: Pick<AuthApplicationService, "getSessionUser">;
  catalogService: CatalogApplicationService;
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

function errorResponse(error: unknown, dependencies: CatalogHttpDependencies): Response {
  const mapped = mapErrorToApi(error);
  if (mapped.status === 500) dependencies.onUnexpectedError?.(error);
  return jsonResponse(mapped.body, mapped.status);
}

async function authorizeCatalogRead(
  request: Request,
  authService: Pick<AuthApplicationService, "getSessionUser">
): Promise<void> {
  const token = readSessionToken(request);
  const actor = token ? await authService.getSessionUser(token) : null;
  requireRole(actor, catalogRoles);
}

export function createCatalogHttpHandlers(dependencies: CatalogHttpDependencies) {
  return {
    async listUniversities(request: Request): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const universities = await dependencies.catalogService.listUniversities();
        return jsonResponse({ data: universities.map(toUniversityDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async listSemesters(request: Request, universityId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(universityId, "universityId");
        const semesters = await dependencies.catalogService.listSemesters(publicId);
        return jsonResponse({ data: semesters.map(toSemesterDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async listCourses(request: Request): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const filters = validateCourseListQuery(new URL(request.url).searchParams);
        const courses = await dependencies.catalogService.listCourses(filters);
        return jsonResponse({ data: courses.map(toCourseDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async getCourse(request: Request, courseId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(courseId, "courseId");
        const course = await dependencies.catalogService.getCourse(publicId);
        return jsonResponse({ data: toCourseDto(course) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async listTopics(request: Request, courseId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(courseId, "courseId");
        const topics = await dependencies.catalogService.listTopics(publicId);
        return jsonResponse({ data: topics.map(toTopicDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async listCourseResources(request: Request, courseId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(courseId, "courseId");
        const resources = await dependencies.catalogService.listCourseResources(publicId);
        return jsonResponse({ data: resources.map(toApprovedResourceDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async listTopicResources(request: Request, topicId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(topicId, "topicId");
        const resources = await dependencies.catalogService.listTopicResources(publicId);
        return jsonResponse({ data: resources.map(toApprovedResourceDto) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async getApprovedResource(request: Request, resourceId: string): Promise<Response> {
      try {
        await authorizeCatalogRead(request, dependencies.authService);
        const publicId = validatePublicId(resourceId, "resourceId");
        const resource = await dependencies.catalogService.getApprovedResource(publicId);
        return jsonResponse({ data: toApprovedResourceDto(resource) }, 200);
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },
  };
}
