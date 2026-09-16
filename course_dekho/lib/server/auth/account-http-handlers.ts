import { mapErrorToApi, ValidationError } from '../api/errors.ts';
import { validatePublicId } from '../api/validation.ts';
import { requireRole } from './authorization.ts';
import { assertTrustedOrigin, readSessionToken, serializeExpiredSessionCookie } from './session.ts';
import type { AuthApplicationService } from './service.ts';
import type { AccountService } from './account-service.ts';

export function createAccountHandler(auth: Pick<AuthApplicationService, 'getSessionUser'>, service: AccountService, origin?: string) {
  return async (request: Request, action: 'profile' | 'password' | 'issue' | 'reset', userId?: string) => {
    const headers = new Headers({ 'cache-control': 'no-store', vary: 'Cookie' });
    try {
      assertTrustedOrigin(request, origin ?? new URL(request.url).origin);
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ValidationError('Send a JSON account form.', {});
      let input: unknown;
      try { input = await request.json(); } catch { throw new ValidationError('Invalid account form.', {}); }
      if (action === 'reset') await service.resetPassword(input);
      else {
        const token = readSessionToken(request);
        const actor = requireRole(token ? await auth.getSessionUser(token) : null, action === 'issue' ? ['admin'] : ['learner', 'contributor', 'admin']);
        if (action === 'profile') await service.updateProfile(actor, input);
        if (action === 'password') await service.changePassword(actor, input);
        if (action === 'issue') return Response.json({ data: await service.issueRecovery(actor, validatePublicId(userId, 'userId'), input) }, { headers });
      }
      if (action === 'password' || action === 'reset') headers.set('set-cookie', serializeExpiredSessionCookie({ secure: process.env.NODE_ENV === 'production' || new URL(request.url).protocol === 'https:' }));
      return new Response(null, { status: 204, headers });
    } catch (error) { const mapped = mapErrorToApi(error); return Response.json(mapped.body, { status: mapped.status, headers }); }
  };
}
