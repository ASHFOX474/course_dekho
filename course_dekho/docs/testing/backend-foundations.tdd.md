# Backend foundations TDD evidence

Date: 2026-08-31

## Source and journeys

No external plan file was used. Tests were derived from the requested backend foundation and the frozen v1 OpenAPI contract.

1. As an API implementer, I can validate an unknown request into a typed contract request without accepting client-controlled actor fields.
2. As a service implementer, I can use the same repository with the existing pool or a transaction client without leaking database row types.
3. As an API consumer, I receive one safe error envelope for application, validation, PostgreSQL, and unexpected failures.
4. As a service implementer, successful transactions commit while failures roll back and always release the client.
5. As a learner, catalog repository reads cannot return pending/rejected or inactive content.

## RED

Command:

```text
node --test tests/characterization/backend-foundations.test.mjs
```

Expected failure was observed before production modules existed:

```text
ERR_MODULE_NOT_FOUND: lib/server/api/errors.ts
tests 1
pass 0
fail 1
```

No checkpoint commit was created because repository instructions prohibit automatic commits.

## GREEN

Focused command:

```text
node --test tests/characterization/backend-foundations.test.mjs
tests 15
pass 15
fail 0
```

Full command:

```text
npm test
tests 45
pass 45
fail 0
```

## Guarantees

| Guarantee | Evidence | Type |
|---|---|---|
| Submission and rejection inputs enforce OpenAPI fields, lengths, enums, UUIDs, trimming, and no extra actor fields | `backend-foundations.test.mjs` validation cases | Unit |
| Error envelopes preserve frozen codes/statuses and hide PostgreSQL/unexpected details | `backend-foundations.test.mjs` error mapping cases | Unit |
| Transactions commit/rollback/release correctly and reject invalid deferrable options | `backend-foundations.test.mjs` transaction cases | Unit |
| Pool and PoolClient both satisfy repository/transaction boundaries | `tests/types/backend-foundations.type-test.ts` plus `tsc` | Compile-time |
| Database rows cannot be assigned directly to API DTOs | `tests/types/backend-foundations.type-test.ts` expected type error | Compile-time |
| Catalog SQL is prepared, parameterized, explicit-column, ordered, active-only, and approved-only | Catalog repository query assertions | Repository unit |
| Row mappers normalize bigint/timestamps/nulls into domain types | Catalog/submission repository cases | Repository unit |
| API mappers produce camelCase DTOs, ISO timestamps, and published-only constants | API mapper case | Unit |

## Coverage and gaps

`npm run test:coverage` passed the 80% gates:

```text
all files: 98.63% lines, 89.47% branches, 98.36% functions
```

Lint and TypeScript checks passed. Repository SQL was exercised with injected deterministic executors; it was not executed against a live PostgreSQL instance because the configured local server is unavailable. No database or external state was modified.
