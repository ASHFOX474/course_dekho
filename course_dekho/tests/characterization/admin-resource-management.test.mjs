import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAcademicRecords } from '../../lib/academic-management.ts';
import { WorkspaceService } from '../../lib/server/workspace/service.ts';
import { createWorkspaceHttpHandlers } from '../../lib/server/workspace/http-handlers.ts';
import { queryRemoveResource } from '../../lib/server/db/queries/workspace-queries.ts';

const id = '00000000-0000-4000-8000-000000000701';
const records = [
  { id: 'u1', kind: 'university', parentId: null }, { id: 'u2', kind: 'university', parentId: null },
  { id: 's1', kind: 'semester', parentId: 'u1' }, { id: 's2', kind: 'semester', parentId: 'u2' },
  { id: 'c1', kind: 'course', parentId: 's1' }, { id: 'c2', kind: 'course', parentId: 's2' },
  { id: 't1', kind: 'topic', parentId: 'c1' }, { id: 't2', kind: 'topic', parentId: 'c2' },
];
test('academic filters show all records when empty and narrow by any selected ancestor', () => {
  for (const kind of ['university', 'semester', 'course', 'topic']) assert.equal(filterAcademicRecords(records, kind).length, 2);
  assert.deepEqual(filterAcademicRecords(records, 'course', { universityId: 'u2', semesterId: '' }).map(row => row.id), ['c2']);
  assert.deepEqual(filterAcademicRecords(records, 'topic', { universityId: 'u1' }).map(row => row.id), ['t1']);
  assert.equal(filterAcademicRecords(records, 'topic', { universityId: 'u1', courseId: 'c2' }).length, 0);
  assert.equal(filterAcademicRecords(records, 'course', { universityId: '', semesterId: '' }).length, 2);
});
test('resource removal requires admin and reports missing resources', async () => {
  let calls = 0;
  const service = new WorkspaceService({ pool: {}, repositoryFactory: () => ({ removeResource: async value => { calls++; return value === id; } }) });
  for (const role of ['learner', 'contributor']) await assert.rejects(service.removeResource({ id, role }, id), { status: 403 });
  assert.equal(calls, 0);
  await service.removeResource({ id, role: 'admin' }, id);
  await assert.rejects(service.removeResource({ id, role: 'admin' }, 'missing'), { status: 404 });
});
test('removal uses a parameterized soft deletion preserving related data', async () => {
  const executor = { query: async query => {
    assert.match(query.text, /UPDATE coursedekho.content SET is_active = FALSE/);
    assert.match(query.text, /archived_at = COALESCE/);
    assert.match(query.text, /current_revision_id IS NOT NULL/);
    assert.doesNotMatch(query.text, /DELETE FROM/);
    assert.deepEqual(query.values, [id]);
    return { rows: [{ id }] };
  } };
  assert.equal(await queryRemoveResource(executor, id), true);
});
test('resource removal HTTP enforces authentication, role, origin and identifier validation', async () => {
  let calls = 0;
  const handlers = role => createWorkspaceHttpHandlers({ authService: { getSessionUser: async () => role ? { id, role } : null }, workspaceService: { removeResource: async () => { calls++; } } });
  const request = (origin = 'http://localhost') => new Request('http://localhost/api/v1/admin/resources/' + id, { method: 'DELETE', headers: { origin, cookie: 'course_dekho_session=' + 'a'.repeat(43) } });
  assert.equal((await handlers(null).removeResource(request(), id)).status, 401);
  for (const role of ['learner', 'contributor']) assert.equal((await handlers(role).removeResource(request(), id)).status, 403);
  assert.equal((await handlers('admin').removeResource(request('https://evil.example'), id)).status, 403);
  assert.equal((await handlers('admin').removeResource(request(), 'bad')).status, 400);
  assert.equal(calls, 0);
  assert.equal((await handlers('admin').removeResource(request(), id)).status, 204);
  assert.equal(calls, 1);
});
