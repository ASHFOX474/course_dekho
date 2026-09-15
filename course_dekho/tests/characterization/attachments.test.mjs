import test from 'node:test';
import assert from 'node:assert/strict';
import { saveFile, loadFile, removeFile, readSubmissionForm } from '../../lib/server/storage/files.ts';
import { createAttachmentHandler } from '../../lib/server/storage/http-handlers.ts';
import { validateCreateSubmissionRequest } from '../../lib/server/api/validation.ts';
import { createWorkspaceHttpHandlers } from '../../lib/server/workspace/http-handlers.ts';
import { queryCreateSubmission } from '../../lib/server/db/queries/workspace-queries.ts';

const id = '00000000-0000-4000-8000-000000000701';
const input = { resourceType: 'study_material', title: 'Lecture', description: 'Notes', courseId: id, topicId: id };
const actor = { id, role: 'contributor', name: 'Teacher' };
const authService = { getSessionUser: async () => actor };
const cookie = 'course_dekho_session=' + 'a'.repeat(43);
test('Drive links validate; dangerous links and client storage keys are rejected', () => {
  assert.equal(validateCreateSubmissionRequest({ ...input, externalUrl: 'https://drive.google.com/file/d/example/view' }).externalUrl, 'https://drive.google.com/file/d/example/view');
  for (const externalUrl of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.com']) assert.throws(() => validateCreateSubmissionRequest({ ...input, externalUrl }));
  assert.throws(() => validateCreateSubmissionRequest({ ...input, storageKey: 'forged' }));
});
test('real multipart file round trips through private storage and rejects disguised images', async () => {
  const form = new FormData();
  form.append('title', 'Lecture');
  form.append('file', new File(['%PDF-1.4\nexample'], 'lecture.pdf', { type: 'application/pdf' }));
  const parsed = await readSubmissionForm(new Request('http://localhost', { method: 'POST', body: form }));
  assert.equal(parsed.input.title, 'Lecture');
  const stored = await saveFile(parsed.file);
  try { assert.equal((await loadFile(stored.storageKey)).toString(), '%PDF-1.4\nexample'); }
  finally { await removeFile(stored.storageKey); }
  await assert.rejects(saveFile(new File(['<script>bad</script>'], 'picture.png')));
  await assert.rejects(loadFile('../secret'));
});
test('submission SQL stores attachment metadata and link together', async () => {
  let query;
  await queryCreateSubmission({ query: async q => { query = q; return { rows: [] }; } }, { ...input, contributorId: id, externalUrl: 'https://drive.google.com/', file: { storageKey: id, originalFileName: 'notes.pdf', mimeType: 'application/pdf', fileSizeBytes: 10, checksumSha256: 'a'.repeat(64) } });
  assert.match(query.text, /storage_key, original_file_name, mime_type, file_size_bytes, checksum_sha256/);
  assert.deepEqual(query.values.slice(6), ['https://drive.google.com/', id, 'notes.pdf', 'application/pdf', 10, 'a'.repeat(64)]);
});
test('multipart submission reaches service and learner submissions are forbidden', async () => {
  let saved;
  const submission = { ...input, id, contributor: { id, name: 'Teacher' }, courseCode: 'CS', topicName: 'Topic', status: 'pending', submittedAt: new Date(), reviewedBy: null, reviewedAt: null, rejectionReason: null };
  const handlers = createWorkspaceHttpHandlers({ authService, workspaceService: { createSubmission: async (_, value) => { saved = value; return submission; } } });
  const form = new FormData();
  for (const [key, value] of Object.entries({ ...input, externalUrl: 'https://drive.google.com/' })) form.append(key, value);
  const request = () => new Request('http://localhost/api/v1/submissions', { method: 'POST', headers: { cookie, origin: 'http://localhost' }, body: form });
  const response = await handlers.createSubmission(request());
  assert.equal(response.status, 201, await response.text());
  assert.equal(saved.externalUrl, 'https://drive.google.com/');
  const denied = createWorkspaceHttpHandlers({ authService: { getSessionUser: async () => ({ ...actor, role: 'learner' }) }, workspaceService: {} });
  assert.equal((await denied.createSubmission(request())).status, 403);
});
test('attachment requests require authentication and publication or ownership filters', async () => {
  let query;
  const db = { query: async q => { query = q; return { rows: [] }; } };
  const handler = createAttachmentHandler(db, authService);
  assert.equal((await handler(new Request('http://localhost'), id, 'resources')).status, 401);
  assert.equal((await handler(new Request('http://localhost', { headers: { cookie } }), id, 'resources')).status, 404);
  assert.match(query.text, /s.status = 'approved'/);
  assert.match(query.text, /c.is_active/);
  await handler(new Request('http://localhost', { headers: { cookie } }), id, 'submissions');
  assert.match(query.text, /u.public_id = \$3::uuid/);
  assert.deepEqual(query.values, [id, 'contributor', id]);
});

test('uploaded PDF is served as identical bytes with protected preview/download headers', async () => {
  const stored = await saveFile(new File(['%PDF-1.4\nlecture'], 'lecture.pdf'));
  try {
    const db = { query: async () => ({ rows: [{ storage_key: stored.storageKey, original_file_name: stored.originalFileName, mime_type: stored.mimeType, external_url: 'https://drive.google.com/' }] }) };
    const handler = createAttachmentHandler(db, authService);
    const get = url => handler(new Request(url, { headers: { cookie } }), id, 'resources');
    const preview = await get('http://localhost/attachment');
    assert.equal(await preview.text(), '%PDF-1.4\nlecture');
    assert.match(preview.headers.get('content-disposition'), /^inline;/);
    assert.equal(preview.headers.get('cache-control'), 'private, no-store');
    const download = await get('http://localhost/attachment?download=1');
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    const info = await (await get('http://localhost/attachment?info=1')).json();
    assert.equal(info.data.fileName, 'lecture.pdf');
    assert.equal(info.data.externalUrl, 'https://drive.google.com/');
    assert.equal(JSON.stringify(info).includes(stored.storageKey), false);
  } finally { await removeFile(stored.storageKey); }
});

test('failed database submission removes the uploaded file', async () => {
  let stored;
  const handlers = createWorkspaceHttpHandlers({ authService, workspaceService: { createSubmission: async (_, input) => { stored = input.file; throw new Error('Database unavailable'); } } });
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.append(key, value);
  form.append('file', new File(['%PDF-1.4\nlecture'], 'lecture.pdf'));
  const response = await handlers.createSubmission(new Request('http://localhost/api/v1/submissions', { method: 'POST', headers: { cookie, origin: 'http://localhost' }, body: form }));
  assert.equal(response.status, 500);
  assert.ok(stored.storageKey);
  await assert.rejects(loadFile(stored.storageKey), /missing/);
});
