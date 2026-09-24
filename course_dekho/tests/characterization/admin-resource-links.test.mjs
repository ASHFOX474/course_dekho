import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkspaceService } from '../../lib/server/workspace/service.ts';
import { createWorkspaceHttpHandlers } from '../../lib/server/workspace/http-handlers.ts';

const id = '00000000-0000-4000-8000-000000000701';
const input = { courseId: id, topicId: id, resourceType: 'question', title: 'Graph exam questions', description: 'Past papers', externalUrl: 'https://drive.google.com/file/d/example/view' };
const admin = { id, name: 'Admin', role: 'admin' };
const approved = { ...input, id, contributor: admin, courseCode: 'DSA-101', topicName: 'Graph', status: 'approved', submittedAt: new Date(), reviewedBy: admin, reviewedAt: new Date(), rejectionReason: null };

function setup(failure = false) {
  const calls = [];
  const client = { query: async statement => { calls.push(statement); }, release: () => calls.push('release') };
  const service = new WorkspaceService({ pool: { connect: async () => client }, repositoryFactory: executor => {
    assert.equal(executor, client);
    return {
      createSubmission: async value => { assert.equal(value.contributorId, id); assert.equal(value.externalUrl, input.externalUrl); assert.equal(value.file, undefined); calls.push('create'); return { id }; },
      approveSubmission: async value => { assert.equal(value.reviewerId, id); calls.push('approve'); return failure ? null : approved; },
    };
  } });
  return { service, calls };
}

test('admin link publication commits its submission and approved revision together without a file', async () => {
  const { service, calls } = setup();
  assert.equal((await service.publishResourceLink(admin, input)).status, 'approved');
  assert.deepEqual(calls, ['BEGIN', 'create', 'approve', 'COMMIT', 'release']);
});

test('failed publication rolls back the new submission', async () => {
  const { service, calls } = setup(true);
  await assert.rejects(service.publishResourceLink(admin, input));
  assert.deepEqual(calls, ['BEGIN', 'create', 'approve', 'ROLLBACK', 'release']);
});

test('learners and contributors cannot publish links, and a link is mandatory', async () => {
  const { service, calls } = setup();
  for (const role of ['learner', 'contributor']) await assert.rejects(service.publishResourceLink({ ...admin, role }, input));
  await assert.rejects(service.publishResourceLink(admin, { ...input, externalUrl: undefined }));
  assert.deepEqual(calls, []);
});

test('admin link HTTP endpoint enforces session, role, trusted origin, and URL validation', async () => {
  let count = 0;
  const handler = actor => createWorkspaceHttpHandlers({ authService: { getSessionUser: async () => actor }, workspaceService: { publishResourceLink: async () => { count++; return approved; } } });
  const request = (body = input, origin = 'http://localhost') => new Request('http://localhost/api/v1/admin/resource-links', { method: 'POST', headers: { cookie: 'course_dekho_session=' + 'a'.repeat(43), origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await handler(null).publishResourceLink(request())).status, 401);
  for (const role of ['learner', 'contributor']) assert.equal((await handler({ ...admin, role }).publishResourceLink(request())).status, 403);
  assert.equal((await handler(admin).publishResourceLink(request(input, 'https://evil.example'))).status, 403);
  for (const externalUrl of ['javascript:alert(1)', 'https://user:pass@example.com']) assert.equal((await handler(admin).publishResourceLink(request({ ...input, externalUrl }))).status, 400);
  assert.equal((await handler(admin).publishResourceLink(request({ ...input, storageKey: 'fake' }))).status, 400);
  assert.equal(count, 0);
  assert.equal((await handler(admin).publishResourceLink(request())).status, 201);
  assert.equal(count, 1);
});
