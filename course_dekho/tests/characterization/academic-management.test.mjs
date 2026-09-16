import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcademicHandler } from '../../lib/server/catalog/academic-http-handlers.ts';
import { mutateAcademicRecord, validateAcademicMutation } from '../../lib/server/catalog/academic-management.ts';

const id = '00000000-0000-4000-8000-000000000201';
const parentId = '00000000-0000-4000-8000-000000000202';
const neighborId = '00000000-0000-4000-8000-000000000203';
const form = { action: 'create', kind: 'university', name: 'Example', shortName: 'EX' };
function request(body, cookie = true, origin = 'http://localhost') {
  return new Request('http://localhost/api/v1/admin/academics', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', origin, ...(cookie ? { cookie: `course_dekho_session=${'a'.repeat(43)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('academic reads and every mutation require an admin before accessing the database', async () => {
  const pool = { query() { assert.fail('Unauthorized query'); }, connect() { assert.fail('Unauthorized transaction'); } };
  for (const role of ['learner', 'contributor']) {
    const handler = createAcademicHandler(pool, { getSessionUser: async () => ({ id, role }) });
    for (const body of [undefined, form, ...['edit', 'archive', 'restore', 'move'].map(action => ({ action, kind: 'topic', id }))]) {
      assert.equal((await handler(request(body))).status, 403);
      assert.equal((await handler(request(body, false))).status, 401);
    }
  }
  const handler = createAcademicHandler(pool, { getSessionUser: async () => ({ id, role: 'admin' }) });
  assert.equal((await handler(request(form, true, 'https://untrusted.test'))).status, 403);
});

test('validation rejects forged identifiers, parent moves and unsupported field changes', () => {
  for (const body of [null, [], { ...form, kind: 'constructor' }, { ...form, kind: 'topic; DROP TABLE topic' },
    { ...form, name: ' ' }, { ...form, shortName: '' }, { ...form, isActive: true },
    { action: 'edit', kind: 'topic', id, name: 'Arrays', parentId },
    { action: 'create', kind: 'topic', name: 'Arrays', parentId: 'bad' },
    { action: 'move', kind: 'course', id, direction: 'up' },
    { action: 'move', kind: 'topic', id, direction: 'sideways' }]) {
    assert.throws(() => validateAcademicMutation(body), { status: 400 });
  }
  assert.deepEqual(validateAcademicMutation({ action: 'create', kind: 'course', parentId, name: ' Algorithms ', code: 'cse-201' }),
    { action: 'create', kind: 'course', parentId, name: 'Algorithms', code: 'CSE-201', description: '' });
});

function transactionPool(records, failUpdate = 0) {
  const calls = [];
  let updates = 0;
  return { calls, connect: async () => ({
    async query(query) {
      calls.push(query);
      if (typeof query === 'string') return { rows: [] };
      if (query.text.includes('UNION ALL')) return { rows: records };
      if (query.text.startsWith('UPDATE') && ++updates === failUpdate) throw new Error('Simulated database failure');
      return { rows: [{ id }] };
    },
    release() { calls.push('release'); },
  }) };
}
const course = { id: parentId, kind: 'course', parentId: 'semester', isActive: true, parentActive: true };
const first = { id, kind: 'topic', parentId, isActive: true, parentActive: true, sequenceOrder: 1 };
const second = { ...first, id: neighborId, sequenceOrder: 3 };
const archived = { ...first, id: 'archived', sequenceOrder: 7, isActive: false };

test('reordering reserves a free slot beyond archived topics and rolls back a partial swap', async () => {
  const pool = transactionPool([course, first, second, archived]);
  await mutateAcademicRecord(pool, { action: 'move', kind: 'topic', id, direction: 'down' });
  assert.deepEqual(pool.calls.filter(call => call.text?.startsWith('UPDATE')).map(call => call.values), [[id, 8], [neighborId, 1], [id, 3]]);
  assert.deepEqual(pool.calls.slice(-2), ['COMMIT', 'release']);
  const failing = transactionPool([course, first, second], 2);
  await assert.rejects(mutateAcademicRecord(failing, { action: 'move', kind: 'topic', id, direction: 'down' }), /Simulated/);
  assert.deepEqual(failing.calls.slice(-2), ['ROLLBACK', 'release']);
  assert.ok(!failing.calls.includes('COMMIT'));
});

test('missing parents and archived ancestors block writes, with rollback and no updates', async () => {
  for (const records of [[], [{ ...course, isActive: false }], [{ ...course, parentActive: false }]]) {
    const pool = transactionPool(records);
    await assert.rejects(mutateAcademicRecord(pool, { action: 'create', kind: 'topic', parentId, name: 'Arrays' }));
    assert.equal(pool.calls.some(call => call.text?.startsWith('INSERT')), false);
    assert.deepEqual(pool.calls.slice(-2), ['ROLLBACK', 'release']);
  }
});

test('archive preserves child records and edits keep public identity, slug and parent stable', async () => {
  const pool = transactionPool([course, first, second]);
  await mutateAcademicRecord(pool, { action: 'archive', kind: 'topic', id });
  const updates = pool.calls.filter(call => call.text?.startsWith('UPDATE'));
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].values, [id, false]);
  assert.match(updates[0].text, /archived_at/);
  const edit = transactionPool([course, first]);
  await mutateAcademicRecord(edit, { action: 'edit', kind: 'topic', id, name: "Array's basics", description: 'Example' });
  const query = edit.calls.find(call => call.text?.startsWith('UPDATE'));
  assert.match(query.text, /SET name = \$1, description = \$2 WHERE public_id/);
  assert.deepEqual(query.values, ["Array's basics", 'Example', id]);
  assert.doesNotMatch(query.text, /Array's/);
});
