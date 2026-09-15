import { mapErrorToApi, NotFoundError } from '../api/errors.ts';
import { validatePublicId } from '../api/validation.ts';
import { requireRole } from '../auth/authorization.ts';
import { readSessionToken } from '../auth/session.ts';
import type { AuthApplicationService } from '../auth/service.ts';
import type { DatabaseExecutor } from '../db/executor.ts';
import { loadFile } from './files.ts';

export function createAttachmentHandler(db: DatabaseExecutor, auth: Pick<AuthApplicationService, 'getSessionUser'>) {
  return async (request: Request, id: string, kind: 'resources' | 'submissions') => {
    const headers = { 'cache-control': 'private, no-store', vary: 'Cookie' };
    try {
      const token = readSessionToken(request);
      const actor = requireRole(token ? await auth.getSessionUser(token) : null, ['learner', 'contributor', 'admin']);
      validatePublicId(id, 'id');
      const result = await db.query<{
        storage_key: string | null; original_file_name: string | null; mime_type: string | null; external_url: string | null;
      }>({
        text: kind === 'submissions' ? `
          SELECT s.storage_key, s.original_file_name, s.mime_type, s.external_url
          FROM coursedekho.content_submission s
          JOIN coursedekho.app_user u ON u.id = s.submitted_by_user_id
          WHERE s.public_id = $1::uuid AND ($2 = 'admin' OR ($2 = 'contributor' AND u.public_id = $3::uuid))
        ` : `
          SELECT r.storage_key, r.original_file_name, r.mime_type, r.external_url
          FROM coursedekho.content c
          JOIN coursedekho.content_revision r ON r.id = c.current_revision_id AND r.content_id = c.id
          JOIN coursedekho.content_submission s ON s.id = r.submission_id
          JOIN coursedekho.topic t ON t.id = c.topic_id
          JOIN coursedekho.course co ON co.id = t.course_id
          JOIN coursedekho.university u ON u.id = co.university_id
          JOIN coursedekho.semester se ON se.id = co.semester_id AND se.university_id = u.id
          WHERE c.public_id = $1::uuid AND c.is_active AND c.published_at IS NOT NULL
          AND s.status = 'approved' AND t.is_active AND co.is_active AND u.is_active AND se.is_active
        `,
        values: kind === 'submissions' ? [id, actor.role, actor.id] : [id],
      });
      const asset = result.rows[0];
      if (!asset) throw new NotFoundError();
      const url = new URL(request.url);
      let externalUrl: string | null = null;
      if (asset.external_url) {
        try { const link = new URL(asset.external_url); if (['https:', 'http:'].includes(link.protocol) && !link.username && !link.password) externalUrl = link.href; } catch { /* Ignore invalid legacy links. */ }
      }
      if (url.searchParams.get('info') === '1') return Response.json({ data: {
        fileUrl: asset.storage_key ? `/api/v1/${kind}/${id}/attachment` : null,
        fileName: asset.original_file_name, mimeType: asset.mime_type, externalUrl,
      } }, { headers });
      if (!asset.storage_key) throw new NotFoundError('No uploaded file is attached.');
      const bytes = await loadFile(asset.storage_key);
      const inline = url.searchParams.get('download') !== '1' && ['application/pdf','image/png','image/jpeg','image/gif','image/webp'].includes(asset.mime_type ?? '');
      return new Response(new Uint8Array(bytes), { headers: {
        ...headers,
        'content-type': asset.mime_type || 'application/octet-stream',
        'content-length': String(bytes.length),
        'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="attachment"; filename*=UTF-8''${encodeURIComponent(asset.original_file_name || 'attachment').replace(/'/g, '%27')}`,
        'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'",
      } });
    } catch (error) {
      const mapped = mapErrorToApi(error);
      return Response.json(mapped.body, { status: mapped.status, headers });
    }
  };
}
