import { randomUUID } from 'node:crypto';
import type { AcademicKind, AcademicMutation, AcademicRecord } from '../../academic-management.ts';
import { ConflictError, NotFoundError, ValidationError } from '../api/errors.ts';
import { validatePublicId } from '../api/validation.ts';
import type { DatabaseExecutor } from '../db/executor.ts';
import { withTransaction, type TransactionPool } from '../db/transaction.ts';

// SQL identifiers come exclusively from this allowlist, never from request text.
const entities = {
  university: { parent: null, foreignKey: null },
  semester: { parent: 'university', foreignKey: 'university_id' },
  course: { parent: 'semester', foreignKey: 'semester_id' },
  topic: { parent: 'course', foreignKey: 'course_id' },
} as const;

export function validateAcademicMutation(input: unknown): AcademicMutation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Invalid academic form.', {});
  const value = input as Record<string, unknown>;
  if (typeof value.kind !== 'string' || !Object.hasOwn(entities, value.kind)) throw new ValidationError('Invalid academic item type.', {});
  const kind = value.kind as AcademicKind;
  if (typeof value.action !== 'string' || !['create', 'edit', 'archive', 'restore', 'move'].includes(value.action)) throw new ValidationError('Invalid academic action.', {});
  const action = value.action as AcademicMutation['action'];
  const fields = ['action', 'kind', ...(action === 'create' ? (kind === 'university' ? [] : ['parentId']) : ['id'])];
  if (action === 'create' || action === 'edit') fields.push('name', ...(kind === 'university' ? ['shortName'] : kind === 'course' ? ['code', 'description'] : kind === 'topic' ? ['description'] : []));
  if (action === 'move') fields.push('direction');
  if (Object.keys(value).some(key => !fields.includes(key))) throw new ValidationError('Unexpected academic field.', {});
  const result: Record<string, unknown> = { action, kind };
  if (action !== 'create') result.id = validatePublicId(value.id, 'id');
  else if (kind !== 'university') result.parentId = validatePublicId(value.parentId, 'parentId');
  if (action === 'move') {
    if (!['semester', 'topic'].includes(kind) || typeof value.direction !== 'string' || !['up', 'down'].includes(value.direction)) throw new ValidationError('Only semesters and topics can be reordered up or down.', {});
    result.direction = value.direction;
  }
  if (action === 'create' || action === 'edit') {
    for (const key of fields.filter(key => ['name', 'shortName', 'code', 'description'].includes(key))) {
      const maximum = key === 'description' ? 1000 : key === 'name' ? 200 : key === 'code' ? 20 : 50;
      const field = value[key] ?? (key === 'description' ? '' : undefined);
      if (typeof field !== 'string' || field.length > maximum || (key !== 'description' && !field.trim())) throw new ValidationError('Check the academic details.', { [key]: [`${key} must ${key === 'description' ? 'be text' : 'not be empty'} and contain at most ${maximum} characters.`] });
      result[key] = key === 'code' ? field.trim().toUpperCase() : field.trim();
    }
  }
  return result as AcademicMutation;
}

const catalogSql = `
  SELECT u.public_id::text AS id, 'university' AS kind, NULL::text AS "parentId", u.name,
    '' AS description, '' AS code, u.short_name AS "shortName", NULL::integer AS "sequenceOrder",
    u.is_active AS "isActive", true AS "parentActive"
  FROM coursedekho.university u
  UNION ALL
  SELECT s.public_id::text, 'semester', u.public_id::text, s.name, '', '', '', s.sequence_order, s.is_active, u.is_active
  FROM coursedekho.semester s JOIN coursedekho.university u ON u.id = s.university_id
  UNION ALL
  SELECT c.public_id::text, 'course', s.public_id::text, c.name, c.description, c.code, '', NULL::integer,
    c.is_active, s.is_active AND u.is_active
  FROM coursedekho.course c JOIN coursedekho.semester s ON s.id = c.semester_id AND s.university_id = c.university_id
  JOIN coursedekho.university u ON u.id = c.university_id
  UNION ALL
  SELECT t.public_id::text, 'topic', c.public_id::text, t.name, t.description, '', '', t.sequence_order,
    t.is_active, c.is_active AND s.is_active AND u.is_active
  FROM coursedekho.topic t JOIN coursedekho.course c ON c.id = t.course_id
  JOIN coursedekho.semester s ON s.id = c.semester_id AND s.university_id = c.university_id
  JOIN coursedekho.university u ON u.id = c.university_id
  ORDER BY "sequenceOrder" NULLS LAST, name, id`;

export async function listAcademicRecords(db: DatabaseExecutor): Promise<AcademicRecord[]> {
  return (await db.query<AcademicRecord>({ text: catalogSql, values: [] })).rows;
}

export async function mutateAcademicRecord(pool: TransactionPool, input: AcademicMutation): Promise<{ id: string }> {
  return withTransaction(pool, async db => {
    // Serialize structure changes, including creates, archives and ordering, across admins.
    await db.query("SELECT pg_advisory_xact_lock(73142, 1)");
    const records = await listAcademicRecords(db);
    const { kind, action } = input;
    const config = entities[kind];
    const existing = action === 'create' ? undefined : records.find(row => row.kind === kind && row.id === input.id);
    if (action !== 'create' && !existing) throw new NotFoundError('This academic item no longer exists.');
    const parentId = action === 'create' ? input.parentId : existing?.parentId;
    const parent = config.parent ? records.find(row => row.kind === config.parent && row.id === parentId) : undefined;
    if (config.parent && !parent) throw new NotFoundError('Choose a valid parent for this item.');
    if (action !== 'archive' && parent && (!parent.isActive || !parent.parentActive)) throw new ConflictError('Restore the parent structure before changing this item.');

    if (action === 'archive' || action === 'restore') {
      await db.query({ text: `UPDATE coursedekho.${kind} SET is_active = $2, archived_at = CASE WHEN $2 THEN NULL ELSE COALESCE(archived_at, now()) END WHERE public_id = $1::uuid`, values: [input.id, action === 'restore'] });
      return { id: input.id };
    }
    if (action === 'move') {
      if (!existing!.isActive) throw new ConflictError('Restore this item before reordering it.');
      const siblings = records.filter(row => row.kind === kind && row.parentId === existing!.parentId && row.isActive).sort((a, b) => a.sequenceOrder! - b.sequenceOrder!);
      const position = siblings.findIndex(row => row.id === input.id);
      const neighbor = siblings[position + (input.direction === 'up' ? -1 : 1)];
      if (!neighbor) throw new ConflictError('This item is already at the end of the list.');
      const max = Math.max(...records.filter(row => row.kind === kind && row.parentId === existing!.parentId).map(row => row.sequenceOrder!));
      if (max >= 2147483647) throw new ConflictError('No ordering slots remain.');
      // Immediate unique constraints require a free positive slot before swapping.
      // Archived siblings retain their slots. The transaction makes all three writes atomic.
      for (const [id, order] of [[input.id, max + 1], [neighbor.id, existing!.sequenceOrder], [input.id, neighbor.sequenceOrder]]) {
        await db.query({ text: `UPDATE coursedekho.${kind} SET sequence_order = $2 WHERE public_id = $1::uuid`, values: [id, order] });
      }
      return { id: input.id };
    }
    if (action === 'edit') {
      const columns = ['name'];
      const values: unknown[] = [input.name];
      if (kind === 'university') { columns.push('short_name'); values.push(input.shortName); }
      if (kind === 'course') { columns.push('code'); values.push(input.code); }
      if (kind === 'course' || kind === 'topic') { columns.push('description'); values.push(input.description ?? ''); }
      values.push(input.id);
      await db.query({ text: `UPDATE coursedekho.${kind} SET ${columns.map((column, index) => `${column} = $${index + 1}`).join(', ')} WHERE public_id = $${values.length}::uuid`, values });
      return { id: input.id };
    }
    const slug = `${kind}-${randomUUID()}`;
    const columns = ['slug', 'name'];
    const values: unknown[] = [slug, input.name];
    const placeholders = ['$1', '$2'];
    const add = (column: string, value: unknown) => { columns.push(column); values.push(value); placeholders.push(`$${values.length}`); };
    if (kind === 'university') add('short_name', input.shortName);
    if (kind === 'course' || kind === 'topic') add('description', input.description ?? '');
    if (kind === 'course') add('code', input.code);
    if (kind === 'semester' || kind === 'topic') {
      const max = Math.max(0, ...records.filter(row => row.kind === kind && row.parentId === parentId).map(row => row.sequenceOrder!));
      if (max >= 2147483647) throw new ConflictError('No ordering slots remain.');
      add('sequence_order', max + 1);
    }
    if (config.parent) {
      columns.push(config.foreignKey!); values.push(parentId);
      placeholders.push(`(SELECT id FROM coursedekho.${config.parent} WHERE public_id = $${values.length}::uuid)`);
      if (kind === 'course') {
        columns.push('university_id');
        placeholders.push(`(SELECT university_id FROM coursedekho.semester WHERE public_id = $${values.length}::uuid)`);
      }
    }
    const result = await db.query<{ id: string }>({ text: `INSERT INTO coursedekho.${kind} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING public_id::text AS id`, values });
    return result.rows[0];
  });
}
