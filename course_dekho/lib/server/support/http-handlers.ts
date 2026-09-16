import type { AuthApplicationService } from '../auth/service.ts';
import { requireRole } from '../auth/authorization.ts';
import { assertTrustedOrigin, readSessionToken } from '../auth/session.ts';
import { mapErrorToApi, ValidationError } from '../api/errors.ts';
import { validatePublicId } from '../api/validation.ts';
import type { SupportService } from './service.ts';

export function createSupportHandler(auth: Pick<AuthApplicationService, 'getSessionUser'>, service: SupportService, origin?: string) {
  return async (request: Request, action: 'collection' | 'recovery' | 'thread', id?: string) => {
    const headers = { 'cache-control': 'private, no-store', vary: 'Cookie, X-Support-Token' };
    try {
      if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers });
      if (request.method !== 'GET') assertTrustedOrigin(request, origin ?? new URL(request.url).origin);
      const guestToken = action === 'thread' ? request.headers.get('x-support-token') ?? undefined : undefined;
      const session = readSessionToken(request);
      const actor = action === 'recovery' || guestToken ? null : session ? await auth.getSessionUser(session) : null;
      if (action === 'collection') requireRole(actor, ['learner', 'contributor', 'admin']);
      if (action === 'thread') id = validatePublicId(id, 'requestId');
      if (request.method === 'GET') {
        if (action === 'recovery') return new Response(null, { status: 405, headers });
        return Response.json({ data: action === 'collection' ? await service.list(actor!) : await service.thread(id!, actor, guestToken) }, { headers });
      }
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ValidationError('Send a JSON request form.', {});
      // Bound public input before JSON parsing.
      const reader = request.body?.getReader();
      if (!reader) throw new ValidationError('Request body is missing.', {});
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 24000) { await reader.cancel(); throw new ValidationError('Request is too large.', {}); } chunks.push(value); }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ValidationError('Invalid request form.', {}); }
      if (action === 'thread') { await service.reply(id!, actor, guestToken, input); return new Response(null, { status: 204, headers }); }
      return Response.json({ data: await service.create(actor, input) }, { status: 201, headers });
    } catch (error) { const mapped = mapErrorToApi(error); return Response.json(mapped.body, { status: mapped.status, headers }); }
  };
}
