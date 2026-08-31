import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  checksumSql,
  extractVersion,
  parseEnvValue,
  seedIsAllowed,
} from "../../scripts/db/migration-utils.mjs";

const repositoryRoot = new URL("../../", import.meta.url);

test("migration filenames expose a stable ordered version", () => {
  assert.equal(extractVersion("0001_identity_academics.sql"), "0001");
  assert.equal(extractVersion("0042_add_search.sql"), "0042");
  assert.throws(() => extractVersion("identity.sql"), /Invalid migration filename/);
  assert.throws(() => extractVersion("0001_identity.down.sql"), /Invalid migration filename/);
});

test("migration checksums are stable and content-sensitive", () => {
  assert.equal(checksumSql("SELECT 1;\n"), checksumSql("SELECT 1;\n"));
  assert.notEqual(checksumSql("SELECT 1;\n"), checksumSql("SELECT 2;\n"));
  assert.match(checksumSql("SELECT 1;\n"), /^[a-f0-9]{64}$/);
});

test("DATABASE_URL can be read from an env file without exposing unrelated values", () => {
  const envText = [
    "# local settings",
    "OTHER_SECRET=do-not-return",
    "DATABASE_URL='postgresql://localhost/course_dekho'",
  ].join("\n");

  assert.equal(parseEnvValue(envText, "DATABASE_URL"), "postgresql://localhost/course_dekho");
  assert.equal(parseEnvValue(envText, "MISSING"), undefined);
});

test("the canonical demo seed is blocked in production unless explicitly overridden", () => {
  assert.equal(seedIsAllowed("development", undefined), true);
  assert.equal(seedIsAllowed("test", undefined), true);
  assert.equal(seedIsAllowed("production", undefined), false);
  assert.equal(seedIsAllowed("production", "true"), true);
  assert.equal(seedIsAllowed("production", "TRUE"), true);
  assert.equal(seedIsAllowed("production", "false"), false);
});

test("migration and seed runners serialize changes and recover failed transactions", async () => {
  const migrate = await readFile(new URL("scripts/db/migrate.mjs", repositoryRoot), "utf8");
  const seed = await readFile(new URL("scripts/db/seed.mjs", repositoryRoot), "utf8");

  assert.match(migrate, /course_dekho_schema_migration/);
  assert.match(migrate, /checksum_sha256/);
  assert.match(migrate, /pg_advisory_lock\(hashtextextended/);
  assert.match(migrate, /client\.query\("BEGIN"\)/);
  assert.match(migrate, /client\.query\("ROLLBACK"\)/);
  assert.match(migrate, /Database has migration .*missing from this checkout/);

  assert.match(seed, /coursedekho:database-change/);
  assert.match(seed, /assertMigrationsAreCurrent/);
  assert.match(seed, /ALLOW_DEMO_SEED/);
  assert.match(seed, /client\.query\("ROLLBACK"\)/);
});

test("database verification is rollback-only and refuses an existing target schema", async () => {
  const verify = await readFile(new URL("scripts/db/verify.mjs", repositoryRoot), "utf8");

  assert.match(verify, /to_regnamespace\('coursedekho'\)/);
  assert.match(verify, /requires a database without a coursedekho schema/);
  assert.match(verify, /finally \{[\s\S]*?client\.query\("ROLLBACK"\)/);
});
