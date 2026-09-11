# Database/frontend sync TDD evidence

## Scope

This slice removes the frontend mock provider and temporary backend demo surface,
then connects profile, learning, enrollment, progress, bookmarks, access history,
solved questions, teacher submissions, and admin review to protected PostgreSQL
APIs. Existing migrations were sufficient; no schema or seed was changed.

## Red/green record

| Phase | Command | Result |
|---|---|---|
| RED | `node --test tests/characterization/database-frontend-sync.test.mjs` | Expected 8 failures: mock consumers and demo files remained; workspace routes, validation, role enforcement, approved-only SQL, transaction use, and API-backed pages were absent. |
| GREEN | `node --test tests/characterization/database-frontend-sync.test.mjs` | 8 passed, 0 failed. |
| Full suite | `npm test` | 91 passed, 0 failed. |
| Coverage | `npm run test:coverage` | PASS — 95.06% lines, 81.93% branches, 89.85% functions. |
| Live reads | student/teacher/admin API smoke checks | PASS — profile, learning, bookmarks, history, solved questions, catalog, own submissions, admin review queue, and stats returned `200`; cross-role checks returned `403`. |
| Live writes | rollback-only PostgreSQL transaction | PASS — enrollment, bookmark, progress, solved-question, and approval queries executed; the submission was `approved` inside the transaction and `pending` after rollback. |

The characterization suite also freezes the v1 teacher/admin submission path
split: create at `/api/v1/submissions`, teacher reads at
`/api/v1/submissions/mine`, and admin reads at `/api/v1/admin/submissions`.

## Safety properties covered

- No frontend source imports `lib/data`, `lib/queries`, or `DataContext`.
- Every workspace route resolves the cookie session and checks its role in the
  handler; services repeat the business-role assertion.
- Learner-facing resource queries require an approved submission, active content,
  and an active academic hierarchy.
- Client-owned user/reviewer/status/timestamp fields are rejected.
- Approval locks and transitions the submission, creates the revision, publishes
  content, and records the audit event through one transaction.
- Queries use bound values; the only dynamic SQL identifier is selected from the
  closed bookmark-target allowlist.
- The temporary `/backend-demo` page and `db:demo` command are absent.

The first rollback-only write run exposed PostgreSQL error `42P08` because the
progress parameter was inferred as both `integer` and `smallint`. Explicit
`$3::smallint` casts fixed the query; the rerun passed without persisting changes.
