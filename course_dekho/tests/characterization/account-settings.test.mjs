import test from 'node:test';
import assert from 'node:assert/strict';
import { AccountService, accountForm, newPassword } from '../../lib/server/auth/account-service.ts';
import { createAccountHandler } from '../../lib/server/auth/account-http-handlers.ts';
import { queryCreateSession } from '../../lib/server/db/queries/auth-queries.ts';
import { ScryptPasswordHasher } from '../../lib/server/auth/password.ts';

const id = '00000000-0000-4000-8000-000000000101';
const actor = { id, role: 'learner' };
const request = (value, authenticated = true, origin = 'http://localhost') => new Request('http://localhost/api/v1/me/password', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(authenticated ? { cookie: `course_dekho_session=${'a'.repeat(43)}` } : {}) }, body: JSON.stringify(value) });

test('profile and password endpoints require sessions; only admins can issue recovery links', async () => {
  const service = new Proxy({}, { get() { return () => assert.fail('Unauthorized service call'); } });
  const handler = createAccountHandler({ getSessionUser: async () => actor }, service);
  for (const action of ['profile', 'password', 'issue']) assert.equal((await handler(request({}, false), action, id)).status, 401);
  assert.equal((await handler(request({}), 'issue', id)).status, 403);
  for (const action of ['profile', 'password', 'issue', 'reset']) assert.equal((await handler(request({}, true, 'https://elsewhere.test'), action, id)).status, 403);
});

test('profile writes reject role, identity and affiliation changes before opening transactions', async () => {
  const service = new AccountService({ connect() { assert.fail('Unexpected transaction'); } });
  for (const input of [{ name: 'Name', role: 'admin' }, { name: 'Name', userId: id }, { name: 'Name', universityId: id }, { name: 'Name', email: 'other@example.test' }, { name: 'Name', department: '', yearOfStudy: 7 }]) {
    await assert.rejects(service.updateProfile(actor, input), { status: 400 });
  }
  assert.throws(() => accountForm([], []), { status: 400 });
  for (const password of ['short', 'a'.repeat(129), null]) assert.throws(() => newPassword(password), { status: 400 });
  assert.equal(newPassword('  long exact password  '), '  long exact password  ');
});

test('password change rejects incorrect current passwords and rolls back without revoking sessions', async () => {
  const hash = await new ScryptPasswordHasher({ cost: 1024 }).hash('correct password');
  const calls = [];
  const service = new AccountService({ connect: async () => ({
    query: async query => { calls.push(query); return { rows: query.text?.includes('FOR UPDATE') ? [{ id: '1', password_hash: hash }] : [] }; },
    release() { calls.push('release'); },
  }) });
  await assert.rejects(service.changePassword(actor, { currentPassword: 'wrong', newPassword: 'a new long password' }), { status: 400 });
  assert.ok(!calls.some(query => query.text?.startsWith('UPDATE')));
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release']);
});

test('a stale password cannot create a session after a concurrent change', async () => {
  const seen = [];
  await assert.rejects(queryCreateSession({ query: async query => { seen.push(query); return { rows: [{ password_hash: 'new-hash' }] }; } }, { userInternalId: '1', expectedPasswordHash: 'old-hash' }), { status: 401 });
  assert.equal(seen.length, 1);
  assert.match(seen[0].text, /FOR UPDATE/);
});

test('reset completion clears the cookie; service errors do not report success', async () => {
  const handler = createAccountHandler({}, { resetPassword: async () => {} });
  const response = await handler(request({}), 'reset');
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const failing = createAccountHandler({}, { resetPassword: async () => { throw new Error('Database failure'); } });
  assert.equal((await failing(request({}), 'reset')).status, 500);
});
