import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SupportService } from '../../lib/server/support/service.ts';
import { createSupportHandler } from '../../lib/server/support/http-handlers.ts';
const id = '00000000-0000-4000-8000-000000000101';
const user = { id, role: 'learner', name: 'Learner', email: 'learner@example.test' };
function req(body, origin = 'http://localhost', cookie = false) {
  return new Request('http://localhost/api/v1/support', { method: body === undefined ? 'GET' : 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie: `course_dekho_session=${'a'.repeat(43)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
test('login has exactly one working forgot-password link', async () => {
  const source = await readFile(new URL('../../app/login/page.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/href="\/forgot-password"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /<span[^>]*>Forgot Password\?/);
});
test('support collection requires a session and writes reject untrusted origins and oversized bodies', async () => {
  const service = new Proxy({}, { get() { return () => assert.fail('Unexpected service call'); } });
  const handler = createSupportHandler({ getSessionUser: async () => user }, service);
  assert.equal((await handler(req(), 'collection')).status, 401);
  assert.equal((await handler(req({}), 'collection')).status, 401);
  assert.equal((await handler(req({}, 'https://untrusted.test'), 'recovery')).status, 403);
  assert.equal((await handler(req({ message: 'a'.repeat(25000) }), 'recovery')).status, 400);
});
test('forged owners and message authors are rejected before database writes', async () => {
  const service = new SupportService({ connect() { assert.fail('Unexpected write'); } });
  await assert.rejects(service.create(user, { category: 'problem', subject: 'Test', message: 'Help', userId: id }), { status: 400 });
  await assert.rejects(service.create({ ...user, role: 'admin' }, { category: 'problem', subject: 'Test', message: 'Help' }), { status: 403 });
  await assert.rejects(service.create(null, { name: 'Person', email: 'x@example.test', identifier: 'x', message: 'Help', category: 'suggestion' }), { status: 400 });
  await assert.rejects(service.reply(id, user, undefined, { message: 'Help', status: 'resolved' }), { status: 400 });
  await assert.rejects(service.reply(id, user, undefined, { message: 'Help', sender: 'admin' }), { status: 400 });
});
test('private conversation reads fail closed and never query messages without authorization', async () => {
  const queries = [];
  const service = new SupportService({ query: async query => { queries.push(query); return { rows: [] }; } });
  await assert.rejects(service.thread(id, null), { status: 404 });
  assert.equal(queries.length, 0);
  await assert.rejects(service.thread(id, user), { status: 404 });
  assert.equal(queries.length, 1);
  assert.match(queries[0].text, /t.user_id=/);
  await assert.rejects(service.thread(id, null, 'b'.repeat(43)), { status: 404 });
  assert.equal(queries.length, 2);
  assert.notEqual(queries[1].values[3], 'b'.repeat(43));
  assert.match(queries[1].values[3], /^[0-9a-f]{64}$/);
});
test('initial message failure rolls back the ticket and releases the connection', async () => {
  const calls = [];
  const service = new SupportService({ connect: async () => ({ query: async query => {
    calls.push(query);
    if (query.text?.includes('INSERT INTO coursedekho.support_message')) throw new Error('Message failed');
    if (query.text?.includes('INSERT INTO coursedekho.support_ticket')) return { rows: [{ id, internal_id: '1' }] };
    return { rows: [{ count: 0 }] };
  }, release() { calls.push('release'); } }) });
  await assert.rejects(service.create(user, { category: 'problem', subject: 'Test', message: 'Help' }), /Message failed/);
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
  assert.ok(!calls.includes('COMMIT'));
});
