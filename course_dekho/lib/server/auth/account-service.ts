import type { DatabaseExecutor } from '../db/executor.ts';
import { withTransaction, type TransactionPool } from '../db/transaction.ts';
import { ConflictError, UnauthenticatedError, ValidationError } from '../api/errors.ts';
import type { AuthenticatedUser } from '../domain/models.ts';
import { requireRole } from './authorization.ts';
import { ScryptPasswordHasher } from './password.ts';
import { createSessionToken, hashSessionToken } from './session.ts';

type Pool = DatabaseExecutor & TransactionPool;
type Fields = Record<string, unknown>;
export function accountForm(value: unknown, allowed: string[]): Fields {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new ValidationError('Invalid account form.', {});
  return value as Fields;
}
export function accountText(value: unknown, field: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ValidationError('Check the account details.', { [field]: [`Enter ${field} using at most ${max} characters.`] });
  return value.trim();
}
export function newPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new ValidationError('Check your new password.', { newPassword: ['Use between 8 and 128 characters.'] });
  return value;
}
async function lockUser(db: DatabaseExecutor, id: string) {
  const result = await db.query<{ id: string; password_hash: string }>({ text: `SELECT id::text, password_hash FROM coursedekho.app_user WHERE public_id = $1::uuid AND is_active AND registration_status = 'approved' FOR UPDATE`, values: [id] });
  if (!result.rows[0]) throw new UnauthenticatedError('The account is unavailable.');
  return result.rows[0];
}
async function revokeCredentials(db: DatabaseExecutor, id: string) {
  await db.query({ text: 'UPDATE coursedekho.auth_session SET revoked_at = GREATEST(clock_timestamp(), created_at) WHERE user_id = $1 AND revoked_at IS NULL', values: [id] });
  await db.query({ text: 'UPDATE coursedekho.password_reset_token SET consumed_at = GREATEST(clock_timestamp(), created_at) WHERE user_id = $1 AND consumed_at IS NULL', values: [id] });
}

export class AccountService {
  private readonly pool: Pool;
  constructor(pool: Pool) { this.pool = pool; }
  async updateProfile(actor: AuthenticatedUser, value: unknown) {
    requireRole(actor, ['learner', 'contributor', 'admin']);
    const fields = ['name', ...(actor.role === 'admin' ? [] : ['department']), ...(actor.role === 'learner' ? ['yearOfStudy'] : actor.role === 'contributor' ? ['designation'] : [])];
    const input = accountForm(value, fields);
    const name = accountText(input.name, 'name', 200);
    const department = actor.role !== 'admin' ? accountText(input.department, 'department', 100, false) : null;
    const designation = actor.role === 'contributor' ? accountText(input.designation, 'designation', 100, false) : null;
    const year = input.yearOfStudy;
    if (actor.role === 'learner' && year !== null && (!Number.isInteger(year) || Number(year) < 1 || Number(year) > 6)) throw new ValidationError('Check your year of study.', { yearOfStudy: ['Choose a year from 1 to 6 or leave it blank.'] });
    await withTransaction(this.pool, async db => {
      const user = await lockUser(db, actor.id);
      await db.query({ text: 'UPDATE coursedekho.app_user SET name = $2 WHERE id = $1', values: [user.id, name] });
      if (actor.role === 'learner') await db.query({ text: 'UPDATE coursedekho.student_profile SET department = $2, year_of_study = $3 WHERE user_id = $1', values: [user.id, department || null, year] });
      if (actor.role === 'contributor') await db.query({ text: 'UPDATE coursedekho.teacher_profile SET department = $2, designation = $3 WHERE user_id = $1', values: [user.id, department || null, designation || null] });
    });
  }
  async changePassword(actor: AuthenticatedUser, value: unknown) {
    requireRole(actor, ['learner', 'contributor', 'admin']);
    const input = accountForm(value, ['currentPassword', 'newPassword']);
    if (typeof input.currentPassword !== 'string' || !input.currentPassword.length || input.currentPassword.length > 128) throw new ValidationError('Enter your current password.', {});
    const password = newPassword(input.newPassword);
    if (password === input.currentPassword) throw new ValidationError('Choose a different new password.', {});
    const currentPassword = input.currentPassword;
    const hasher = new ScryptPasswordHasher();
    await withTransaction(this.pool, async db => {
      const user = await lockUser(db, actor.id);
      if (!(await hasher.verify(currentPassword, user.password_hash))) throw new ValidationError('Your current password is incorrect.', {});
      const hash = await hasher.hash(password);
      await db.query({ text: 'UPDATE coursedekho.app_user SET password_hash = $2 WHERE id = $1', values: [user.id, hash] });
      await revokeCredentials(db, user.id);
    });
  }
  async issueRecovery(actor: AuthenticatedUser, targetId: string, value: unknown) {
    requireRole(actor, ['admin']);
    const input = accountForm(value, ['currentPassword']);
    if (typeof input.currentPassword !== 'string' || !input.currentPassword.length || input.currentPassword.length > 128) throw new ValidationError('Enter your admin password.', {});
    const currentPassword = input.currentPassword;
    const token = createSessionToken();
    return withTransaction(this.pool, async db => {
      // Consistent lock order also handles two admins recovering each other's accounts.
      const locked = await db.query<{ id: string; public_id: string; role: string; password_hash: string }>({ text: `SELECT id::text, public_id::text, role, password_hash FROM coursedekho.app_user WHERE public_id = ANY($1::uuid[]) AND is_active AND registration_status = 'approved' ORDER BY id FOR UPDATE`, values: [[actor.id, targetId]] });
      const admin = locked.rows.find(row => row.public_id === actor.id && row.role === 'admin');
      const user = locked.rows.find(row => row.public_id === targetId);
      if (!admin || !(await new ScryptPasswordHasher().verify(currentPassword, admin.password_hash))) throw new ValidationError('Your admin password is incorrect.', {});
      if (!user) throw new ValidationError('Recovery requires an active, approved account.', {});
      await db.query({ text: 'UPDATE coursedekho.password_reset_token SET consumed_at = GREATEST(clock_timestamp(), created_at) WHERE user_id = $1 AND consumed_at IS NULL', values: [user.id] });
      const result = await db.query<{ expiresAt: Date }>({ text: `INSERT INTO coursedekho.password_reset_token (user_id, issued_by_user_id, token_hash) VALUES ($1, (SELECT id FROM coursedekho.app_user WHERE public_id = $2::uuid), $3) RETURNING expires_at AS "expiresAt"`, values: [user.id, actor.id, hashSessionToken(token)] });
      return { token, expiresAt: result.rows[0].expiresAt };
    });
  }
  async resetPassword(value: unknown) {
    const input = accountForm(value, ['token', 'newPassword']);
    if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new ValidationError('This recovery link is invalid or expired.', {});
    const password = newPassword(input.newPassword);
    const digest = hashSessionToken(input.token);
    await withTransaction(this.pool, async db => {
      // Lock user first throughout all password operations to avoid reset/change deadlocks.
      const found = await db.query<{ public_id: string }>({ text: `SELECT u.public_id::text FROM coursedekho.password_reset_token r JOIN coursedekho.app_user u ON u.id = r.user_id WHERE r.token_hash = $1 AND r.consumed_at IS NULL AND r.expires_at > clock_timestamp()`, values: [digest] });
      if (!found.rows[0]) throw new ValidationError('This recovery link is invalid or expired.', {});
      const user = await lockUser(db, found.rows[0].public_id);
      const consumed = await db.query({ text: `UPDATE coursedekho.password_reset_token SET consumed_at = clock_timestamp() WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > clock_timestamp() RETURNING id`, values: [digest] });
      if (!consumed.rows.length) throw new ConflictError('This recovery link is invalid or expired.');
      const hash = await new ScryptPasswordHasher().hash(password);
      await db.query({ text: 'UPDATE coursedekho.app_user SET password_hash = $2 WHERE id = $1', values: [user.id, hash] });
      await revokeCredentials(db, user.id);
    });
  }
}
