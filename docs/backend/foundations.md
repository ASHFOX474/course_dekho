# Backend foundations

The backend follows a server-only layered architecture. Authentication and the
read-only academic catalog now use this typed path; remaining workflows can build
on the same boundary:

```text
untrusted request
  -> API validator
  -> handler-level session and role assertion
  -> authenticated/authorized service
  -> repository
  -> typed SQL query through Pool or PoolClient
  -> database row mapper
  -> domain model
  -> API DTO mapper
  -> { data } response
```

Errors travel through `mapErrorToApi` and use the frozen `{ error: { code, message, fieldErrors? } }` contract.

## Layer ownership

| Layer | Location | Owns | Must not own |
|---|---|---|---|
| Database | `lib/server/db` | Snake-case PostgreSQL row types, prepared parameterized SQL, row conversion, transactions | HTTP response shapes, authorization decisions |
| Repository | `lib/server/repositories` | Domain-oriented access methods over a supplied query executor | Global pool selection, request parsing, response serialization |
| Domain | `lib/server/domain` | Backend entities, lifecycle enums, `Date` values | PostgreSQL column names, JSON envelope details |
| API | `lib/server/api` | Request validation, contract DTOs, camelCase/ISO mapping, safe error envelopes | Raw SQL, internal numeric IDs, database error details |

The existing mock/UI types in `lib/types.ts` remain untouched. They contain display labels and demo-only fields, so using them as database or HTTP types would couple the migration to the prototype.

## Pool and transaction use

The existing pool remains in `lib/db.ts`. Repositories accept the common `query` surface implemented by both `pg.Pool` and `pg.PoolClient`:

```ts
import { pool } from "@/lib/db";
import { withTransaction } from "@/lib/server/db/transaction";
import { createRepositories } from "@/lib/server/repositories";

const readRepositories = createRepositories(pool);
const courses = await readRepositories.catalog.listCourses();

await withTransaction(pool, async (client) => {
  const transactionRepositories = createRepositories(client);
  // Every read/write in this operation must use transactionRepositories.
});
```

`withTransaction` commits on success, rolls back on failure, and always releases the client. It validates transaction options before acquiring a connection. `DEFERRABLE` is accepted only with `SERIALIZABLE READ ONLY`, matching PostgreSQL semantics.

Callbacks are not retried automatically. Retrying at this layer could repeat email, storage, or other non-database side effects. A future service may retry SQLSTATE `40001`/`40P01` only when the complete operation is explicitly proven idempotent.

## Query and mapping rules

- SQL values are parameters; public UUIDs are cast with `$n::uuid`.
- Prepared-query names include a version suffix so changed SQL can receive a new name.
- Queries select explicit columns and aliases; `SELECT *` is prohibited.
- Repositories return domain models, never raw rows or `QueryResult` objects.
- PostgreSQL `BIGINT` values are treated as strings at the row boundary and converted only after a safe-integer check.
- PostgreSQL timestamps become domain `Date` objects; API DTOs serialize them with `toISOString()`.
- Internal bigint IDs are used only for joins inside SQL and never selected into public models.

The catalog repository provides active universities, ordered active semesters,
filtered active courses, ordered active topics, and approved resources. Course,
topic, and detail resource queries reuse one SQL visibility boundary: the current
immutable revision must originate from an approved submission, and content plus
all academic ancestors must be active. Pending/rejected content therefore cannot
be represented by any learner-facing query.

The submission repository provides lookup by public ID and teacher-owned submission listing. It intentionally does not authorize actors; the future service/route must derive the actor from a verified server session before calling it.

## Validation and errors

Request validators accept `unknown`, reject non-object bodies and unknown fields, trim text, enforce OpenAPI length limits, validate resource enums, and validate public UUIDs. Client-supplied actor IDs are rejected as unknown fields.

Application errors map to their declared HTTP status and frozen API code. Known PostgreSQL integrity/serialization errors map to safe validation or conflict responses. Constraint names, SQL, connection details, and row values are never included. Unknown errors return `500 INTERNAL_ERROR`; server logging must use a request ID and allowlisted metadata, not raw driver messages or request bodies.

## Authentication and authorization

Authentication lives under `lib/server/auth`; persistent access is under the auth repository/query modules. Passwords use Node's built-in scrypt with per-password random salts (`N=32768`, `r=8`, `p=1`). The encoded hash is stored in `app_user.password_hash`; plaintext is never persisted or returned.

Sessions use 32 random bytes encoded as an opaque cookie token. Only its SHA-256 digest is written to `auth_session`, so a database read does not reveal usable session cookies. Sessions expire after seven days, are rotated on login, become invalid when the user is inactive, and are permanently revocable. The cookie is HTTP-only, `SameSite=Strict`, `Path=/`, and `Secure` in production or over HTTPS. Auth responses are `no-store`.

Registration allows student and teacher roles only. The service hashes the password before opening a short transaction, then resolves an active university and inserts the user, exact role profile, and session through repositories bound to one `PoolClient`. Any failure rolls the transaction back. Admin provisioning remains a separate admin-only workflow.

`requireRole` is called inside protected handler execution after session resolution.
The session, logout, and every catalog handler use this pattern. Future
teacher/admin handlers must pass their narrower allowlist before calling
repositories. Do not move this decision exclusively to Next.js middleware or
React components. Authenticated catalog responses use `private, no-store` and
`Vary: Cookie` so shared caches cannot cross user sessions.

## Read-only academic vertical slice

The `/api/v1` provider exposes active university and semester collections, course
filter/detail reads, database-ordered topics, course/topic approved-resource
collections, and approved-resource detail. Public UUIDs are validated before any
repository call. Missing or inactive parent records return `404`; a visible parent
with no visible children returns an empty collection.

The pages under `app/courses/` and `app/resources/[resourceId]/` use
`lib/client/catalog-api.ts` and no longer import academic/resource/progress mock
tables. The migration was performed in navigation order so PostgreSQL UUID links
never lead into legacy mock-ID pages. Bookmark mutation remains prototype state;
mock progress was removed from these pages rather than attached to unrelated UUIDs.

Unsafe browser auth requests verify `Origin`/Fetch Metadata in addition to `SameSite=Strict`. Set `APP_ORIGIN` to the canonical external origin when a reverse proxy could make the request URL ambiguous. Production must also provide a shared ingress/application rate limiter for login and registration; an in-memory limiter would be incorrect across multiple Next.js instances.

## Remaining backend work

Authentication, session persistence, the read-only catalog provider, and the
academic-page cutover are implemented. Submission/review, enrollment, progress,
bookmark, history, and solved-question workflows still use mock state. The next
implementation should add transactional teacher submission/admin review APIs,
always resolving the session and asserting the role inside each handler.
