// Exercise real support SQL without committing verification records.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { SupportService } from '../../lib/server/support/service.ts';
import { hashSessionToken } from '../../lib/server/auth/session.ts';
const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)), connectionTimeoutMillis: 10000 });
let begun = false;
try {
  await client.connect(); await client.query('BEGIN'); begun = true;
  await client.query("SET LOCAL statement_timeout='15s'");
  if (!(await client.query("SELECT to_regclass('coursedekho.support_ticket') AS table_name")).rows[0].table_name) await client.query(await readFile(new URL('../../database/migrations/0010_support_tickets.sql', import.meta.url), 'utf8'));
  const adapter = { query: (...args) => client.query(...args), connect: async () => ({ query: (query, ...args) => client.query(query === 'BEGIN' ? 'SAVEPOINT support_operation' : query === 'COMMIT' ? 'RELEASE SAVEPOINT support_operation' : query === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT support_operation' : query, ...args), release() {} }) };
  const service = new SupportService(adapter);
  const accounts = (await client.query("SELECT public_id::text AS id,name,email,role FROM coursedekho.app_user WHERE is_active AND registration_status='approved'")).rows;
  const admin = accounts.find(row => row.role === 'admin');
  const learner = accounts.find(row => row.role === 'learner');
  const contributor = accounts.find(row => row.role === 'contributor');
  assert.ok(admin && learner && contributor, 'Approved accounts for all roles are required');
  const one = await service.create(learner, { category: 'problem', subject: 'Verification help', message: 'I need help with this resource.' });
  const two = await service.create(contributor, { category: 'suggestion', subject: 'Verification suggestion', message: 'Please consider this improvement.' });
  assert.ok((await service.list(learner)).some(row => row.id === one.id));
  assert.ok(!(await service.list(learner)).some(row => row.id === two.id));
  await assert.rejects(service.thread(one.id, contributor), { status: 404 });
  await assert.rejects(service.reply(one.id, contributor, undefined, { message: 'Unauthorized reply' }), { status: 404 });
  await service.reply(one.id, admin, undefined, { message: 'We can help.' });
  await service.reply(one.id, admin, undefined, { status: 'resolved' });
  assert.equal((await service.thread(one.id, learner)).ticket.status, 'resolved');
  await service.reply(one.id, learner, undefined, { message: 'One more question.' });
  assert.equal((await service.thread(one.id, learner)).ticket.status, 'open');
  const guest = await service.create(null, { name: 'Verification guest', email: `support-${Date.now()}@example.test`, identifier: 'unverified-account', message: 'I cannot sign in.' });
  assert.ok(guest.accessToken);
  const stored = (await client.query('SELECT guest_token_hash FROM coursedekho.support_ticket WHERE public_id=$1', [guest.id])).rows[0];
  assert.equal(stored.guest_token_hash, hashSessionToken(guest.accessToken));
  await assert.rejects(service.thread(guest.id, null, 'a'.repeat(43)), { status: 404 });
  await assert.rejects(service.thread(guest.id, learner), { status: 404 });
  await assert.rejects(service.thread(one.id, null, guest.accessToken), { status: 404 });
  await service.reply(guest.id, admin, undefined, { message: 'Please provide more details.' });
  await service.reply(guest.id, null, guest.accessToken, { message: 'Here are the details.' });
  const thread = await service.thread(guest.id, null, guest.accessToken);
  assert.equal(thread.messages.length, 3);
  assert.equal(thread.ticket.userId, null);
  assert.equal(thread.messages[1].sender, 'admin');
  assert.ok((await service.list(admin)).some(row => row.id === guest.id));
  for (let i = 0; i < 4; i++) await service.create(null, { name: 'Guest', email: thread.ticket.contactEmail, identifier: 'unverified', message: 'Help' });
  await assert.rejects(service.create(null, { name: 'Guest', email: thread.ticket.contactEmail, identifier: 'unverified', message: 'Help' }), { status: 409 });
  console.log('PASS: learner/contributor tickets, admin replies/status, automatic reopen, cross-account denial, hashed private links, guest conversations and request limits.');
} finally {
  if (begun) { await client.query('ROLLBACK'); console.log('All verification records rolled back.'); }
  await client.end();
}
