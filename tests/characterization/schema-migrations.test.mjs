import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const repositoryRoot = new URL("../../", import.meta.url);
const migrationsDirectory = new URL("database/migrations/", repositoryRoot);
const seedsDirectory = new URL("database/seeds/", repositoryRoot);

async function readSqlDirectory(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const files = await Promise.all(
    names.map(async (name) => ({ name, sql: await readFile(new URL(name, directory), "utf8") }))
  );
  return files;
}

async function migrationSql() {
  return (await readSqlDirectory(migrationsDirectory)).map((file) => file.sql).join("\n");
}

test("the canonical migration chain is ordered, forward-only, and non-destructive", async () => {
  const migrations = await readSqlDirectory(migrationsDirectory);
  assert.deepEqual(
    migrations.map((migration) => migration.name),
    [
      "0001_identity_academics.sql",
      "0002_content_workflow.sql",
      "0003_learning_activity.sql",
      "0004_integrity_indexes.sql",
      "0005_auth_sessions.sql",
      "0006_restore_semester_scope.sql",
    ]
  );

  for (const [index, migration] of migrations.entries()) {
    assert.match(migration.sql, new RegExp(`^-- course-dekho:migration 000${index + 1}`, "m"));
    assert.doesNotMatch(migration.sql, /\bDROP\s+(TABLE|SCHEMA|COLUMN|TYPE)\b/i);
    assert.doesNotMatch(migration.sql, /\bTRUNCATE\b/i);
    assert.doesNotMatch(migration.sql, /^\s*(BEGIN|COMMIT)\s*;/im);
    assert.match(migration.sql, /forward-only/i);
  }

  const legacyEntryPoint = await readFile(new URL("CourseDekho_schema.sql", repositoryRoot), "utf8");
  assert.doesNotMatch(legacyEntryPoint, /\bDROP\s+TABLE\b/i);
  assert.match(legacyEntryPoint, /database\/migrations/);
});

test("public identities use UUIDs while relational joins use bigint identity keys", async () => {
  const sql = await migrationSql();

  for (const table of [
    "app_user",
    "university",
    "semester",
    "course",
    "topic",
    "topic_subtopic",
    "content_submission",
    "content",
    "content_revision",
    "enrollment",
    "topic_progress",
    "bookmark",
    "content_access",
    "solved_question",
  ]) {
    const tablePattern = new RegExp(
      `CREATE TABLE coursedekho\\.${table} \\([\\s\\S]*?id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY[\\s\\S]*?public_id UUID NOT NULL DEFAULT gen_random_uuid\\(\\) UNIQUE`,
      "i"
    );
    assert.match(sql, tablePattern, `${table} must have internal bigint and public UUID identities`);
  }

  assert.match(sql, /slug TEXT NOT NULL CHECK \(slug ~ '\^\[a-z0-9\]/);
  assert.match(sql, /UNIQUE \(university_id, slug\)/i);
  assert.match(sql, /UNIQUE \(course_id, slug\)/i);
});

test("semester ownership and ordered roadmap relationships are database-enforced", async () => {
  const sql = await migrationSql();

  assert.match(sql, /CREATE TABLE coursedekho\.semester[\s\S]*?university_id BIGINT NOT NULL/i);
  assert.match(sql, /UNIQUE \(university_id, sequence_order\)/i);
  assert.match(
    sql,
    /FOREIGN KEY \(semester_id, university_id\)\s+REFERENCES coursedekho\.semester \(id, university_id\)/i
  );
  assert.match(sql, /CREATE TABLE coursedekho\.topic_subtopic/i);
  assert.match(
    sql,
    /CREATE TABLE coursedekho\.topic_subtopic \([\s\S]*?public_id UUID NOT NULL DEFAULT gen_random_uuid\(\) UNIQUE[\s\S]*?slug TEXT NOT NULL/i
  );
  assert.match(sql, /UNIQUE \(topic_id, slug\)/i);
  assert.match(sql, /UNIQUE \(course_id, sequence_order\)/i);
  assert.match(sql, /UNIQUE \(topic_id, sequence_order\)/i);
});

test("teacher learning and polymorphic bookmarks retain relational integrity", async () => {
  const sql = await migrationSql();

  assert.match(sql, /CREATE TABLE coursedekho\.enrollment[\s\S]*?user_id BIGINT NOT NULL/i);
  assert.match(sql, /CREATE TABLE coursedekho\.topic_progress[\s\S]*?user_id BIGINT NOT NULL/i);
  assert.match(sql, /CREATE TRIGGER trg_enrollment_learner_role/i);
  assert.match(sql, /CREATE TRIGGER trg_topic_progress_enrollment/i);

  assert.match(
    sql,
    /CHECK \(num_nonnulls\(course_id, topic_id, content_id\) = 1\)/i
  );
  assert.match(sql, /CREATE UNIQUE INDEX uq_bookmark_user_course[\s\S]*?WHERE course_id IS NOT NULL/i);
  assert.match(sql, /CREATE UNIQUE INDEX uq_bookmark_user_topic[\s\S]*?WHERE topic_id IS NOT NULL/i);
  assert.match(sql, /CREATE UNIQUE INDEX uq_bookmark_user_content[\s\S]*?WHERE content_id IS NOT NULL/i);
});

test("content publication is revisioned and review lifecycle constraints are explicit", async () => {
  const sql = await migrationSql();

  assert.match(sql, /CREATE TABLE coursedekho\.content_submission/i);
  assert.match(sql, /target_content_id BIGINT/i);
  assert.match(sql, /CREATE TABLE coursedekho\.content_revision/i);
  assert.match(sql, /UNIQUE \(content_id, version_number\)/i);
  assert.match(sql, /UNIQUE \(submission_id\)/i);
  assert.match(sql, /current_revision_id BIGINT/i);
  assert.match(sql, /FOREIGN KEY \(current_revision_id, id\)[\s\S]*?REFERENCES coursedekho\.content_revision \(id, content_id\)/i);
  assert.match(sql, /status = 'pending'[\s\S]*?status = 'approved'[\s\S]*?status = 'rejected'/i);
  assert.match(
    sql,
    /rejection_reason IS NOT NULL[\s\S]*?AND btrim\(rejection_reason\) <> ''/i
  );
  assert.match(sql, /CREATE TRIGGER trg_content_submission_transition/i);
  assert.match(
    sql,
    /TG_OP = 'INSERT'[\s\S]*?NEW\.status <> 'pending'[\s\S]*?New submissions must start pending/i
  );
  assert.match(sql, /CREATE TRIGGER trg_content_revision_immutable/i);
});

test("solved questions, resource metadata, timestamptz, and audit-safe deletion are present", async () => {
  const sql = await migrationSql();

  assert.match(sql, /CREATE TABLE coursedekho\.solved_question/i);
  assert.match(sql, /CREATE TRIGGER trg_solved_question_content_type/i);
  assert.match(sql, /storage_key TEXT/i);
  assert.match(sql, /mime_type TEXT/i);
  assert.match(sql, /file_size_bytes BIGINT/i);
  assert.match(sql, /checksum_sha256 TEXT/i);
  assert.match(sql, /metadata JSONB NOT NULL DEFAULT '\{\}'::jsonb/i);
  assert.match(sql, /view_count BIGINT NOT NULL DEFAULT 0/i);
  assert.match(sql, /download_count BIGINT NOT NULL DEFAULT 0/i);
  assert.doesNotMatch(sql, /\bTIMESTAMP\s+(?!WITH TIME ZONE)/i);
  assert.ok((sql.match(/TIMESTAMPTZ/gi) ?? []).length >= 20);
  assert.match(sql, /CREATE TRIGGER trg_app_user_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_topic_subtopic_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_content_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_enrollment_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_topic_progress_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_solved_question_prevent_delete/i);
  assert.match(sql, /CREATE TRIGGER trg_content_access_immutable/i);
  assert.match(sql, /CREATE TRIGGER trg_audit_event_immutable/i);
  assert.match(sql, /ON DELETE RESTRICT/i);
});

test("query paths and every important foreign-key direction have supporting indexes", async () => {
  const sql = await migrationSql();

  for (const indexName of [
    "idx_course_university_semester",
    "idx_topic_course_active_order",
    "idx_submission_pending_queue",
    "idx_submission_teacher_recent",
    "idx_content_topic_published",
    "idx_enrollment_user_status",
    "idx_topic_progress_user_recent",
    "idx_content_access_user_recent",
    "idx_solved_question_user_recent",
    "idx_audit_event_entity_recent",
  ]) {
    assert.match(sql, new RegExp(`CREATE (?:UNIQUE )?INDEX ${indexName}\\b`, "i"), `missing ${indexName}`);
  }
});

test("there is exactly one idempotent, development-only canonical seed", async () => {
  const seeds = await readSqlDirectory(seedsDirectory);
  assert.deepEqual(seeds.map((seed) => seed.name), ["0001_demo.sql"]);

  const seed = seeds[0].sql;
  assert.match(seed, /^-- course-dekho:seed 0001/m);
  assert.doesNotMatch(seed, /\bDROP\s+TABLE\b|\bTRUNCATE\b/i);
  assert.match(seed, /ON CONFLICT/i);
  assert.match(seed, /'student'::coursedekho\.user_role/i);
  assert.match(seed, /'teacher'::coursedekho\.user_role/i);
  assert.match(seed, /'admin'::coursedekho\.user_role/i);
  assert.match(seed, /'pending'::coursedekho\.submission_status/i);
  assert.match(seed, /'approved'::coursedekho\.submission_status/i);
  assert.match(seed, /'rejected'::coursedekho\.submission_status/i);
  assert.match(seed, /INSERT INTO coursedekho\.topic_subtopic/i);
  assert.match(seed, /INSERT INTO coursedekho\.solved_question/i);
  assert.match(seed, /INSERT INTO coursedekho\.content_revision/i);
  assert.match(seed, /scrypt\$[0-9]+\$[0-9]+\$[0-9]+\$/i);
  assert.doesNotMatch(seed, /\bcrypt\s*\(/i);
  assert.match(
    seed,
    /UPDATE coursedekho\.content_submission[\s\S]*?status = 'approved'::coursedekho\.submission_status/i
  );
  assert.match(
    seed,
    /UPDATE coursedekho\.content_submission[\s\S]*?status = 'rejected'::coursedekho\.submission_status/i
  );
});

test("session storage keeps only revocable token digests with bounded lifetimes", async () => {
  const sql = await migrationSql();

  assert.match(sql, /CREATE TABLE coursedekho\.auth_session/i);
  assert.match(sql, /token_hash TEXT NOT NULL UNIQUE/i);
  assert.match(sql, /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.doesNotMatch(sql, /\btoken\s+TEXT\b/i);
  assert.match(sql, /expires_at TIMESTAMPTZ NOT NULL/i);
  assert.match(sql, /revoked_at TIMESTAMPTZ/i);
  assert.match(sql, /expires_at > created_at/i);
  assert.match(sql, /expires_at <= created_at \+ INTERVAL '30 days'/i);
  assert.match(sql, /CREATE INDEX idx_auth_session_user_active/i);
  assert.match(sql, /CREATE INDEX idx_auth_session_expiry_active/i);
  assert.match(sql, /ON DELETE RESTRICT/i);
});
