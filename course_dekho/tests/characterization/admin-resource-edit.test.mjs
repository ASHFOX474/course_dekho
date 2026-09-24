import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../lib/server/workspace/service.ts';
import { createWorkspaceHttpHandlers } from '../../lib/server/workspace/http-handlers.ts';
import { validateResourceEdit } from '../../lib/server/api/validation.ts';

const id = '00000000-0000-4000-8000-000000000701';
const admin = { id, role: 'admin', name: 'Admin' };
const input = { title: 'New title', courseId: id, topicId: id, resourceType: 'book' };
function setup({ missing = false, failed = false } = {}) {
  const calls = [];
  const client = { query: async sql => calls.push(sql), release: () => calls.push('release') };
  const service = new WorkspaceService({ pool: { connect: async () => client }, repositoryFactory: executor => {
    assert.equal(executor, client);
    return {
      createResourceEdit: async (resourceId, actorId, payload) => { assert.equal(resourceId, id); assert.equal(actorId, id); assert.deepEqual(payload, input); calls.push('snapshot'); return missing ? null : id; },
      approveSubmission: async value => { assert.equal(value.reviewerId, id); calls.push('approve'); return failed ? null : { id }; },
    };
  } });
  return { service, calls };
}
test('admin edits commit a new approved revision in one transaction', async () => {
  const { service, calls } = setup();
  await service.editResource(admin, id, input);
  assert.deepEqual(calls, ['BEGIN', 'snapshot', 'approve', 'COMMIT', 'release']);
});
test('failed approval or invalid destination rolls back an edit', async () => {
  for (const options of [{ missing: true }, { failed: true }]) {
    const { service, calls } = setup(options);
    await assert.rejects(service.editResource(admin, id, input));
    assert.equal(calls.includes('COMMIT'), false);
    assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
  }
});
test('learners and contributors cannot edit approved resources directly', async () => {
  const { service, calls } = setup();
  for (const role of ['learner', 'contributor']) await assert.rejects(service.editResource({ ...admin, role }, id, input));
  assert.deepEqual(calls, []);
});
test('edit input rejects invalid names, destinations, categories and asset injection', () => {
  assert.deepEqual(validateResourceEdit(input), input);
  for (const change of [{ title: '' }, { title: 'a'.repeat(201) }, { courseId: 'bad' }, { topicId: '' }, { resourceType: 'unknown' }, { storage_key: 'fake' }]) {
    assert.throws(() => validateResourceEdit({ ...input, ...change }));
  }
});
test('edit HTTP handler enforces session, role, origin and validation', async () => {
  let count = 0;
  const handler = actor => createWorkspaceHttpHandlers({ authService: { getSessionUser: async () => actor }, workspaceService: { editResource: async () => { count++; } } });
  const request = (body = input, origin = 'http://localhost') => new Request('http://localhost/api/v1/admin/resources/' + id, { method: 'PATCH', headers: { cookie: 'course_dekho_session=' + 'a'.repeat(43), origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handler(null).editResource(request(), id)).status, 401);
  for (const role of ['learner', 'contributor']) assert.equal((await handler({ ...admin, role }).editResource(request(), id)).status, 403);
  assert.equal((await handler(admin).editResource(request(input, 'https://evil.example'), id)).status, 403);
  assert.equal((await handler(admin).editResource(request({ ...input, title: '' }), id)).status, 400);
  assert.equal(count, 0);
  assert.equal((await handler(admin).editResource(request(), id)).status, 204);
  assert.equal(count, 1);
});
