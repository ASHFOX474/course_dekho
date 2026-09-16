// Live PostgreSQL verification. All test rows and updates are unconditionally rolled back.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { resolveDatabaseUrl } from './migration-utils.mjs';
import { listAcademicRecords, mutateAcademicRecord, validateAcademicMutation } from '../../lib/server/catalog/academic-management.ts';
import { PostgresCatalogRepository } from '../../lib/server/repositories/catalog-repository.ts';

const client = new pg.Client({ connectionString: await resolveDatabaseUrl(new URL('../../', import.meta.url)), connectionTimeoutMillis: 10000 });
let begun = false;
try {
  await client.connect();
  await client.query('BEGIN'); begun = true;
  await client.query("SET LOCAL statement_timeout = '15s'");
  const adapter = {
    query: (...args) => client.query(...args),
    connect: async () => ({
      query: (query, ...args) => client.query(query === 'BEGIN' ? 'SAVEPOINT academic_operation' : query === 'COMMIT' ? 'RELEASE SAVEPOINT academic_operation' : query === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT academic_operation' : query, ...args),
      release() {},
    }),
  };
  const change = value => mutateAcademicRecord(adapter, validateAcademicMutation(value));
  const catalog = new PostgresCatalogRepository(adapter);
  const university = await change({ action: 'create', kind: 'university', name: 'Verification university', shortName: `TEST-${randomUUID()}` });
  const semester = await change({ action: 'create', kind: 'semester', parentId: university.id, name: 'Semester 1' });
  const semester2 = await change({ action: 'create', kind: 'semester', parentId: university.id, name: 'Semester 2' });
  const course = await change({ action: 'create', kind: 'course', parentId: semester.id, name: 'Verification course', code: 'TEST-101' });
  const first = await change({ action: 'create', kind: 'topic', parentId: course.id, name: 'Arrays' });
  const second = await change({ action: 'create', kind: 'topic', parentId: course.id, name: 'Trees' });
  const third = await change({ action: 'create', kind: 'topic', parentId: course.id, name: 'Graphs' });
  assert.deepEqual((await catalog.listTopics(course.id)).map(row => row.id), [first.id, second.id, third.id]);
  await change({ action: 'move', kind: 'topic', id: second.id, direction: 'up' });
  assert.deepEqual((await catalog.listTopics(course.id)).map(row => row.id), [second.id, first.id, third.id]);
  await change({ action: 'archive', kind: 'topic', id: first.id });
  await change({ action: 'move', kind: 'topic', id: third.id, direction: 'up' });
  assert.deepEqual((await catalog.listTopics(course.id)).map(row => row.id), [third.id, second.id]);
  await change({ action: 'restore', kind: 'topic', id: first.id });
  assert.deepEqual((await catalog.listTopics(course.id)).map(row => row.id), [third.id, first.id, second.id]);
  await change({ action: 'move', kind: 'semester', id: semester2.id, direction: 'up' });
  assert.deepEqual((await catalog.listSemesters(university.id)).map(row => row.id), [semester2.id, semester.id]);
  for (const [kind, item, fields] of [
    ['university', university, { shortName: `EDIT-${randomUUID()}` }],
    ['semester', semester, {}], ['course', course, { code: 'TEST-102', description: 'Changed' }],
    ['topic', second, { description: 'Changed' }],
  ]) {
    await change({ action: 'edit', kind, id: item.id, name: `Updated ${kind}`, ...fields });
    assert.equal((await listAcademicRecords(adapter)).find(row => row.id === item.id).name, `Updated ${kind}`);
  }
  await assert.rejects(change({ action: 'create', kind: 'course', parentId: semester.id, name: 'Duplicate', code: 'TEST-102' }), { code: '23505' });
  await change({ action: 'archive', kind: 'topic', id: first.id });
  for (const [kind, item] of [['course', course], ['semester', semester], ['university', university]]) {
    await change({ action: 'archive', kind, id: item.id });
    assert.equal(await catalog.findCourse(course.id), null);
    assert.equal(await catalog.findTopic(second.id), null);
    await assert.rejects(change({ action: 'create', kind: 'topic', parentId: course.id, name: 'Blocked' }), { status: 409 });
    await assert.rejects(change({ action: 'restore', kind: 'topic', id: first.id }), { status: 409 });
    await change({ action: 'restore', kind, id: item.id });
    assert.ok(await catalog.findCourse(course.id));
    assert.equal(await catalog.findTopic(first.id), null, 'Separately archived topic remains archived');
  }
  console.log('PASS: create/edit all four levels, ordering, uniqueness, archive/restore, parent restrictions, and learner catalog visibility.');
} finally {
  if (begun) { await client.query('ROLLBACK'); console.log('All verification data rolled back.'); }
  await client.end();
}
