# Read-only academic slice TDD evidence

## Scope

The slice covers the authenticated hierarchy:

1. active university;
2. ordered active semester;
3. active course;
4. database-ordered active topic;
5. active content whose current revision belongs to an approved submission.

The course list, course roadmap, topic resources, and resource detail pages were
migrated sequentially so canonical PostgreSQL UUID navigation remains coherent.

## RED and GREEN evidence

| Stage | Command | Result | Evidence |
|---|---|---|---|
| Contract/provider RED | `npm test` | EXPECTED FAIL | 8 failures proved academic paths, routes, handlers, client, and page cutovers were absent. |
| Contract GREEN | `node --test tests/characterization/api-contract.test.mjs` | PASS | All 11 contract assertions passed after adding UUID catalog reads. |
| Provider GREEN | `node --test tests/characterization/catalog-vertical-slice.test.mjs tests/characterization/backend-foundations.test.mjs` | PASS | Typed queries, visibility, hierarchy semantics, authorization, mapping, and validation passed. |
| Consumer GREEN | `node --test tests/characterization/catalog-client-and-routes.test.mjs tests/characterization/catalog-vertical-slice.test.mjs` | PASS | All dynamic route adapters and four page boundaries use the typed API client without direct academic mock imports. |
| Full suite | `npm test` | PASS | 81 tests pass with no skips. |
| Coverage | `npm run test:coverage` | PASS | Lines 97.53%, branches 85.01%, functions 98.17%; all exceed the configured 80% gates. |
| Static quality | `npm run lint` | PASS | ESLint completed without warnings or errors. |
| Types | `npx tsc --noEmit --incremental false` | PASS | Application and row/domain/DTO boundaries compile. |
| Production build | `npm run build` | PASS | Next.js compiled all eight catalog API routes and the migrated pages. |
| Dependency audit | `npm audit --omit=dev --offline` | PASS | Zero production dependency vulnerabilities found in local audit data. |
| Database status | `npm run db:status` | UNAVAILABLE | PostgreSQL at `127.0.0.1:5432` refused the connection; no migration or seed was applied. |

Checkpoint commits were intentionally not created because the repository's AGENTS
rules prohibit automatic commits.

## Visibility and authorization guarantees

- All SQL values are prepared parameters and no catalog query uses `SELECT *`.
- Course, topic, and single-resource reads share one approved-resource SQL fragment.
- That fragment requires `submission.status = 'approved'`, active content, and active
  topic/course/university/semester records.
- Pending/rejected resources behave as not found and are absent from all collections.
- Every handler resolves the HTTP-only session and calls the role assertion during
  handler execution before validating IDs or calling catalog services.
- All authenticated responses are `private, no-store` and vary on the cookie.
- Missing/inactive hierarchy nodes return `404`; valid empty collections return `[]`.

## Known gaps

- Live PostgreSQL query/integration verification remains pending until a disposable
  database is available.
- Bookmarks, progress, enrollment, history, and submission/review mutations remain
  prototype state and require separate transactional slices.
- File preview/download requires a signed-file delivery endpoint; storage keys and
  unrestricted external URLs are intentionally absent from the catalog response.
