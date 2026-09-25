import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { validateCreateSubmissionRequest } from '../../lib/server/api/validation.ts';
import { queryCreateSubmission, queryApproveSubmission } from '../../lib/server/db/queries/workspace-queries.ts';
import { queryCreateResourceEdit } from '../../lib/server/db/queries/resource-edit-queries.ts';

// Uses the same submission/approval queries as admin link publishing.
// No file downloads, schema changes, or Drive permission changes.
const entries = JSON.parse(await readFile(new URL('../../data/cse209-drive-resources.json', import.meta.url), 'utf8'));
const outlines = JSON.parse(await readFile(new URL('../../data/course-outlines.json', import.meta.url), 'utf8'));
const outline = outlines.find(course => course.code === 'CSE-209');
const apply = process.argv.includes('--apply');
const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)), connectionTimeoutMillis: 10000 });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('coursedekho:database-change', 0))");
  await client.query('SELECT pg_advisory_xact_lock(73142, 1)');
  const admins = (await client.query("SELECT public_id FROM coursedekho.app_user WHERE role = 'admin' AND is_active")).rows;
  assert.equal(admins.length, 1, 'A single active admin is required for attribution');
  const course = (await client.query(`SELECT c.id, c.public_id FROM coursedekho.course c
    JOIN coursedekho.university u ON u.id = c.university_id
    JOIN coursedekho.semester s ON s.id = c.semester_id AND s.university_id = u.id
    WHERE u.slug = 'buet' AND c.code = 'CSE-209' AND s.slug = 'level-2-term-2'
      AND u.is_active AND s.is_active AND c.is_active`)).rows[0];
  assert.ok(course, 'Active CSE-209 course not found');
  const topics = (await client.query('SELECT id, public_id, name, sequence_order FROM coursedekho.topic WHERE course_id = $1 AND is_active ORDER BY sequence_order', [course.id])).rows;
  assert.deepEqual(topics.map(t => t.name), outline.topics.map(t => t.name));
  assert.equal(entries.length, 21);
  assert.equal(new Set(entries.map(entry => entry.fileId)).size, 21);
  const plans = entries.map(entry => {
    const topic = topics.find(t => t.sequence_order === entry.topicOrder);
    assert.ok(topic);
    assert.ok(['Questions.pdf', 'Practice_Problems.pdf', 'Solutions.pdf'].includes(entry.fileName));
    assert.equal(new URL(entry.url).origin, 'https://drive.google.com');
    assert.equal(new URL(entry.url).pathname, `/file/d/${entry.fileId}/view`);
    const resourceType = entry.fileName === 'Questions.pdf' ? 'question' : 'leetcode_problem';
    const title = `${topic.name} - ${entry.fileName.replace('.pdf', '').replaceAll('_', ' ')}`;
    const input = validateCreateSubmissionRequest({ courseId: course.public_id, topicId: topic.public_id,
      resourceType, title, description: entry.description, externalUrl: entry.url });
    return { entry, topic, input };
  });
  for (const topic of topics) {
    assert.deepEqual(plans.filter(p => p.topic.id === topic.id).map(p => p.entry.fileName).sort(), ['Practice_Problems.pdf', 'Questions.pdf', 'Solutions.pdf']);
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const { entry, topic, input } of plans) {
    const existing = (await client.query(`SELECT c.public_id, c.is_active, c.topic_id, r.resource_type, r.external_url FROM coursedekho.content c
      JOIN coursedekho.content_revision r ON r.id = c.current_revision_id
      JOIN coursedekho.topic t ON t.id = c.topic_id
      WHERE t.course_id = $1 AND (r.external_url = $2 OR r.external_url = $3)
      FOR UPDATE OF c`, [course.id, entry.url, entry.previousUrl ?? null])).rows;
    if (existing.length) {
      assert.equal(existing.length, 1, 'Duplicate Drive resource found');
      assert.ok(existing[0].is_active && existing[0].topic_id === topic.id && existing[0].resource_type === input.resourceType, 'Existing resource placement differs');
      if (existing[0].external_url === entry.url) skipped++;
      else if (apply) {
        const submissionId = await queryCreateResourceEdit(client, existing[0].public_id, admins[0].public_id, input);
        assert.ok(submissionId);
        // Edit only the new pending snapshot; historical revisions remain immutable.
        const changed = await client.query(`UPDATE coursedekho.content_submission
          SET external_url = $2, description = $3 WHERE public_id = $1::uuid AND status = 'pending'`,
        [submissionId, input.externalUrl, input.description]);
        assert.equal(changed.rowCount, 1);
        assert.equal(await queryApproveSubmission(client, { submissionId, reviewerId: admins[0].public_id, reviewedAt: new Date() }), true);
        updated++;
      }
    } else if (apply) {
      const submissionId = await queryCreateSubmission(client, { contributorId: admins[0].public_id, ...input });
      assert.ok(submissionId);
      assert.equal(await queryApproveSubmission(client, { submissionId, reviewerId: admins[0].public_id, reviewedAt: new Date() }), true);
      created++;
    }
  }
  if (apply) {
    const saved = (await client.query(`SELECT t.public_id AS topic_id, r.title, r.resource_type, r.external_url,
        r.storage_key, s.status FROM coursedekho.content c
      JOIN coursedekho.content_revision r ON r.id = c.current_revision_id
      JOIN coursedekho.content_submission s ON s.id = r.submission_id
      JOIN coursedekho.topic t ON t.id = c.topic_id
      WHERE t.course_id = $1 AND c.is_active AND r.external_url = ANY($2::text[])`, [course.id, plans.map(p => p.input.externalUrl)])).rows;
    assert.equal(saved.length, 21);
    for (const { input } of plans) {
      const row = saved.find(r => r.external_url === input.externalUrl);
      assert.ok(row && row.topic_id === input.topicId && row.resource_type === input.resourceType && row.status === 'approved' && row.storage_key === null);
    }
    await client.query('COMMIT');
  } else await client.query('ROLLBACK');
  console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', course: 'CSE-209', topics: topics.length, links: plans.length, created, updated, skipped, questions: 7, practice: 14 }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exitCode = 1;
} finally { await client.end(); }
