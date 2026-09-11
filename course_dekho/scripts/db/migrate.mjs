import { pathToFileURL } from "node:url";

import pg from "pg";

import { readVersionedSql, resolveDatabaseUrl } from "./migration-utils.mjs";

const { Client } = pg;
const repositoryRoot = new URL("../../", import.meta.url);
const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);
const migrationTable = "public.course_dekho_schema_migration";
const databaseChangeLockName = "coursedekho:database-change";

function assertAppliedMigrationMatches(migration, applied) {
  if (applied.filename !== migration.filename || applied.checksum_sha256 !== migration.checksum) {
    throw new Error(
      `Applied migration ${migration.version} differs from ${migration.filename}; ` +
        "restore the immutable file and add a new migration"
    );
  }
}

function assertDatabaseIsNotAhead(migrations, appliedByVersion) {
  const localVersions = new Set(migrations.map((migration) => migration.version));
  for (const version of appliedByVersion.keys()) {
    if (!localVersions.has(version)) {
      throw new Error(`Database has migration ${version}, which is missing from this checkout`);
    }
  }
}

async function readAppliedMigrations(client) {
  const tableExists = await client.query("SELECT to_regclass($1) AS table_name", [migrationTable]);
  if (!tableExists.rows[0].table_name) return new Map();

  const result = await client.query(
    `SELECT version, filename, checksum_sha256, applied_at
     FROM ${migrationTable}
     ORDER BY version`
  );
  return new Map(result.rows.map((row) => [row.version, row]));
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${migrationTable} (
      version TEXT PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

export async function runMigrations({ statusOnly = false } = {}) {
  const migrations = await readVersionedSql(migrationsDirectory);
  const databaseUrl = await resolveDatabaseUrl(repositoryRoot);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    if (statusOnly) {
      const appliedByVersion = await readAppliedMigrations(client);
      assertDatabaseIsNotAhead(migrations, appliedByVersion);
      for (const migration of migrations) {
        const applied = appliedByVersion.get(migration.version);
        if (applied) assertAppliedMigrationMatches(migration, applied);
        console.log(`${applied ? "applied" : "pending"}  ${migration.filename}`);
      }
      return;
    }

    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
      databaseChangeLockName,
    ]);
    try {
      await ensureMigrationTable(client);
      const appliedByVersion = await readAppliedMigrations(client);
      assertDatabaseIsNotAhead(migrations, appliedByVersion);

      for (const migration of migrations) {
        const applied = appliedByVersion.get(migration.version);
        if (applied) {
          assertAppliedMigrationMatches(migration, applied);
          console.log(`already applied  ${migration.filename}`);
          continue;
        }

        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query(
            `INSERT INTO ${migrationTable} (version, filename, checksum_sha256)
             VALUES ($1, $2, $3)`,
            [migration.version, migration.filename, migration.checksum]
          );
          await client.query("COMMIT");
          console.log(`applied          ${migration.filename}`);
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
        databaseChangeLockName,
      ]);
    }
  } finally {
    await client.end();
  }
}

const isEntrypoint = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isEntrypoint) {
  runMigrations({ statusOnly: process.argv.includes("--status") }).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
