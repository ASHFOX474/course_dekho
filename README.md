# CourseDekho

A centralized course/resource management platform for CSE students in Bangladesh.
Authentication, academic browsing, learning activity, bookmarks, submissions, and
admin review are PostgreSQL-backed.

## Tech stack

| Layer       | Choice                                   |
|-------------|-------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)         |
| Language    | TypeScript                                 |
| UI          | React 19                                   |
| Styling     | Tailwind CSS v4                            |
| Icons       | lucide-react                               |
| Data        | PostgreSQL for authentication, catalog, workflow, and learning activity |
| Auth        | Scrypt passwords and opaque HTTP-only PostgreSQL sessions |

No extra state-management library (Redux/Zustand/etc.) is used. Authentication uses
React Context; database-backed pages use typed API clients and local request state.

## Getting started (VS Code)

```bash
# 1. install dependencies
npm install

# 2. configure DATABASE_URL, then initialize the development database
npm run db:migrate
npm run db:seed

# 3. run the dev server
npm run dev
```

Then open **http://localhost:3000** — it will redirect you to the login page.

Other useful commands:

```bash
npm run build   # production build (also type-checks + lints)
npm run start   # run the production build locally
npm run lint    # ESLint only
npx tsc --noEmit  # TypeScript check only
```

## Demo accounts

After applying the canonical development seed, enter one of these accounts in the
database-backed login form:

| Role    | Username | Password    |
|---------|----------|-------------|
| Student | `rafiul` | `student123`|
| Teacher | `sharif` | `teacher123`|
| Admin   | `nusrat` | `admin123`  |

## Folder structure

```
app/                     Next.js App Router pages (one folder = one route)
  login/                 Screen 1 — Login
  dashboard/              Screen 2 — Home Dashboard (role-aware)
  courses/                Screen 3 — Courses list
  courses/[courseId]/     Screen 4 — Roadmap / Resources tabs
  courses/[courseId]/topics/[topicId]/   Screen 5 — Resources within a Topic
  resources/[resourceId]/ Screen 6 — Resource detail
  bookmarks/              Screen 7 — Bookmarks
  progress/               Screen 8 — My Progress
  teacher/submissions/    Screen 9 — Teacher: My Submissions
  admin/approvals/        Screen 10 — Admin: Approval Queue
  access-history/         Extra page (linked from the sidebar)
  solved-questions/       Extra page (linked from the sidebar)
  profile/, settings/     Extra pages (linked from the sidebar)

components/
  layout/                 Sidebar, Topbar, AppShell (auth + role guard)
  ui/                     Small reusable pieces: Badge, ProgressBar,
                          CircularProgress, StatCard, ResourceTypeIcon, Logo

lib/
  types.ts                All TypeScript interfaces — the frontend's mirror of the ERD
  auth/AuthContext.tsx      Login/logout/session calls to the HTTP-only cookie API
  client/catalog-api.ts     Typed academic API client and display adapters
  client/workspace-api.ts   Typed profile, activity, bookmark, submission, and review client
  server/catalog/           Protected academic read services and HTTP handlers
  server/auth/              Password hashing, sessions, authorization, handlers
  server/repositories/      Typed PostgreSQL repositories, including auth
  utils.ts                 Small helpers (date formatting, class name merging, etc.)
```

## How the permission system works (for your presentation)

- **Student** — read-only consumer: browse, bookmark, track progress. No upload.
- **Teacher** — everything a Student can do, **plus** submitting new content.
  A submission starts as `pending` and is **not visible to students** until an
  Admin approves it through the transactional PostgreSQL workflow.
- **Admin** — full control: approves/rejects submissions, and (conceptually)
  manages the academic structure (University → Semester → Course → Topic).

`components/layout/AppShell.tsx` mirrors this in the UI: pages like
`/teacher/submissions` and `/admin/approvals` pass `allowedRoles={["teacher"]}` /
`["admin"]`, and AppShell shows an "Access restricted" panel to anyone else.

Server route handlers—not `AppShell`—are the security boundary. Every protected
backend handler must resolve the cookie session and assert the allowed role.

## Current implementation boundary

- Authentication, profiles, universities, semesters, courses, ordered topics,
  resources, enrollments, progress, bookmarks, access history, solved questions,
  submissions, and reviews are served from PostgreSQL.
- Protected reads are no-store. Workspace pages refresh on focus and every 15
  seconds; catalog pages load current PostgreSQL values on navigation or browser
  refresh.
- File download/preview remains disabled until a signed-file delivery API exists;
  raw storage metadata is not exposed through the catalog DTO.

## PostgreSQL schema baseline

The reconciled PostgreSQL schema and forward-only migration tooling now live in
[`database/`](database/README.md). Authentication, academic reads, and the
implemented workspace workflows are wired to it.
Use `npm run db:status`, `npm run db:verify`, `npm run db:migrate`, and
`npm run db:seed` as documented there.

## Backend foundation

Typed database rows, parameterized queries, repositories, transaction handling,
request validation, domain models, API DTOs, and safe error mapping live under
`lib/server/`. See the [backend foundation guide](docs/backend/foundations.md).
Authentication, academic catalog, transactional submission/review, enrollment,
progress, bookmark, access-history, solved-question, and profile APIs are included.
