# CSE216 checklist audit and minimum changes

Reviewed: 25 September 2026  
Checklist: `C:\Users\HP\Downloads\CSE216 Project Checklists.docx`  
Project: CourseDekho, including the current uncommitted working-tree changes.

## Verdict

**Not all checklist requirements are met yet. Four focused implementation changes should close the identified technical gaps:**

1. Validate sessions on the server for protected page requests.
2. Wrap the remaining database writes in explicit transactions.
3. Add and use one database function returning a computed value.
4. Add and use one stored procedure for an existing multi-table workflow.

You already have custom authentication, meaningful triggers, and more than three qualifying complex queries. You do not need a new product feature, authentication provider, analytics page, or schema redesign. You also need to prepare to explain the implementation during evaluation.

This is a source-code assessment, not certification of the deployed database or instructor acceptance. The checklist's research-network examples are illustrations, not requirements to add publications, citations, or research groups to CourseDekho.

## Checklist results

| Checklist requirement | Assessment | Evidence and smallest action |
|---|---|---|
| Authentication handled by your own code; sessions or JWT allowed | Meets in source | `lib/server/auth/password.ts` implements scrypt password handling; `auth/service.ts` implements registration/login; `auth/session.ts` creates opaque tokens and hashes them; PostgreSQL stores sessions. Standard crypto libraries and PostgreSQL hosting do not outsource authentication. No replacement needed. |
| Authentication validation on every page before processing requests | Partial | Protected API handlers validate database sessions, but `components/layout/AppShell.tsx` redirects through a client-side effect. `app/layout.tsx` only installs `AuthProvider`; no server page guard was found. Add request-time server protection for private pages and preserve API guards. |
| Explicit transaction control for every DML operation | Partial | `lib/server/db/transaction.ts` provides explicit BEGIN/COMMIT/ROLLBACK and several workflows use it. Other writes execute through the pool directly. Wrap the paths listed below, including single-statement writes. |
| One or more triggers | Meets in source | Migrations define role/profile validation, submission/revision integrity, progress-enrollment checks, and immutable-history guards. Examples: `database/migrations/0004_integrity_indexes.sql`, with later replacements in `0007`, `0008`, `0011`, and `0012`. No additional trigger needed. |
| One or more functions returning statistical/computed database values | Gap under the stated use case | Existing custom SQL functions return TRIGGER or VOID. These are real functions, but do not demonstrate the separate computed-value use case. Add one progress-calculation function and call it from the existing learning query. |
| At least one procedure for a multi-table modifying workflow | Missing in source | No CREATE PROCEDURE or application CALL was found in the reviewed migrations/backend/scripts. A TypeScript service method is not a database stored procedure. Move the existing user-deactivation workflow into one procedure. |
| Three or more complex queries, using multiple tables and/or aggregation | Meets in source | Course listing, topic/subtopic aggregation, approved resource retrieval, learning progress, and admin statistics already qualify. See examples below. No new page needed. |
| Appropriate use of database features | Supported by existing design; demonstrate it | Current integrity triggers and transactional workflows have business purposes. Use existing progress and deactivation behavior for the missing function/procedure rather than adding artificial features. |
| Understand and explain your own code | Cannot assess from repository | Prepare the explanation/demo list below. This requires your understanding, not another code change. |

## Minimum implementation list

### 1. Add server authentication for protected pages

- [ ] Add a reusable server session guard that validates the cookie against the existing authentication service, including expiry, revocation, and account status. Merely checking that a cookie exists is insufficient.
- [ ] Invoke it at the server entry to each protected page, before rendering its client component. Thin server page wrappers around the current client screens are a focused option; retain URLs and UI behavior.
- [ ] Enforce role restrictions for admin/contributor pages on the server as well as in existing API handlers. Keep API guards: page protection cannot secure a directly called API.
- [ ] Define the intended public exceptions: login/registration, password recovery/reset, signup university lookup, and token-authorized recovery conversations. Recovery threads must still verify their private token before returning data. Confirm the instructor's interpretation of “every page”; login necessarily needs an unauthenticated entry point.

Affected areas: `app/**/page.tsx`, a new helper under `lib/server/auth/`, existing `auth/runtime.ts` and `auth/service.ts`. A shared layout alone should not be the sole per-request authorization boundary.

Database impact: none. Security impact: adds server enforcement ahead of page rendering while retaining existing session and permission rules.

Acceptance: direct private-page and API requests with missing, forged, expired, or revoked sessions are rejected/redirected; learners cannot access admin pages; intended public recovery/login flows still work.

### 2. Complete explicit transaction coverage

Reuse `withTransaction(pool, async client => ...)` and construct the repository with **that client**. Keep the entire operation, success checks, and dependent reads within the transaction where appropriate. Do not issue BEGIN through a pool and then allow later queries to use another connection.

Confirmed application paths currently outside explicit transaction wrappers:

| File | Operations to wrap |
|---|---|
| `lib/server/auth/service.ts` | `logout`, `approveUser`, `rejectUser` |
| `lib/server/workspace/service.ts` | `createBookmark`, `deleteBookmark`, `createEnrollment`, `updateProgress`, `recordAccess`, `markSolved`, `createSubmission`, `removeResource` |
| `lib/server/catalog/admin-http-handlers.ts` | Existing POST course-creation INSERT; update its dependency/runtime wiring to support a transaction client. |

Registration, login/session rotation, user deactivation, submission review, resource editing/link publication, account updates, support writes, and academic-management mutations already have explicit wrappers. Preserve these; do not add nested BEGIN calls.

PostgreSQL single statements are already atomic, including data-modifying CTEs, but implicit autocommit does not demonstrate the checklist's explicit COMMIT/ROLLBACK requirement. Read-only SELECT operations do not need new write transactions. Trigger writes participate in their calling transaction.

- [ ] Wrap the listed paths.
- [ ] Re-audit executable DML, including maintenance/import/seed scripts, for the same rule. The normal migration/seed/import runners already show explicit transaction control; generated maintenance SQL should also be executed inside an explicit transaction.
- [ ] Test commit on success and rollback on SQL errors **and** application validation failures after a write. Verify rollback leaves no partial changes and releases the connection.

Database impact: no table change. Security impact: preserve role checks and ownership filters. Architecture: existing service/repository layering remains intact.

### 3. Add one computed SQL function

Suggested function: `coursedekho.calculate_course_progress(user_id, course_id)` returning an integer percentage.

The existing `queryLearningCourses` in `lib/server/db/queries/workspace-queries.ts` already computes this value with SUM, COUNT, rounding, and COALESCE. Extract that calculation into the function and call it from the existing query. Use consistent internal-ID parameter types; do not expose them through the API.

- [ ] Preserve the current semantics: average progress across active topics, absent progress counts as zero, and no active topics returns zero.
- [ ] Preserve the caller's user/course visibility and enrollment filtering. The authenticated actor must determine whose progress is requested.
- [ ] Use the function in the application; creating an unused routine is weak demonstration evidence.
- [ ] Verify no-topic, unstarted, partially completed, fully completed, archived-topic, and different-user cases against the existing formula.

Database impact: reads existing `topic` and `topic_progress` data; no new table or backfill. Add the routine in a new forward-only migration (currently the next available number is `0013`; recheck before implementation). Do not edit applied migrations. No new UI is necessary.

### 4. Add one small, useful stored procedure

Suggested procedure: `coursedekho.deactivate_user_and_revoke_sessions(...)`.

`AuthService.deactivateUser` already updates `app_user` and revokes `auth_session` rows in a transaction. This is a smaller procedure candidate than moving the much larger submission-approval workflow.

- [ ] Move the two existing write steps into a real CREATE PROCEDURE routine and call it from the existing service/repository path.
- [ ] Keep the existing admin guard and self-deactivation prohibition; validate the active admin and target inside the routine as defense in depth. Obtain the actor from the server session, never from trusted-looking client input.
- [ ] Preserve deactivation timestamps, session-revocation invariants, already-inactive error behavior, and soft deletion.
- [ ] Execute CALL using the client inside the existing `withTransaction` wrapper. Let the application commit or roll back the whole operation; the procedure should not independently commit halfway through it.
- [ ] Verify authorized success, non-admin denial, self-deactivation denial, already-inactive behavior, and rollback of the user update if the session-revocation step fails.

Affected areas: a new migration, `lib/server/auth/service.ts`, `lib/server/repositories/auth-repository.ts`, and `lib/server/db/queries/auth-queries.ts`.

Database impact: adds a routine operating on two existing tables; no new data model or destructive migration. Keep ordinary invoker permissions unless a separately justified privilege model is required. The function and procedure can share one new migration. Keep application contracts/UI unchanged.

## Complex queries you can already demonstrate

| Example | Source | Why it qualifies | Existing demonstration |
|---|---|---|---|
| Course catalog | `lib/server/db/queries/catalog-queries.ts`: `courseSelectSql` / `listCoursesSql` | Joins course, university, and semester, with search/filter predicates | Courses browser |
| Ordered topics and subtopics | Same file: `topicSelectSql` / `listTopicsSql` | Multiple joins, JSONB_AGG, FILTER, GROUP BY, ordered aggregation | Course topic roadmap |
| Approved resources | Same file: `approvedResourceSelectSql` | Joins content, current revision, approved submission, contributor, hierarchy, and subtype details | Course/topic resource views |
| Learning progress | `lib/server/db/queries/workspace-queries.ts`: `queryLearningCourses` | Multiple joins plus SUM, COUNT, rounding, and grouping | Progress/learning views |
| Admin statistics | Same file: `queryAdminStats` | Aggregate subqueries and joins | Admin dashboard |

Pick any three and explain the joins, filters, aggregate behavior, and purpose. The checklist does not require a new analytics page.

## Evaluation preparation and final verification

- [ ] Explain request flow: page/client → API authentication and validation → service authorization → repository/SQL → PostgreSQL.
- [ ] Explain the role names: current code uses `learner` / `contributor` / `admin`, corresponding to student / teacher / admin. Older migrations use the original names; migration `0007` changes them.
- [ ] Explain password hashing versus session-token hashing, cookies, expiry, logout, and server authorization.
- [ ] Demonstrate a valid trigger-protected operation and an invalid operation rejected by a trigger, inside a rollback-only demo transaction.
- [ ] Demonstrate the computed function through the real progress screen and the procedure through admin deactivation, using disposable demo accounts.
- [ ] Show BEGIN/COMMIT on success and ROLLBACK after an induced failure, without damaging existing data.
- [ ] Explain why teacher submissions remain unpublished until admin approval, and why content revisions/history are protected.
- [ ] Run `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build`, and `npm test` after implementation. Add focused tests for the four changes.
- [ ] Verify applied migrations and routine/trigger existence in the actual demo database. Use an isolated test database for destructive/failure experiments; do not reseed or recreate an existing database for this audit.
- [ ] Exercise learner browsing/bookmarks/progress, contributor submission and review status, and admin approval/content management after the changes.

## Audit scope and limitations

The attached checklist was read as assessment criteria, not instructions to execute its examples. Findings use current implementation and canonical migrations, rather than older project-state documents that still describe missing backend features now present in source.

`npm test` was attempted during the audit, but the Node test runner could not spawn test processes (`spawn EPERM`). This is an execution-environment limitation; it does not establish passing or failing application behavior. No live database inspection, browser demonstration, or deployment verification was performed. Lint/typecheck/build were not run for this documentation-only addition.

Only this report was added. Application code, existing working-tree changes, database contents, dependencies, and Git history were left untouched. Completing the four changes and demonstrating them should address the identified checklist gaps; final acceptance and your code-understanding assessment belong to the evaluator.
