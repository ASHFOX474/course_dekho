import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";

import pg from "pg";

import { readVersionedSql, resolveDatabaseUrl } from "./migration-utils.mjs";

const { Client } = pg;
const repositoryRoot = new URL("../../", import.meta.url);
const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);
const seedsDirectory = new URL("../../database/seeds/", import.meta.url);

async function readCanonicalSeedSql() {
  const filenames = (await readdir(seedsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  if (filenames.length !== 1) throw new Error("Exactly one canonical SQL seed is required");
  return readFile(new URL(filenames[0], seedsDirectory), "utf8");
}

async function expectDatabaseRejection(client, savepoint, sql, messagePattern) {
  await client.query(`SAVEPOINT ${savepoint}`);
  let rejection;
  try {
    await client.query(sql);
  } catch (error) {
    rejection = error;
  }

  if (!rejection) {
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    throw new Error(`Expected database rejection at ${savepoint}`);
  }

  await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  if (rejection.code !== "23514" || !messagePattern.test(rejection.message)) {
    throw rejection;
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

export async function verifySchemaInRollbackTransaction() {
  const databaseUrl = await resolveDatabaseUrl(repositoryRoot);
  const migrations = await readVersionedSql(migrationsDirectory);
  const seedSql = await readCanonicalSeedSql();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const existing = await client.query("SELECT to_regnamespace('coursedekho') AS schema_name");
    if (existing.rows[0].schema_name) {
      throw new Error(
        "Verification requires a database without a coursedekho schema; use a disposable empty database"
      );
    }

    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '30s'");
      for (const migration of migrations) await client.query(migration.sql);

      await client.query(seedSql);
      await client.query(seedSql);

      const statusCounts = await client.query(`
        SELECT status::TEXT AS status, count(*)::INTEGER AS count
        FROM coursedekho.content_submission
        GROUP BY status
      `);
      const countsByStatus = new Map(statusCounts.rows.map((row) => [row.status, row.count]));
      assertEqual(countsByStatus.get("pending"), 1, "pending submission count");
      assertEqual(countsByStatus.get("approved"), 1, "approved submission count");
      assertEqual(countsByStatus.get("rejected"), 1, "rejected submission count");

      const state = await client.query(`
        SELECT
          (SELECT count(*)::INTEGER FROM coursedekho.topic_subtopic) AS subtopics,
          (SELECT count(*)::INTEGER FROM coursedekho.content WHERE is_active) AS published_content,
          (SELECT count(*)::INTEGER FROM coursedekho.content_revision) AS revisions,
          (SELECT count(*)::INTEGER FROM coursedekho.bookmark) AS bookmarks,
          (SELECT count(*)::INTEGER FROM coursedekho.solved_question) AS solved_questions,
          (
            SELECT count(*)::INTEGER
            FROM coursedekho.content AS content
            JOIN coursedekho.content_revision AS revision
              ON revision.id = content.current_revision_id
            JOIN coursedekho.content_submission AS submission
              ON submission.id = revision.submission_id
            WHERE content.is_active AND submission.status = 'approved'
          ) AS approved_visible_content
      `);
      assertEqual(state.rows[0].subtopics, 6, "subtopic count after repeated seed");
      assertEqual(state.rows[0].published_content, 1, "published content count");
      assertEqual(state.rows[0].revisions, 1, "revision count after repeated seed");
      assertEqual(state.rows[0].bookmarks, 3, "bookmark count after repeated seed");
      assertEqual(state.rows[0].solved_questions, 1, "solved question count after repeated seed");
      assertEqual(state.rows[0].approved_visible_content, 1, "approved visibility join count");

      await expectDatabaseRejection(
        client,
        "reject_direct_approval",
        `INSERT INTO coursedekho.content_submission (
           submitted_by_user_id, topic_id, resource_type, title, status
         )
         SELECT teacher.id, topic.id, 'question', 'Bypass review', 'approved'
         FROM coursedekho.app_user AS teacher
         CROSS JOIN coursedekho.topic AS topic
         WHERE teacher.role = 'teacher'
         LIMIT 1`,
        /must start pending/i
      );

      await expectDatabaseRejection(
        client,
        "reject_ambiguous_bookmark",
        `INSERT INTO coursedekho.bookmark (user_id, course_id, topic_id)
         SELECT learner.id, course.id, topic.id
         FROM coursedekho.app_user AS learner
         CROSS JOIN coursedekho.course AS course
         CROSS JOIN coursedekho.topic AS topic
         WHERE learner.role = 'student'
         LIMIT 1`,
        /bookmark.*check|num_nonnulls/i
      );

      await expectDatabaseRejection(
        client,
        "reject_hard_delete",
        "DELETE FROM coursedekho.app_user WHERE role = 'student'",
        /Hard deletes are disabled/i
      );
    } finally {
      await client.query("ROLLBACK");
    }
  } finally {
    await client.end();
  }

  console.log("verified migrations, repeated seed, visibility, lifecycle, bookmarks, and deletion guards");
}

const isEntrypoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntrypoint) {
  verifySchemaInRollbackTransaction().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
