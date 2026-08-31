# CourseDekho v1 Behavior Contract

## Authority and scope

`contracts/course-dekho.v1.openapi.json` is the authoritative HTTP boundary for the first PostgreSQL-backed API. The frontend is the consumer; future Next.js route handlers are the provider. Repository maintainers approve contract changes.

This document freezes semantic rules that span more than one endpoint. It does not redefine response fields already described by OpenAPI.

The v1 contract covers authentication, course browsing, approved-resource visibility, explicit enrollment, teacher submission, and admin review. Binary upload, admin CRUD, progress, bookmarks, access history, and solved-question endpoint shapes remain future contract additions.

## Authentication and sessions

- `POST /api/v1/auth/register` creates student or teacher accounts only. Public callers can never create an admin.
- `POST /api/v1/auth/login` accepts a username or email and returns the same public user shape as session lookup.
- `POST /api/v1/auth/logout` revokes the current server-side session before expiring its cookie.
- `GET /api/v1/session` resolves the current active user from the opaque cookie.
- Passwords are write-only request fields and never occur in a response.
- Registration creates `app_user`, the role-matching profile, and the initial session atomically. A missing/inactive university or profile failure rolls back the account.
- The session cookie is HTTP-only, `SameSite=Strict`, path-scoped to `/`, and `Secure` in production/HTTPS. The database stores only a SHA-256 token digest and a bounded expiry, never the raw cookie token.
- Unsafe browser requests must be same-origin. Deployments behind a proxy should set `APP_ORIGIN` to the canonical external origin and terminate TLS before production traffic.

Authentication identifies an actor; it does not grant a business permission. Every protected route handler must resolve the session and call the server-side role/permission assertion before reading or mutating protected data. Middleware and UI guards may improve navigation but are not authorization boundaries.

## Role permissions

| Capability | Student | Teacher | Admin |
|---|:---:|:---:|:---:|
| Browse active approved content | Yes | Yes | Yes |
| Bookmark, track progress, solve questions, view own history | Yes | Yes | No learner guarantee in v1 |
| Submit educational content | No | Yes | No |
| View own submissions and rejection reasons | No | Yes | No |
| Approve or reject submissions | No | No | Yes |
| Manage users, universities, semesters, courses, topics, and resources | No | No | Yes |

Teacher permissions include every student learning permission. Admin access is administrative rather than an implicit learner role. A future requirement for admins to keep learner state is an additive contract change and requires an explicit product decision.

All identities and roles come from the authenticated server session. Client-supplied `userId`, `teacherId`, `reviewedBy`, role, status, or timestamps are ignored or rejected. UI guards are navigation aids, not authorization.

## Approved-content visibility

A learner-facing resource is visible only when all of the following are true:

1. Its originating submission is `approved`.
2. A corresponding published-content record exists.
3. The published-content record is active.
4. Its course and topic are still visible.

Pending and rejected submissions are never returned by course, topic, search, dashboard, bookmark-resolution, or recent-content endpoints. Teachers may see their own pending/rejected submissions only through the own-submissions boundary. Admins may see submissions through admin review boundaries.

Approval is one atomic transition: verify the actor is an admin, conditionally move a pending submission to approved, create the published record and its type-specific data, and record review metadata in one database transaction. Repeated or competing reviews return `409 INVALID_TRANSITION` and must not create duplicate content.

Rejection is allowed only from pending, requires a non-blank reason, and preserves that reason for the submitting teacher. Editing approved content creates a new pending revision; it never mutates the published version in place.

## Enrollment semantics

Enrollment is explicit persistent state, not a side effect of viewing a topic or writing progress:

- Students and teachers may enroll themselves; the provider derives the user from the session.
- `active` and `completed` count as enrolled. `dropped` does not.
- Starting or updating progress does not create an enrollment.
- Dropping a course retains the enrollment row and learning history with status `dropped`.
- Re-enrolling reactivates the existing user/course relationship rather than inserting a duplicate.
- The database must enforce one enrollment per user and course.

The current mock UI infers enrollment from the presence of progress. That is a documented compatibility behavior only. It must be replaced atomically when the enrollment API is integrated; it is not the PostgreSQL contract.

## API conventions

- `/api/v1` is the compatibility boundary.
- Every identifier is an opaque JSON string, even if PostgreSQL uses an integer internally.
- JSON fields use camelCase; database snake_case never leaks directly.
- Enum values are lowercase machine values defined in OpenAPI. UI display labels are presentation concerns.
- Timestamps are RFC 3339 `date-time` strings in UTC.
- Successful responses use `{ "data": ... }`.
- Errors use `{ "error": { "code", "message", "fieldErrors?" } }`.
- Public user responses never contain password or password-hash fields.
- Empty collections return `200` with `data: []`; absence is not represented as `null`.

## Consumer jobs frozen by v1

1. A student can browse courses, ordered topics, and active published resources without seeing review-queue data.
2. A student or teacher can explicitly enroll and retain a stable enrollment status independent of progress.
3. A teacher can create a pending submission and inspect its eventual approval or rejection reason.
4. An admin can review a pending submission exactly once; approval publishes, while rejection records a reason.

## Change protocol

Change the OpenAPI artifact before implementing a provider or consumer change. Additive optional fields require consumer review. Removing fields, making optional fields required, changing enum meaning, or repurposing an operation requires a new version or an explicit migration plan.
