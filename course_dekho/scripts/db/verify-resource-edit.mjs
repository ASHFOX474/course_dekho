// Exercises real PostgreSQL constraints, then rolls back every test mutation.
import assert from 'node:assert/strict';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { queryCreateResourceEdit } from '../../lib/server/db/queries/resource-edit-queries.ts';
import { queryApproveSubmission } from '../../lib/server/db/queries/workspace-queries.ts';

const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)) });
await client.connect();
try {
  await client.query('BEGIN');
  const admin = (await client.query("SELECT public_id FROM coursedekho.app_user WHERE role = 'admin' AND is_active LIMIT 1")).rows[0];
  const original = (await client.query(`SELECT c.id, c.public_id, c.created_by_user_id, r.*,
    c.public_id AS resource_id, r.id AS revision_id, co.public_id AS course_public_id, t.public_id AS topic_public_id
    FROM coursedekho.content c JOIN coursedekho.content_revision r ON r.id = c.current_revision_id
    JOIN coursedekho.topic t ON t.id = c.topic_id JOIN coursedekho.course co ON co.id = t.course_id
    WHERE c.is_active ORDER BY c.id LIMIT 1 FOR UPDATE OF c`)).rows[0];
  assert.ok(admin && original, 'An active admin and resource are required');
  const destination = (await client.query(`SELECT t.public_id AS topic_id, c.public_id AS course_id
    FROM coursedekho.topic t JOIN coursedekho.course c ON c.id = t.course_id
    JOIN coursedekho.semester s ON s.id = c.semester_id JOIN coursedekho.university u ON u.id = c.university_id
    WHERE t.is_active AND c.is_active AND s.is_active AND u.is_active AND c.public_id <> $1::uuid LIMIT 1`, [original.course_public_id])).rows[0];
  assert.ok(destination, 'A second active course is required');
  for (const [index, type] of [original.resource_type, 'book', 'slide', 'study_material', 'leetcode_problem', 'question'].entries()) {
    const title = `Verification revision ${index}`;
    const submissionId = await queryCreateResourceEdit(client, original.resource_id, admin.public_id, {
      title, courseId: destination.course_id, topicId: destination.topic_id, resourceType: type,
    });
    assert.ok(submissionId);
    assert.equal(await queryApproveSubmission(client, { submissionId, reviewerId: admin.public_id, reviewedAt: new Date() }), true);
    const current = (await client.query(`SELECT r.*, c.created_by_user_id, t.public_id AS topic_public_id
      FROM coursedekho.content c JOIN coursedekho.content_revision r ON r.id = c.current_revision_id
      JOIN coursedekho.topic t ON t.id = c.topic_id WHERE c.public_id = $1::uuid`, [original.resource_id])).rows[0];
    assert.equal(current.title, title);
    assert.equal(current.resource_type, type);
    assert.equal(current.topic_public_id, destination.topic_id);
    assert.equal(current.version_number, original.version_number + index + 1);
    for (const field of ['storage_key', 'original_file_name', 'mime_type', 'file_size_bytes', 'checksum_sha256', 'external_url', 'description', 'created_by_user_id']) assert.equal(current[field], original[field]);
    assert.deepEqual(current.metadata, original.metadata);
  }
  const historical = (await client.query('SELECT title FROM coursedekho.content_revision WHERE id = $1', [original.revision_id])).rows[0];
  assert.equal(historical.title, original.title);
  assert.equal(await queryCreateResourceEdit(client, original.resource_id, admin.public_id, {
    title: 'Invalid destination', courseId: original.course_public_id, topicId: destination.topic_id, resourceType: 'book',
  }), null);
  await client.query('ROLLBACK');
  console.log('PASS: rename, cross-course move, six revisions, category changes, asset preservation, immutable history, and invalid destination. All test changes rolled back.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Verification failed');
  process.exitCode = 1;
} finally {
  await client.end();
}
