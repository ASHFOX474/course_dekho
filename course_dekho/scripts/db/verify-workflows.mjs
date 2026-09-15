// Exercises the real database through application handlers. Never commits test data.
import assert from 'node:assert/strict';
import pg from 'pg';
import { randomBytes, createHash } from 'node:crypto';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { AuthService } from '../../lib/server/auth/service.ts';
import { WorkspaceService } from '../../lib/server/workspace/service.ts';
import { createWorkspaceHttpHandlers } from '../../lib/server/workspace/http-handlers.ts';
import { createAttachmentHandler } from '../../lib/server/storage/http-handlers.ts';
import { removeFile } from '../../lib/server/storage/files.ts';

const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)), connectionTimeoutMillis: 10000 });
const uploaded = [];
let begun = false;
try {
  await client.connect();
  await client.query('BEGIN'); begun = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  // Nested application transactions become savepoints so even approval is rolled back.
  const adapter = {
    query: (...args) => client.query(...args),
    connect: async () => ({
      query: (query, ...args) => client.query(query === 'BEGIN' ? 'SAVEPOINT workflow_operation' : query === 'COMMIT' ? 'RELEASE SAVEPOINT workflow_operation' : query === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT workflow_operation' : query, ...args),
      release() {},
    }),
  };
  const auth = new AuthService({ pool: adapter });
  const workspace = new WorkspaceService({ pool: adapter });
  const handlers = createWorkspaceHttpHandlers({ authService: auth, workspaceService: workspace });
  const attachment = createAttachmentHandler(adapter, auth);
  const accounts = (await client.query("SELECT id, public_id, role FROM coursedekho.app_user WHERE is_active AND registration_status = 'approved' ORDER BY id")).rows;
  const selected = {};
  for (const role of ['contributor', 'learner', 'admin']) {
    selected[role] = accounts.find(row => row.role === role);
    assert.ok(selected[role], `An approved ${role} account is needed for verification.`);
  }
  const topic = (await client.query(`SELECT t.public_id AS topic_id, c.public_id AS course_id FROM coursedekho.topic t JOIN coursedekho.course c ON c.id=t.course_id JOIN coursedekho.university u ON u.id=c.university_id JOIN coursedekho.semester s ON s.id=c.semester_id WHERE t.is_active AND c.is_active AND u.is_active AND s.is_active LIMIT 1`)).rows[0];
  assert.ok(topic, 'An active topic is needed.');
  async function session(role) {
    const token = randomBytes(32).toString('base64url');
    await client.query("INSERT INTO coursedekho.auth_session (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [selected[role].id, createHash('sha256').update(token).digest('hex')]);
    return token;
  }
  const tokens = {};
  for (const role of Object.keys(selected)) tokens[role] = await session(role);
  const request = (role, body, suffix = '') => new Request(`http://localhost/api/v1/submissions${suffix}`, {
    method: body ? 'POST' : 'GET', headers: { cookie: `course_dekho_session=${tokens[role]}`, origin: 'http://localhost', ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  async function submit(name, bytes) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ resourceType: 'study_material', title: 'Temporary workflow verification', description: 'Rolled back after verification', courseId: topic.course_id, topicId: topic.topic_id, externalUrl: 'https://drive.google.com/file/d/verification/view' })) form.append(key, value);
    form.append('file', new File([bytes], name));
    assert.equal((await handlers.createSubmission(request('learner', form))).status, 403);
    const response = await handlers.createSubmission(request('contributor', form));
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    const id = body.data.id;
    const row = (await client.query('SELECT storage_key FROM coursedekho.content_submission WHERE public_id=$1', [id])).rows[0];
    uploaded.push(row.storage_key);
    assert.equal((await attachment(request('learner'), id, 'submissions')).status, 404);
    assert.equal((await attachment(request('admin'), id, 'submissions')).status, 200);
    return id;
  }
  const pdf = Buffer.from('%PDF-1.4\nworkflow verification');
  const submissionId = await submit('verification.pdf', pdf);
  assert.equal((await handlers.approveSubmission(request('contributor', {}), submissionId)).status, 403);
  const approved = await handlers.approveSubmission(request('admin', {}), submissionId);
  assert.equal(approved.status, 200, await approved.text());
  const resourceId = (await client.query('SELECT c.public_id FROM coursedekho.content c JOIN coursedekho.content_revision r ON r.id=c.current_revision_id JOIN coursedekho.content_submission s ON s.id=r.submission_id WHERE s.public_id=$1', [submissionId])).rows[0].public_id;
  assert.deepEqual(Buffer.from(await (await attachment(request('learner'), resourceId, 'resources')).arrayBuffer()), pdf);
  const info = await (await attachment(request('learner', undefined, '?info=1'), resourceId, 'resources')).json();
  assert.equal(info.data.externalUrl, 'https://drive.google.com/file/d/verification/view');
  const rejectedId = await submit('verification.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64'));
  assert.equal((await handlers.rejectSubmission(request('admin', { reason: 'Verification rejection' }), rejectedId)).status, 200);
  assert.equal((await attachment(request('learner'), rejectedId, 'submissions')).status, 404);
  assert.equal((await client.query('SELECT rejection_reason FROM coursedekho.content_submission WHERE public_id=$1', [rejectedId])).rows[0].rejection_reason, 'Verification rejection');
  console.log('PASS: real multipart upload, admin review, approval, PDF delivery, Drive link, image rejection, and role restrictions.');

  const learner = await auth.getSessionUser(tokens.learner);
  const contributor = await auth.getSessionUser(tokens.contributor);
  await workspace.createEnrollment(learner, topic.course_id);
  const bookmark = await workspace.createBookmark(learner, { targetType: 'resource', targetId: resourceId });
  await workspace.updateProgress(learner, topic.topic_id, 63);
  assert.equal((await workspace.listBookmarks(contributor)).some(row => row.id === bookmark.id), false);
  await assert.rejects(workspace.deleteBookmark(contributor, bookmark.id), /not found/i);
  await auth.logout(tokens.learner);
  await assert.rejects(auth.getSessionUser(tokens.learner));
  tokens.learner = await session('learner');
  const freshLearner = await new AuthService({ pool: adapter }).getSessionUser(tokens.learner);
  const freshWorkspace = new WorkspaceService({ pool: adapter });
  assert.ok((await freshWorkspace.listBookmarks(freshLearner)).some(row => row.id === bookmark.id));
  assert.equal((await freshWorkspace.getLearning(freshLearner)).topics.find(row => row.topicId === topic.topic_id).progressPercent, 63);
  console.log('PASS: bookmark ownership, progress persistence, session revocation and access through a fresh session.');
} catch (error) {
  console.error('Workflow verification failed:', error instanceof assert.AssertionError ? error.message : error.name, error.code || '');
  process.exitCode = 1;
} finally {
  if (begun) await client.query('ROLLBACK');
  await client.end();
  for (const key of uploaded) await removeFile(key);
  console.log('Verification records rolled back; temporary uploads removed.');
}
