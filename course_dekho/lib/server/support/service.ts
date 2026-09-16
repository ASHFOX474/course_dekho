import type { DatabaseExecutor } from '../db/executor.ts';
import { withTransaction, type TransactionPool } from '../db/transaction.ts';
import type { AuthenticatedUser } from '../domain/models.ts';
import { ConflictError, NotFoundError, ValidationError } from '../api/errors.ts';
import { requireRole } from '../auth/authorization.ts';
import { createSessionToken, hashSessionToken } from '../auth/session.ts';
import { accountForm, accountText } from '../auth/account-service.ts';
import type { SupportTicket, SupportThread } from '../../support.ts';

type Pool = DatabaseExecutor & TransactionPool;
const ticketSelect = `SELECT t.public_id::text AS id, u.public_id::text AS "userId", t.category, t.subject,
  t.contact_name AS "contactName", t.contact_email AS "contactEmail", t.account_identifier AS "accountIdentifier",
  t.status, t.created_at AS "createdAt", t.updated_at AS "updatedAt"
  FROM coursedekho.support_ticket t LEFT JOIN coursedekho.app_user u ON u.id=t.user_id`;
const missing = () => new NotFoundError('This request is unavailable. Sign in or use its private tracking link.');

export class SupportService {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }

  async create(actor: AuthenticatedUser | null, value: unknown) {
    if (actor) requireRole(actor, ['learner', 'contributor']);
    const input = accountForm(value, actor ? ['category', 'subject', 'message'] : ['name', 'email', 'identifier', 'message']);
    const category = actor ? input.category : 'recovery';
    if (actor && category !== 'problem' && category !== 'suggestion') throw new ValidationError('Choose problem or suggestion.', {});
    const subject = actor ? accountText(input.subject, 'subject', 200) : 'Account recovery request';
    const name = actor?.name ?? accountText(input.name, 'name', 200);
    const email = actor?.email ?? accountText(input.email, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Enter a valid contact email.', {});
    const identifier = actor ? null : accountText(input.identifier, 'username or registered email', 254);
    const message = accountText(input.message, 'message', 4000);
    const token = actor ? null : createSessionToken();
    return withTransaction(this.pool, async db => {
      // Database-backed limits remain effective across app instances. Do not trust forwarded IP headers.
      await db.query("SELECT pg_advisory_xact_lock(73142, 2)");
      const rate = await db.query<{ count: number }>({ text: `SELECT count(*)::int AS count FROM coursedekho.support_ticket WHERE created_at > clock_timestamp()-interval '1 hour' AND (lower(contact_email)=$1 OR user_id=(SELECT id FROM coursedekho.app_user WHERE public_id=$2::uuid))`, values: [email.toLowerCase(), actor?.id ?? null] });
      if (rate.rows[0].count >= 5) throw new ConflictError('Too many requests. Please try again in an hour or reply to an existing request.');
      if (!actor) {
        const global = await db.query<{ count: number }>("SELECT count(*)::int AS count FROM coursedekho.support_ticket WHERE user_id IS NULL AND created_at > clock_timestamp()-interval '1 hour'");
        if (global.rows[0].count >= 100) throw new ConflictError('The recovery inbox is busy. Please try again later.');
      }
      const created = await db.query<{ internal_id: string; id: string }>({ text: `INSERT INTO coursedekho.support_ticket(user_id,guest_token_hash,category,subject,contact_name,contact_email,account_identifier)
        VALUES((SELECT id FROM coursedekho.app_user WHERE public_id=$1::uuid),$2,$3,$4,$5,$6,$7) RETURNING id::text AS internal_id,public_id::text AS id`, values: [actor?.id ?? null, token ? hashSessionToken(token) : null, category, subject, name, email, identifier] });
      await db.query({ text: `INSERT INTO coursedekho.support_message(ticket_id,author_user_id,sender,body) VALUES($1,(SELECT id FROM coursedekho.app_user WHERE public_id=$2::uuid),'requester',$3)`, values: [created.rows[0].internal_id, actor?.id ?? null, message] });
      return { id: created.rows[0].id, ...(token ? { accessToken: token } : {}) };
    });
  }

  async list(actor: AuthenticatedUser): Promise<SupportTicket[]> {
    requireRole(actor, ['learner', 'contributor', 'admin']);
    return (await this.pool.query<SupportTicket>({ text: `${ticketSelect} WHERE ($1::boolean OR u.public_id=$2::uuid) ORDER BY t.updated_at DESC,t.id DESC LIMIT 200`, values: [actor.role === 'admin', actor.id] })).rows;
  }

  private async authorize(db: DatabaseExecutor, id: string, actor: AuthenticatedUser | null, token?: string, lock = false) {
    if (actor) requireRole(actor, ['learner', 'contributor', 'admin']);
    if (!actor && (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))) throw missing();
    const found = await db.query<{ id: string }>({ text: `SELECT t.id::text FROM coursedekho.support_ticket t WHERE t.public_id=$1::uuid
      AND ($2::boolean OR t.user_id=(SELECT id FROM coursedekho.app_user WHERE public_id=$3::uuid) OR (t.user_id IS NULL AND t.guest_token_hash=$4)) ${lock ? 'FOR UPDATE' : ''}`, values: [id, actor?.role === 'admin', actor?.id ?? null, !actor && token ? hashSessionToken(token) : null] });
    if (!found.rows[0]) throw missing();
    return found.rows[0].id;
  }

  async thread(id: string, actor: AuthenticatedUser | null, token?: string): Promise<SupportThread> {
    const internalId = await this.authorize(this.pool, id, actor, token);
    const ticket = (await this.pool.query<SupportTicket>({ text: `${ticketSelect} WHERE t.id=$1`, values: [internalId] })).rows[0];
    const messages = (await this.pool.query<SupportThread['messages'][number]>({ text: `SELECT id::text, sender, body, created_at AS "createdAt" FROM coursedekho.support_message WHERE ticket_id=$1 ORDER BY created_at,id`, values: [internalId] })).rows;
    return { ticket, messages };
  }

  async reply(id: string, actor: AuthenticatedUser | null, token: string | undefined, value: unknown) {
    const input = accountForm(value, actor?.role === 'admin' ? ['message', 'status'] : ['message']);
    const message = input.message === undefined && actor?.role === 'admin' ? '' : accountText(input.message, 'message', 4000);
    if (input.status !== undefined && input.status !== 'open' && input.status !== 'resolved') throw new ValidationError('Invalid request status.', {});
    if (!message && input.status === undefined) throw new ValidationError('Write a reply or choose a status.', {});
    await withTransaction(this.pool, async db => {
      const internalId = await this.authorize(db, id, actor, token, true);
      if (message) {
        const count = await db.query<{ count: number }>({ text: `SELECT count(*)::int AS count FROM coursedekho.support_message WHERE ticket_id=$1 AND sender='requester' AND created_at > clock_timestamp()-interval '1 hour'`, values: [internalId] });
        if (actor?.role !== 'admin' && count.rows[0].count >= 20) throw new ConflictError('Too many replies. Please wait before sending another message.');
        await db.query({ text: `INSERT INTO coursedekho.support_message(ticket_id,author_user_id,sender,body) VALUES($1,(SELECT id FROM coursedekho.app_user WHERE public_id=$2::uuid),$3,$4)`, values: [internalId, actor?.id ?? null, actor?.role === 'admin' ? 'admin' : 'requester', message] });
      }
      await db.query({ text: `UPDATE coursedekho.support_ticket SET status=COALESCE($2,status),updated_at=clock_timestamp() WHERE id=$1`, values: [internalId, actor?.role === 'admin' ? input.status ?? null : 'open'] });
    });
  }
}
