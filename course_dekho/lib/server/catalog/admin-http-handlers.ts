import { randomUUID } from 'node:crypto';
import { ValidationError, NotFoundError, ConflictError, mapErrorToApi } from '../api/errors.ts';
import { validatePublicId } from '../api/validation.ts';
import { requireRole } from '../auth/authorization.ts';
import { assertTrustedOrigin, readSessionToken } from '../auth/session.ts';
import type { AuthApplicationService } from '../auth/service.ts';
import type { DatabaseExecutor } from '../db/executor.ts';

export function createAdminCourseHandler(db: DatabaseExecutor, auth: Pick<AuthApplicationService, 'getSessionUser'>, appOrigin?: string) {
  return async (request: Request) => {
    const headers = { 'cache-control': 'private, no-store', vary: 'Cookie' };
    try {
      assertTrustedOrigin(request, appOrigin ?? new URL(request.url).origin);
      const token = readSessionToken(request);
      requireRole(token ? await auth.getSessionUser(token) : null, ['admin']);
      if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new ValidationError('Send a JSON course form.', {});
      let value;
      try { value = await request.json(); } catch { throw new ValidationError('Invalid course form.', {}); }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Invalid course form.', {});
      if (Object.keys(value).some(key => !['universityId', 'semesterId', 'code', 'name', 'description'].includes(key))) throw new ValidationError('Unexpected course field.', {});
      const universityId = validatePublicId(value.universityId, 'universityId');
      const semesterId = validatePublicId(value.semesterId, 'semesterId');
      const errors: Record<string, string[]> = {};
      for (const [key, maximum] of [['code', 20], ['name', 200], ['description', 1000]] as const) {
        if (typeof value[key] !== 'string' || value[key].length > maximum || (key !== 'description' && !value[key].trim())) errors[key] = [`${key} must ${key === 'description' ? 'be text' : 'not be empty'} and contain at most ${maximum} characters.`];
      }
      if (Object.keys(errors).length) throw new ValidationError('Check the course details.', errors);
      const code = value.code.trim().toUpperCase();
      const slug = `${code.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course'}-${randomUUID()}`;
      // One atomic statement: semester ownership and active parents are checked by SQL.
      const result = await db.query<{ id: string }>({
        name: 'admin-create-course-v1',
        text: `INSERT INTO coursedekho.course (university_id, semester_id, slug, code, name, description)
          SELECT u.id, s.id, $3, $4, $5, $6 FROM coursedekho.university u
          JOIN coursedekho.semester s ON s.university_id = u.id
          WHERE u.public_id = $1::uuid AND s.public_id = $2::uuid AND u.is_active AND s.is_active
          RETURNING public_id::text AS id`,
        values: [universityId, semesterId, slug, code, value.name.trim(), value.description.trim()],
      });
      if (!result.rows[0]) throw new NotFoundError('Choose an active university and one of its semesters.');
      return Response.json({ data: result.rows[0] }, { status: 201, headers });
    } catch (error) {
      const mapped = mapErrorToApi((error as { code?: string }).code === '23505' ? new ConflictError('A course with this code already exists at this university.') : error);
      return Response.json(mapped.body, { status: mapped.status, headers });
    }
  };
}
