// Verification records and, if necessary, the new migration are rolled back.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { AccountService } from '../../lib/server/auth/account-service.ts';
import { AuthService } from '../../lib/server/auth/service.ts';
import { ScryptPasswordHasher } from '../../lib/server/auth/password.ts';
import { hashSessionToken } from '../../lib/server/auth/session.ts';

const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)), connectionTimeoutMillis: 10000 });
let begun = false;
try {
  await client.connect(); await client.query('BEGIN'); begun = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  if (!(await client.query("SELECT to_regclass('coursedekho.password_reset_token') AS table_name")).rows[0].table_name) await client.query(await readFile(new URL('../../database/migrations/0009_password_recovery.sql', import.meta.url), 'utf8'));
  const adapter = { query: (...args) => client.query(...args), connect: async () => ({ query: (query, ...args) => client.query(query === 'BEGIN' ? 'SAVEPOINT account_operation' : query === 'COMMIT' ? 'RELEASE SAVEPOINT account_operation' : query === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT account_operation' : query, ...args), release() {} }) };
  const account = new AccountService(adapter);
  const auth = new AuthService({ pool: adapter });
  const password = 'Verification old password!';
  const passwordHash = await new ScryptPasswordHasher().hash(password);
  const uni = (await client.query("INSERT INTO coursedekho.university(slug,name,short_name) VALUES($1,'Account test university',$1) RETURNING id", [`test-${randomUUID()}`])).rows[0].id;
  const users = {};
  for (const role of ['admin', 'learner', 'contributor']) {
    const username = `test_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const row = (await client.query("INSERT INTO coursedekho.app_user(name,email,username,password_hash,role,registration_status,reviewed_at) VALUES('Account test',$1,$2,$3,$4,'approved',now()) RETURNING id,public_id", [`${username}@example.test`, username, passwordHash, role])).rows[0];
    if (role === 'admin') await client.query('INSERT INTO coursedekho.admin_profile(user_id) VALUES($1)', [row.id]);
    else await client.query(`INSERT INTO coursedekho.${role === 'learner' ? 'student_profile' : 'teacher_profile'}(user_id,university_id) VALUES($1,$2)`, [row.id, uni]);
    users[role] = { id: row.public_id, internalId: row.id, role, username };
    await account.updateProfile(users[role], { name: `Updated ${role}`, ...(role !== 'admin' ? { department: 'CSE' } : {}), ...(role === 'learner' ? { yearOfStudy: 3 } : role === 'contributor' ? { designation: 'Lecturer' } : {}) });
    assert.equal((await client.query('SELECT name FROM coursedekho.app_user WHERE id=$1', [row.id])).rows[0].name, `Updated ${role}`);
  }
  const session = await auth.login({ identifier: users.learner.username, password });
  const unused = await account.issueRecovery(users.admin, users.learner.id, { currentPassword: password });
  await assert.rejects(account.changePassword(users.learner, { currentPassword: 'incorrect', newPassword: 'Verification new password!' }));
  await account.changePassword(users.learner, { currentPassword: password, newPassword: 'Verification new password!' });
  await assert.rejects(auth.getSessionUser(session.sessionToken), { status: 401 });
  await assert.rejects(auth.login({ identifier: users.learner.username, password }), { status: 401 });
  await assert.rejects(account.resetPassword({ token: unused.token, newPassword: 'Another new password!' }));
  await auth.login({ identifier: users.learner.username, password: 'Verification new password!' });
  const first = await account.issueRecovery(users.admin, users.learner.id, { currentPassword: password });
  const second = await account.issueRecovery(users.admin, users.learner.id, { currentPassword: password });
  await assert.rejects(account.resetPassword({ token: first.token, newPassword: 'Recovered password!' }));
  const stored = (await client.query('SELECT token_hash FROM coursedekho.password_reset_token WHERE token_hash=$1', [hashSessionToken(second.token)])).rows[0];
  assert.notEqual(stored.token_hash, second.token);
  await account.resetPassword({ token: second.token, newPassword: 'Recovered password!' });
  await assert.rejects(account.resetPassword({ token: second.token, newPassword: 'Reused password!' }));
  await auth.login({ identifier: users.learner.username, password: 'Recovered password!' });
  const expired = await account.issueRecovery(users.admin, users.learner.id, { currentPassword: password });
  await client.query("UPDATE coursedekho.password_reset_token SET created_at=now()-interval '31 minutes', expires_at=now()-interval '1 minute' WHERE token_hash=$1", [hashSessionToken(expired.token)]);
  await assert.rejects(account.resetPassword({ token: expired.token, newPassword: 'Expired password!' }));
  await assert.rejects(account.issueRecovery(users.contributor, users.learner.id, { currentPassword: password }), { status: 403 });
  await assert.rejects(account.issueRecovery(users.admin, users.learner.id, { currentPassword: 'incorrect' }), { status: 400 });
  console.log('PASS: all-role profile persistence, current-password checks, session revocation, old-password rejection, hashed reset tokens, replacement, one-time use, expiry and recovery authorization.');
} finally {
  if (begun) { await client.query('ROLLBACK'); console.log('All verification data rolled back.'); }
  await client.end();
}
