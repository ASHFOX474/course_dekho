import { ForbiddenError, UnauthenticatedError } from "../api/errors.ts";
import type { AuthenticatedUser, UserRole } from "../domain/models.ts";

/**
 * Route handlers call this after resolving the session. UI and middleware
 * checks are navigation aids and never replace this server-side assertion.
 */
export function requireRole<T extends AuthenticatedUser>(
  actor: T | null,
  allowedRoles: readonly UserRole[]
): T {
  if (!actor) throw new UnauthenticatedError();
  if (!allowedRoles.includes(actor.role)) throw new ForbiddenError();
  return actor;
}
