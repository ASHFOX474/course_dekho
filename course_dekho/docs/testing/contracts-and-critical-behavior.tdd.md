# Contracts and Critical Behavior — TDD Evidence

## Source and journeys

No external plan file was used. The journeys were derived from the repository's `AGENTS.md` rules and the request to freeze contracts and critical behavior.

1. As a student, I can browse only active, approved content and my enrollment is explicit rather than inferred from progress.
2. As a teacher, I can create a pending submission but cannot approve or directly publish it.
3. As an admin, I can approve or reject a pending submission exactly once; approval publishes content and rejection preserves a reason.
4. As a frontend consumer, I can rely on stable v1 identifiers, enums, response envelopes, errors, and role permissions.

## RED evidence

Tests and the `npm test` script were added before the contract or domain implementation.

Command:

```text
npm test
```

Observed result: exit code 1, 0 passing and 6 failing test targets. The failures were the intended missing-implementation signals:

```text
ERR_MODULE_NOT_FOUND: lib/domain/critical-behavior.ts
ENOENT: contracts/course-dekho.v1.openapi.json
```

No checkpoint commit was created because repository instructions prohibit automatic commits.

## GREEN and refactor evidence

The OpenAPI artifact and pure workflow policy were added, after which the same command passed. `DataContext` was then refactored to use the characterized workflow functions and the tests remained green.

Final command:

```text
npm test
```

Final result: exit code 0, 16 passed, 0 failed, 0 skipped.

## Test specification

| # | Guarantee | Test target | Type | Result |
|---|---|---|---|---|
| 1 | Students, teachers, and admins retain the documented permission boundaries | `critical-flows.test.mjs` — role permissions | Characterization/unit | PASS |
| 2 | Learner-facing content requires an approved submission and active publication | `critical-flows.test.mjs` — approved visibility | Characterization/unit | PASS |
| 3 | Active/completed enrollment is explicit and progress alone does not enroll | `critical-flows.test.mjs` — enrollment semantics | Characterization/unit | PASS |
| 4 | Teacher-created submissions start pending with provider-owned identity and time | `critical-flows.test.mjs` — teacher submission | Characterization/unit | PASS |
| 5 | Students/admins cannot create teacher submissions and blank titles are rejected | `critical-flows.test.mjs` — forbidden/invalid submission | Characterization/unit | PASS |
| 6 | Admin approval records review data and creates the corresponding resource | `critical-flows.test.mjs` — approval | Characterization/unit | PASS |
| 7 | Non-admin and repeated approval cannot publish content | `critical-flows.test.mjs` — invalid approval | Characterization/unit | PASS |
| 8 | Rejection requires and preserves a non-blank reason | `critical-flows.test.mjs` — rejection | Characterization/unit | PASS |
| 9 | v1 exposes the operations needed by the student, teacher, and admin journeys | `api-contract.test.mjs` — critical paths | Contract | PASS |
| 10 | Public IDs remain strings and public user data contains no password fields | `api-contract.test.mjs` — identifier/user shape | Contract | PASS |
| 11 | Status, resource-type, error, and permission enums remain stable | `api-contract.test.mjs` — enums/permissions | Contract | PASS |
| 12 | Contract references are local, allowlisted, and resolvable | `api-contract.test.mjs` — `$ref` validation | Contract/security | PASS |
| 13 | Protected operations declare their required provider permission | `api-contract.test.mjs` — operation permissions | Contract/security | PASS |
| 14 | Approved-resource responses cannot represent pending, rejected, or inactive content | `api-contract.test.mjs` — publication shape | Contract | PASS |

## Coverage and repository verification

```text
npm run test:coverage
```

Result: exit code 0. New domain policy coverage was 98.94% lines, 95.45% branches, and 100% functions, above the configured 80% thresholds.

```text
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Results: all passed. The first sandboxed build attempt failed because Turbopack was denied permission to bind a local port while processing CSS; the same build passed outside that restriction.

## Known gaps

- These are domain and contract characterization tests, not browser E2E tests. The repository has no browser test runner or component-testing dependency.
- No API provider exists yet, so real serialized responses and database transactions cannot yet be checked against the OpenAPI artifact.
- Coverage is intentionally scoped to the new domain policy module; it is not a claim of 80% coverage for the existing frontend.
- Node reports a non-failing module-type warning while directly loading the TypeScript policy file. Adding package-wide ESM semantics solely to silence that warning was avoided because it would broaden this change.
- Binary upload, admin CRUD, progress, bookmark, history, and solved-question endpoints remain explicitly outside the current v1 artifact and require contract-first additions before implementation.
