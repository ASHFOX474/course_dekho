import 'server-only';

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { UnauthenticatedError } from '../api/errors';
import type { AuthenticatedUser, UserRole } from '../domain/models';
import { authService } from './runtime';
import { SESSION_COOKIE_NAME } from './session';

const allRoles = ['learner', 'contributor', 'admin'] as const;
const sessionTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function requirePageUser(
  roles: readonly UserRole[] = allRoles
): Promise<AuthenticatedUser> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !sessionTokenPattern.test(token)) redirect('/login');

  let actor: AuthenticatedUser;
  try {
    actor = await authService.getSessionUser(token);
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/login');
    throw error;
  }

  if (!roles.includes(actor.role)) notFound();
  return actor;
}
