import { UnauthenticatedError } from '../api/errors.ts';
import { toUserSummaryDto } from '../api/mappers.ts';
import type { UserSummaryDto } from '../api/dtos.ts';
import type { DisplayTheme } from '../domain/models.ts';
import type { AuthApplicationService } from './service.ts';
import type { WorkspaceService } from '../workspace/service.ts';

export async function loadWorkspaceSession(
  token: string | undefined,
  auth: Pick<AuthApplicationService, 'getSessionUser'>,
  preferences: Pick<WorkspaceService, 'getDisplayPreference'>,
): Promise<{ user: UserSummaryDto | null; theme: DisplayTheme }> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { user: null, theme: 'light' };
  try {
    const actor = await auth.getSessionUser(token);
    const { theme } = await preferences.getDisplayPreference(actor);
    return { user: toUserSummaryDto(actor), theme };
  } catch (error) {
    if (error instanceof UnauthenticatedError) return { user: null, theme: 'light' };
    throw error;
  }
}
