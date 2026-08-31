# CourseDekho PostgreSQL baseline

This directory is the canonical database definition for the PostgreSQL-backed API. The content UI remains mock-backed, while authentication now uses PostgreSQL. The five SQL migrations create a new `coursedekho` schema without altering legacy objects in `public`.

## Identity and routing decisions

- PostgreSQL joins use `BIGINT GENERATED ALWAYS AS IDENTITY` keys. These keys never cross the API boundary.
- Every independently addressable record has an immutable UUID `public_id`. HTTP request and response IDs use this UUID.
- Slugs are human-readable lookup keys for the academic hierarchy: university globally, semester within university, course within university, topic within course, and subtopic within topic.
- UUID is the canonical identity. A slug is an admin-managed label and must not be used as a foreign key. Changing a public slug requires a redirect/alias feature before API routes may promise durable slug URLs.
- One-to-one profiles and the `course_teacher` association use their owner/composite keys because they are not independent public resources.

## Reconciled model

| Concern | Database decision |
|---|---|
| Semester ownership/order | `semester.university_id` owns the semester; `(university_id, sequence_order)` is unique. A composite course foreign key prevents a course from pairing a semester with the wrong university. |
| Teacher progress | Enrollment and progress point to `app_user`, not a student-only table. Triggers permit `student` and `teacher`, never `admin`. |
| Bookmarks | One table has nullable real foreign keys to course, topic, and content. `num_nonnulls(...) = 1` and three partial unique indexes enforce exactly one target per user. |
| Subtopics | `topic_subtopic` is an ordered, UUID-addressable, parent-scoped slug entity with archive state. |
| Solved questions | `solved_question` references active published content; a trigger requires `resource_type = 'question'`. |
| Resource metadata | Submissions and revisions carry storage key, original filename, MIME type, byte size, checksum, external URL, topic labels, publication year, and extensible object-shaped JSON metadata. |
| Content revisions | `content` is stable identity and publication state. Each immutable `content_revision` exactly snapshots one approved submission. `current_revision_id` must belong to the same content row. |
| Lifecycle | New submissions must start pending. Only admins can review. Rejection requires a reason. Reviewed submissions, revisions, audit events, and access events cannot be rewritten. |
| Deletion | Users, profiles, official academic structure, submissions, content, enrollment, progress, and solved history reject hard deletion. Use deactivate/archive/drop lifecycle fields. Bookmarks remain removable by design. |
| Time | All event/audit timestamps use `TIMESTAMPTZ`; calendar-only semester dates use `DATE`. |
| Sessions | `auth_session` stores only a unique SHA-256 token digest, a maximum 30-day lifetime, last-seen time, and monotonic revocation. Active-user/profile checks remain defense in depth. |

The database constraints are defense in depth. Future route handlers must still authenticate every request, derive the actor from the server session, authorize by role, validate input, and use transactions.

## Migration files

Migrations are immutable, forward-only, and applied in filename order:

1. `0001_identity_academics.sql` — users, profiles, academic hierarchy, roles, UUID/slug strategy.
2. `0002_content_workflow.sql` — submissions, stable content, metadata, immutable revisions.
3. `0003_learning_activity.sql` — enrollment, progress, bookmarks, access, solved questions, audit events.
4. `0004_integrity_indexes.sql` — cross-table triggers, deletion guards, and query/FK indexes.
5. `0005_auth_sessions.sql` — bounded opaque sessions, revocation invariants, and active/expiry indexes.

The runner records filename and SHA-256 in `public.course_dekho_schema_migration`, serializes runners with a PostgreSQL advisory lock, and wraps each unapplied file in its own transaction. A checksum mismatch stops immediately. Never edit an applied migration; add the next numbered compensating migration.

## Commands

`DATABASE_URL` is read from the process environment, then `.env.local`, then `.env`. Connection strings are never printed by the scripts.

```bash
npm run db:status   # read migration state; does not create the ledger
npm run db:verify   # empty DB only; applies + seeds twice inside an unconditional rollback
npm run db:migrate  # apply pending migrations
npm run db:seed     # apply the canonical development seed
```

`db:verify` refuses to run if a `coursedekho` schema already exists. The canonical seed is idempotent and is blocked when `NODE_ENV=production`; an intentional production demo requires the explicit `ALLOW_DEMO_SEED=true` override. Its accounts and passwords are demonstration data, never production credentials. The fixed demo hashes use the application's scrypt encoding so login exercises the same verifier as registered accounts; the seed never stores plaintext passwords in database rows.

Existing rows whose `password_hash` uses PostgreSQL `crypt()`/bcrypt or contains plaintext are not compatible with the application scrypt verifier. Before cutover, require a password reset or implement a separately reviewed one-time legacy verifier that immediately rehashes a successful login. Never guess or silently reinterpret an unknown hash format.

The database user must be able to create the `coursedekho` schema and install `pgcrypto`. If extension creation is restricted, a database administrator must install `pgcrypto` before migrations run.

## Approval transaction required by the API

Approval must be a single database transaction:

1. Select the submission `FOR UPDATE` and require `pending`.
2. Verify the authenticated actor is an admin and update the submission to `approved` with reviewer/time.
3. For new content, insert its inactive stable identity; for an edit, use `target_content_id`.
4. Insert the next immutable revision from the approved submission snapshot.
5. Point `content.current_revision_id` to that revision and publish it.
6. Append the audit event and commit.

Rejection locks the pending submission, stores a non-blank reason and reviewer/time, appends an audit event, and commits. Competing reviews are serialized by the row lock; a second transition is rejected.

## Legacy-data cutover

`CourseDekho_schema.sql` is now a non-executable compatibility pointer. The old destructive `DROP ... CASCADE` bootstrap is retired.

Do not point the application at `coursedekho` merely because these baseline migrations succeed. A populated legacy database needs a separately reviewed data migration after source-data profiling. That migration must:

1. Back up and make legacy tables read-only.
2. Preflight duplicate emails/usernames, orphan foreign keys, invalid statuses, missing review reasons, ambiguous bookmark targets, and unhashed passwords.
3. Map legacy integer identities to new UUIDs and lowercase enums without exposing internal IDs.
4. Convert approved rows into stable content plus revision 1; leave pending/rejected rows unpublished.
5. Reconcile per-table counts, approval states, topic order, and sampled checksums.
6. Cut the API over only after characterization and authorization tests pass against imported data.

No generic legacy import is included in this baseline because silently guessing how to repair inconsistent or production-like rows would violate data-integrity rules. Add it as the next versioned migration once the actual source dataset and repair policy are approved.

Rollback is forward-fix based: roll back the application deployment, leave the new schema unused, and add a compensating migration for schema defects. Do not drop the new schema or legacy tables as an ordinary rollback. Destructive cleanup requires a verified backup, reconciliation report, retention decision, and explicit approval.
