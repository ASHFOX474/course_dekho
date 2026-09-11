import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";

import pg from "pg";

import {
  checksumSql,
  readVersionedSql,
  resolveDatabaseUrl,
  seedIsAllowed,
} from "./migration-utils.mjs";

const { Client } = pg;
const repositoryRoot = new URL("../../", import.meta.url);
const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);
const seedsDirectory = new URL("../../database/seeds/", import.meta.url);
const migrationTable = "public.course_dekho_schema_migration";
const seedTable = "public.course_dekho_seed";
const databaseChangeLockName = "coursedekho:database-change";

async function readCanonicalSeed() {
  const filenames = (await readdir(seedsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
  if (filenames.length !== 1) {
    throw new Error("Exactly one canonical SQL seed is required");
  }

  const filename = filenames[0];
  const sql = await readFile(new URL(filename, seedsDirectory), "utf8");
  return { filename, sql, checksum: checksumSql(sql) };
}

async function assertMigrationsAreCurrent(client) {
  const migrations = await readVersionedSql(migrationsDirectory);
  const tableExists = await client.query("SELECT to_regclass($1) AS table_name", [migrationTable]);
  if (!tableExists.rows[0].table_name) {
    throw new Error("Schema migrations must be applied before seeding");
  }

  const result = await client.query(
    `SELECT version, filename, checksum_sha256 FROM ${migrationTable}`
  );
  if (result.rows.length !== migrations.length) {
    throw new Error("The database migration set differs from this checkout");
  }
  const appliedByVersion = new Map(result.rows.map((row) => [row.version, row]));

  for (const migration of migrations) {
    const applied = appliedByVersion.get(migration.version);
    if (
      !applied ||
      applied.filename !== migration.filename ||
      applied.checksum_sha256 !== migration.checksum
    ) {
      throw new Error(`Migration ${migration.filename} is pending or has changed`);
    }
  }
}

export async function runCanonicalSeed() {
  if (!seedIsAllowed(process.env.NODE_ENV, process.env.ALLOW_DEMO_SEED)) {
    throw new Error("Demo seeding is blocked in production; set ALLOW_DEMO_SEED=true to override");
  }

  const seed = await readCanonicalSeed();
  const databaseUrl = await resolveDatabaseUrl(repositoryRoot);
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [
      databaseChangeLockName,
    ]);
    try {
      await assertMigrationsAreCurrent(client);
      await client.query("BEGIN");
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${seedTable} (
            filename TEXT PRIMARY KEY,
            checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `);
        await client.query(seed.sql);
        await client.query(
          `INSERT INTO ${seedTable} (filename, checksum_sha256)
           VALUES ($1, $2)
           ON CONFLICT (filename) DO UPDATE
           SET checksum_sha256 = EXCLUDED.checksum_sha256,
               applied_at = now()`,
          [seed.filename, seed.checksum]
        );
        await client.query("COMMIT");
        console.log(`seeded  ${seed.filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
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
  runCanonicalSeed().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
