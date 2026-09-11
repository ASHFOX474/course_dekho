// One-off use: prints SQL to backfill the migration ledger so it matches
// reality (schema already applied, ledger table empty/missing for this
// database). Uses THIS project's own readVersionedSql/checksumSql, so the
// checksums are guaranteed to match what migrate.mjs will check for --
// no risk of a hand-computed hash being wrong due to line-ending handling.
//
// Usage:  node scripts/db/print-ledger-backfill.mjs
// Then paste the printed SQL into Neon's SQL Editor and run it once.
// Safe to re-run (ON CONFLICT DO NOTHING) -- does NOT touch your schema,
// only records that these files already ran.

import { readVersionedSql } from "./migration-utils.mjs";

const migrationsDirectory = new URL("../../database/migrations/", import.meta.url);

const migrations = await readVersionedSql(migrationsDirectory);

const values = migrations
  .map((m) => `    ('${m.version}', '${m.filename}', '${m.checksum}')`)
  .join(",\n");

console.log(
  `INSERT INTO public.course_dekho_schema_migration (version, filename, checksum_sha256)\nVALUES\n${values}\nON CONFLICT (version) DO NOTHING;`
);
