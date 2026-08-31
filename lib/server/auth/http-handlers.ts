import type { AuthenticatedUser, UserRole } from "../domain/models.ts";
import { ValidationError, mapErrorToApi } from "../api/errors.ts";
import { toUserSummaryDto } from "../api/mappers.ts";
import { validateLoginRequest, validateRegisterRequest } from "../api/validation.ts";
import { requireRole } from "./authorization.ts";
import type { AuthApplicationService } from "./service.ts";
import {
  assertTrustedOrigin,
  readSessionToken,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "./session.ts";

const allRoles: readonly UserRole[] = ["student", "teacher", "admin"];

interface AuthHttpDependencies {
  service: AuthApplicationService;
  appOrigin?: string;
  secureCookies?: boolean;
  onUnexpectedError?: (error: unknown) => void;
}

function applicationOrigin(request: Request, configuredOrigin?: string): string {
  return configuredOrigin ?? new URL(request.url).origin;
}

function shouldSecureCookies(request: Request, configured?: boolean): boolean {
  return (
    configured ??
    (process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:")
  );
}

function jsonResponse(body: unknown, status: number, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

async function readJsonObject(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
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

function errorResponse(error: unknown, dependencies: AuthHttpDependencies): Response {
  const mapped = mapErrorToApi(error);
  if (mapped.status === 500) dependencies.onUnexpectedError?.(error);
  return jsonResponse(mapped.body, mapped.status);
}

function authenticatedActor(
  user: AuthenticatedUser | null
): AuthenticatedUser {
  return requireRole(user, allRoles);
}

export function createAuthHttpHandlers(dependencies: AuthHttpDependencies) {
  return {
    async register(request: Request): Promise<Response> {
      try {
        assertTrustedOrigin(request, applicationOrigin(request, dependencies.appOrigin));
        const input = validateRegisterRequest(await readJsonObject(request));
        const result = await dependencies.service.register(input);
        return jsonResponse(
          { data: toUserSummaryDto(result.user) },
          201,
          {
            "set-cookie": serializeSessionCookie(result.sessionToken, {
              secure: shouldSecureCookies(request, dependencies.secureCookies),
              expiresAt: result.expiresAt,
            }),
          }
        );
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async login(request: Request): Promise<Response> {
      try {
        assertTrustedOrigin(request, applicationOrigin(request, dependencies.appOrigin));
        const input = validateLoginRequest(await readJsonObject(request));
        const result = await dependencies.service.login(input, readSessionToken(request));
        return jsonResponse(
          { data: toUserSummaryDto(result.user) },
          200,
          {
            "set-cookie": serializeSessionCookie(result.sessionToken, {
              secure: shouldSecureCookies(request, dependencies.secureCookies),
              expiresAt: result.expiresAt,
            }),
          }
        );
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },

    async logout(request: Request): Promise<Response> {
      const secure = shouldSecureCookies(request, dependencies.secureCookies);
      try {
        assertTrustedOrigin(request, applicationOrigin(request, dependencies.appOrigin));
        const token = readSessionToken(request);
        const actor = token
          ? await dependencies.service.getSessionUser(token)
          : null;
        authenticatedActor(actor);
        await dependencies.service.logout(token as string);
        return new Response(null, {
          status: 204,
          headers: {
            "cache-control": "no-store",
            "set-cookie": serializeExpiredSessionCookie({ secure }),
          },
        });
      } catch (error) {
        const response = errorResponse(error, dependencies);
        response.headers.set("set-cookie", serializeExpiredSessionCookie({ secure }));
        return response;
      }
    },

    async session(request: Request): Promise<Response> {
      try {
        const token = readSessionToken(request);
        const actor = token
          ? await dependencies.service.getSessionUser(token)
          : null;
        const user = authenticatedActor(actor);
        return jsonResponse({ data: toUserSummaryDto(user) }, 200, { vary: "Cookie" });
      } catch (error) {
        return errorResponse(error, dependencies);
      }
    },
  };
}
