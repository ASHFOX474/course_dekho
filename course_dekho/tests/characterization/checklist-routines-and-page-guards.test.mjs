import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, repositoryRoot), 'utf8');
}

test('every private page performs a server-side session and role check', async () => {
  const roleRestrictedPages = new Map([
    ['app/admin/approvals/page.tsx', "['admin']"],
    ['app/admin/courses/page.tsx', "['admin']"],
    ['app/admin/support/page.tsx', "['admin']"],
    ['app/admin/user-approvals/page.tsx', "['admin']"],
    ['app/contributor/courses/page.tsx', "['contributor']"],
    ['app/contributor/submissions/page.tsx', "['contributor']"],
    ['app/progress/page.tsx', "['learner', 'contributor']"],
    ['app/bookmarks/page.tsx', "['learner', 'contributor']"],
    ['app/access-history/page.tsx', "['learner', 'contributor']"],
    ['app/solved-questions/page.tsx', "['learner', 'contributor']"],
  ]);
  const signedInPages = [
    'app/dashboard/page.tsx',
    'app/courses/page.tsx',
    'app/courses/[courseId]/page.tsx',
    'app/courses/[courseId]/topics/[topicId]/page.tsx',
    'app/resources/[resourceId]/page.tsx',
    'app/profile/page.tsx',
    'app/settings/page.tsx',
    'app/support/page.tsx',
  ];

  for (const [path, roles] of roleRestrictedPages) {
    const page = await source(path);
    assert.match(page, /@\/lib\/server\/auth\/page-guard/);
    assert.ok(page.includes(`requirePageUser(${roles})`), `${path} must require ${roles}`);
    assert.doesNotMatch(page, /['"]use client['"]/);
  }

  for (const path of signedInPages) {
    const page = await source(path);
    assert.match(page, /@\/lib\/server\/auth\/page-guard/);
    assert.match(page, /requirePageUser\(\)/);
    assert.doesNotMatch(page, /['"]use client['"]/);
  }
});

test('interactive page implementations remain client components behind thin wrappers', async () => {
  for (const path of [
    'app/access-history/page-client.tsx',
    'app/admin/approvals/page-client.tsx',
    'app/admin/courses/page-client.tsx',
    'app/admin/user-approvals/page-client.tsx',
    'app/bookmarks/page-client.tsx',
    'app/contributor/courses/page-client.tsx',
    'app/contributor/submissions/page-client.tsx',
    'app/courses/page-client.tsx',
    'app/courses/[courseId]/page-client.tsx',
    'app/courses/[courseId]/topics/[topicId]/page-client.tsx',
    'app/dashboard/page-client.tsx',
    'app/profile/page-client.tsx',
    'app/progress/page-client.tsx',
    'app/resources/[resourceId]/page-client.tsx',
    'app/settings/page-client.tsx',
    'app/solved-questions/page-client.tsx',
  ]) {
    assert.match(await source(path), /^['"]use client['"];?/);
  }
});

test('login, recovery, and token-protected support entry points stay public', async () => {
  for (const path of [
    'app/page.tsx',
    'app/login/page.tsx',
    'app/forgot-password/page.tsx',
    'app/reset-password/page.tsx',
    'app/support/request/[requestId]/page.tsx',
  ]) {
    assert.doesNotMatch(await source(path), /requirePageUser/);
  }
});

test('the page guard validates the database session and fails closed by role', async () => {
  const guard = await source('lib/server/auth/page-guard.ts');
  assert.match(guard, /import 'server-only'/);
  assert.match(guard, /await cookies\(\)/);
  assert.match(guard, /authService\.getSessionUser\(token\)/);
  assert.match(guard, /instanceof UnauthenticatedError[\s\S]*?redirect\('\/login'\)/);
  assert.match(guard, /!roles\.includes\(actor\.role\)[\s\S]*?notFound\(\)/);
  assert.doesNotMatch(guard, /cache\(|unstable_cache/);
});

test('migration 0013 defines the computed function and invoker-rights procedure', async () => {
  const migration = await source('database/migrations/0013_checklist_routines.sql');

  assert.match(migration, /^-- course-dekho:migration 0013/m);
  assert.match(migration, /CREATE FUNCTION coursedekho\.calculate_course_progress/);
  assert.match(migration, /RETURNS INTEGER[\s\S]*?LANGUAGE sql[\s\S]*?STABLE/);
  assert.match(migration, /progress\.user_id = p_user_id/);
  assert.match(migration, /topic\.course_id = p_course_id[\s\S]*?topic\.is_active/);
  assert.match(migration, /NULLIF\(count\(topic\.id\), 0\)/);

  assert.match(migration, /CREATE PROCEDURE coursedekho\.deactivate_user_and_revoke_sessions/);
  assert.match(migration, /role = 'admin'[\s\S]*?registration_status = 'approved'/);
  assert.match(migration, /p_actor_public_id = p_target_public_id/);
  assert.match(migration, /UPDATE coursedekho\.app_user[\s\S]*?UPDATE coursedekho\.auth_session/);
  assert.match(migration, /revoked_at = GREATEST\(p_at, created_at\)/);
  assert.doesNotMatch(migration, /SECURITY DEFINER/i);
  assert.doesNotMatch(migration, /^\s*(COMMIT|ROLLBACK)\s*;/im);
});

test('learning courses use the progress function without duplicate aggregation joins', async () => {
  const queries = await source('lib/server/db/queries/workspace-queries.ts');
  const start = queries.indexOf('export async function queryLearningCourses');
  const end = queries.indexOf('export async function queryTopicProgress');
  const learningQuery = queries.slice(start, end);

  assert.match(learningQuery, /workspace-learning-courses-v2/);
  assert.match(learningQuery, /coursedekho\.calculate_course_progress\(\s*enrollment\.user_id,\s*course\.id\s*\)/);
  assert.doesNotMatch(learningQuery, /JOIN coursedekho\.topic\b/);
  assert.doesNotMatch(learningQuery, /JOIN coursedekho\.topic_progress\b/);
  assert.doesNotMatch(learningQuery, /GROUP BY/);
});
