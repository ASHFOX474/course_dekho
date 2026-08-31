# Schema reconciliation test evidence

Date: 2026-08-31

## RED

The first `npm test` run retained all 16 existing contract/behavior tests and failed the 9 newly added database tests because `database/migrations`, `database/seeds`, and `scripts/db/migration-utils.mjs` did not exist.

Two focused refinement cycles then failed for the intended reasons:

- subtopics lacked public UUID/slug identity, and reviewed seed rows bypassed `pending`;
- audit-safe hard-delete/immutability triggers were missing for subtopics and learner history.

No production database or mock UI was changed to make these tests pass.

## GREEN

Final `npm test` after implementation and runner-safety assertions:

```text
tests 30
pass 30
fail 0
```

Covered behavior includes migration ordering/checksums, forward-only SQL, UUID/slug strategy, semester ownership/order, teacher learning state, bookmark integrity, submission lifecycle, content revisions, resource metadata, solved-question typing, `TIMESTAMPTZ`, deletion guards, query indexes, one idempotent seed, and the previously frozen role/content contracts.

## PostgreSQL engine verification

`npm run db:verify` is rollback-only and verifies the complete SQL chain, two seed passes, approved-only publication, direct-approval rejection, bookmark shape, and hard-delete guards against an empty PostgreSQL database.

The implementation attempt on 2026-08-31 could not run because the configured local server refused the connection at `127.0.0.1:5432`. Therefore the SQL has static/characterization coverage but still requires one successful `npm run db:verify` against a running disposable PostgreSQL instance before migration approval.
