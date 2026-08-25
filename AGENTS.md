<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:coursedekho-ecc-rules -->
# CourseDekho engineering guide

## Current project

- This is a frontend-only prototype built with Next.js 16 App Router, React 19,
  strict TypeScript, Tailwind CSS 4, and lucide-react.
- Runtime data currently comes from `lib/data/*` and React state. Despite the
  `pg` dependency and SQL files in the repository, the app does not currently
  make PostgreSQL calls.
- `app/*` contains routes, `components/*` contains shared UI/layout,
  `lib/auth/AuthContext.tsx` owns the demo session, `lib/store/DataContext.tsx`
  owns mutable in-memory data, and `lib/queries.ts` derives view data.
- Provider order matters: `AuthProvider` must wrap `DataProvider` because the
  data store reads the active user.

## Required workflow

Before changing code:

1. Inspect the relevant route, component, context, types, and data flow.
2. Explain the proposed change, affected files, database impact, security
   considerations, edge cases, and verification plan.
3. Preserve existing patterns and make the smallest focused change.
4. Do not rewrite unrelated files or discard existing worktree changes.

When debugging, reproduce the issue first, identify the root cause, and explain
why the proposed fix addresses it before editing files.

## Architecture and product invariants

- Keep route components focused on presentation and interaction. Put shared
  state mutations in the existing contexts and derived calculations in
  `lib/queries.ts` unless a deliberate architecture change is approved.
- Preserve the role model: `student`, `teacher`, and `admin`.
- Teacher submissions start as `pending`; they become published resources only
  after admin approval. Rejected submissions must retain their rejection reason.
- Students must not see unapproved resources.
- Treat `AppShell` role checks as prototype UI guards, not production security.
  A real backend must enforce authentication and authorization server-side.
- Demo credentials and `localStorage` sessions are prototype-only. Never carry
  plaintext passwords or client-only authorization into production code.

## Database and sensitive-data guardrails

- Do not change SQL schemas, migrations, relationships, constraints, or seed
  data without explicit approval and a written data-integrity impact analysis.
- Do not introduce live database calls merely because `pg` is installed.
- Never expose, print, commit, or overwrite values from `.env.local`.
- When a backend is requested, define API and authorization boundaries before
  replacing the mock-data/query layer.

## Generated files and dependencies

- Do not edit `node_modules/`, `.next/`, `next-env.d.ts`, or
  `tsconfig.tsbuildinfo` by hand.
- Do not add or upgrade dependencies without explaining why the existing stack
  is insufficient and receiving approval.

## Verification

For code changes, run the checks relevant to the affected area. The default
baseline is:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

For changes to authentication, authorization, submissions, approvals, or
bookmarks, also verify the affected flow manually with the Student, Teacher,
and Admin demo accounts described in `README.md`.
<!-- END:coursedekho-ecc-rules -->
