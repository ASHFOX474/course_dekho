import { ConflictError, mapErrorToApi, ValidationError } from '../api/errors.ts';
import { requireRole } from '../auth/authorization.ts';
import { assertTrustedOrigin, readSessionToken } from '../auth/session.ts';
import type { AuthApplicationService } from '../auth/service.ts';
import type { DatabaseExecutor } from '../db/executor.ts';
import type { TransactionPool } from '../db/transaction.ts';
import { listAcademicRecords, mutateAcademicRecord, validateAcademicMutation } from './academic-management.ts';

export function createAcademicHandler(pool: DatabaseExecutor & TransactionPool, auth: Pick<AuthApplicationService, 'getSessionUser'>, appOrigin?: string) {
  return async (request: Request) => {
    const headers = { 'cache-control': 'private, no-store', vary: 'Cookie' };
    try {
      if (request.method !== 'GET') assertTrustedOrigin(request, appOrigin ?? new URL(request.url).origin);
      const token = readSessionToken(request);
      requireRole(token ? await auth.getSessionUser(token) : null, ['admin']);
      if (request.method === 'GET') return Response.json({ data: await listAcademicRecords(pool) }, { headers });
      if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, allow: 'GET, POST' } });
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ValidationError('Send a JSON academic form.', {});
      let value: unknown;
      try { value = await request.json(); } catch { throw new ValidationError('Invalid academic form.', {}); }
      const input = validateAcademicMutation(value);
      const data = await mutateAcademicRecord(pool, input);
      return Response.json({ data }, { status: input.action === 'create' ? 201 : 200, headers });
    } catch (error) {
      const mapped = mapErrorToApi(
        error && typeof error === 'object' && 'code' in error && error.code === '23505'
          ? new ConflictError('That university short name or course code is already in use, including archived items. Choose another value or edit the existing item.')
          : error
      );
      return Response.json(mapped.body, { status: mapped.status, headers });
    }
  };
}
