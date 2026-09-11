# Authentication and authorization TDD evidence

## Source and journeys

No external plan file was used. The journeys came from the requested authentication milestone:

1. A student or teacher can register and receive an authenticated session only if the user, matching role profile, and session all commit.
2. A user can log in with username or email without exposing credentials or raw session tokens.
3. A user can restore and revoke an HTTP-only session.
4. A protected handler rejects missing sessions and roles outside its explicit allowlist.
5. The React client uses the server session and no longer compares mock plaintext passwords or stores identity in `localStorage`.

## RED and GREEN evidence

| Stage | Command | Result | Evidence |
|---|---|---|---|
| Baseline | `npm test` | PASS | 45 pre-existing tests passed before auth changes. |
| Auth RED | `node --test tests/characterization/api-contract.test.mjs tests/characterization/schema-migrations.test.mjs tests/characterization/auth-foundations.test.mjs` | EXPECTED FAIL | 7 failures: missing auth paths/security, missing auth modules, missing `0005`, and incompatible seed hashes. |
| Client RED | `node --test tests/characterization/auth-client-and-routes.test.mjs` | EXPECTED FAIL | 2 failures proved the client still used `localStorage`/mock credential comparison and mock users retained password fields. |
| Profile integrity RED | `node --test tests/characterization/auth-foundations.test.mjs` | EXPECTED FAIL | Credential/session SQL did not yet require the role-matching profile. |
| GREEN | `npm test` | PASS | 70 tests passed with no skips. |
| Coverage | `npm run test:coverage` | PASS | Lines 97.50%, branches 84.36%, functions 97.56%; all exceed 80%. |
| Static quality | `npm run lint` | PASS | ESLint completed without warnings or errors. |
| Types | `npx tsc --noEmit --incremental false` | PASS | Application and type-boundary tests compiled. |
| Production build | `npm run build` | PASS | Next.js compiled all four dynamic auth routes and generated 19 pages. |
| Dependency audit | `npm audit --omit=dev --offline` | PASS | Zero production dependency vulnerabilities found in the local audit data. |
| Database status | `npm run db:status` | UNAVAILABLE | Configured PostgreSQL at `127.0.0.1:5432` refused the connection; no migration was applied. |

Checkpoint commits were intentionally not created because the repository's AGENTS rules prohibit automatic commits.

## Guarantees

| # | Guarantee | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Public registration permits student/teacher, rejects admin, validates role-specific fields, and preserves password bytes. | `auth-foundations.test.mjs` registration validation | Unit | PASS |
| 2 | Password hashes are salted scrypt records; correct passwords verify and malformed records fail closed. | `auth-foundations.test.mjs` scrypt tests | Unit | PASS |
| 3 | Registration uses one transaction for active-university lookup, user, exact profile, and digest-only session creation. | `auth-foundations.test.mjs` service transaction tests | Integration | PASS |
| 4 | Login has generic failures, rotates an old session, and creates a seven-day replacement. | `auth-foundations.test.mjs` login tests | Integration | PASS |
| 5 | Cookies are HTTP-only, strict same-site, path scoped, expiring, and secure for production/HTTPS. | `auth-foundations.test.mjs` cookie tests | Unit | PASS |
| 6 | Unsafe browser requests reject foreign/malformed origins; duplicate or malformed session cookies are ignored. | `auth-foundations.test.mjs` origin/cookie tests | Unit | PASS |
| 7 | Credential and session queries require active users with the profile matching their role and use named parameterized SQL. | `auth-foundations.test.mjs` repository tests | Integration | PASS |
| 8 | Handler execution distinguishes unauthenticated from forbidden actors and returns safe error envelopes. | `auth-foundations.test.mjs` authorization/HTTP tests | Integration | PASS |
| 9 | OpenAPI defines all auth endpoints, write-only passwords, cookie security, and protected operation requirements. | `api-contract.test.mjs` | Contract | PASS |
| 10 | The client restores/login/logouts through the API and contains no localStorage/mock password authentication. | `auth-client-and-routes.test.mjs` | Characterization | PASS |
| 11 | Migration `0005` stores only bounded revocable token digests and includes lookup/cleanup indexes. | `schema-migrations.test.mjs` | Schema characterization | PASS |

## Known gaps

- Live migration/seed verification is pending until a disposable PostgreSQL instance is running.
- Production must supply a shared login/registration rate limiter and canonical `APP_ORIGIN`; these cannot be implemented correctly as per-process memory state in a horizontally scaled Next.js deployment.
- Password reset/change, admin provisioning, session management UI, and expired-session retention jobs are outside this milestone.
