import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCourseHandler } from '../../lib/server/catalog/admin-http-handlers.ts';
const id = '00000000-0000-4000-8000-000000000201';
const form = { universityId: id, semesterId: id, code: 'cse-301', name: 'Algorithms', description: 'Analysis and design' };
function request(value = form, authenticated = true, origin = 'http://localhost') {
  return new Request('http://localhost/api/v1/admin/courses', { method: 'POST', headers: { 'content-type': 'application/json', origin, ...(authenticated ? { cookie: `course_dekho_session=${'a'.repeat(43)}` } : {}) }, body: JSON.stringify(value) });
}
test('only admins can create courses, and untrusted origins are rejected before writing', async () => {
  let writes = 0;
  for (const role of ['learner', 'contributor', 'admin']) {
    const handler = createAdminCourseHandler({ query: async () => { writes++; return { rows: [{ id }] }; } }, { getSessionUser: async () => ({ id, role }) });
    assert.equal((await handler(request())).status, role === 'admin' ? 201 : 403);
    assert.equal((await handler(request(form, false))).status, 401);
    assert.equal((await handler(request(form, true, 'http://untrusted.test'))).status, 403);
  }
  assert.equal(writes, 1);
});
test('course creation validates fields, parameterizes values and checks semester ownership', async () => {
  let query;
  const handler = createAdminCourseHandler({ query: async value => { query = value; return { rows: [{ id }] }; } }, { getSessionUser: async () => ({ id, role: 'admin' }) });
  assert.equal((await handler(request({ ...form, name: ' ' }))).status, 400);
  assert.equal((await handler(request({ ...form, is_active: true }))).status, 400);
  assert.equal((await handler(request())).status, 201);
  assert.equal(query.values[3], 'CSE-301');
  assert.match(query.text, /s.university_id = u.id/);
  assert.match(query.text, /u.is_active AND s.is_active/);
  assert.equal(query.text.includes(form.description), false);
});
test('missing parent selections and duplicate course codes produce useful errors', async () => {
  const auth = { getSessionUser: async () => ({ id, role: 'admin' }) };
  const missing = createAdminCourseHandler({ query: async () => ({ rows: [] }) }, auth);
  assert.equal((await missing(request())).status, 404);
  const duplicate = createAdminCourseHandler({ query: async () => { throw { code: '23505' }; } }, auth);
  const response = await duplicate(request());
  assert.equal(response.status, 409);
  assert.match((await response.json()).error.message, /already exists/);
});
