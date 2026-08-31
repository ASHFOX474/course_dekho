# CourseDekho

A centralized course/resource management platform for CSE students in Bangladesh.
Authentication and the read-only academic browsing path are PostgreSQL-backed.
Learning activity and contribution/review screens still use prototype state while
their API migrations are completed.

## Tech stack

| Layer       | Choice                                   |
|-------------|-------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)         |
| Language    | TypeScript                                 |
| UI          | React 19                                   |
| Styling     | Tailwind CSS v4                            |
| Icons       | lucide-react                               |
| Data        | PostgreSQL auth + academic reads; remaining workflows use mock state |
| Auth        | Scrypt passwords and opaque HTTP-only PostgreSQL sessions |

No extra state-management library (Redux/Zustand/etc.) is used on purpose —
everything is plain React Context + `useState`, so it's easy to read and explain.

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

After applying the canonical development seed, log in with one of these (or use
the "Quick demo login" buttons on the login page itself):

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
  courses/[courseId]/     Screen 4 — Roadmap / Resources / Announcements tabs
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
  data/                    Mock "database tables" (users, courses, topics, resources,
                           submissions, bookmarks, progress, access history)
  queries.ts               Derived/computed values (course progress %, dashboard stats) —
                           this is the layer you'd swap for real API calls later
  auth/AuthContext.tsx      Login/logout/session calls to the HTTP-only cookie API
  client/catalog-api.ts     Typed academic API client and display adapters
  server/catalog/           Protected academic read services and HTTP handlers
  server/auth/              Password hashing, sessions, authorization, handlers
  server/repositories/      Typed PostgreSQL repositories, including auth
  store/DataContext.tsx     Holds the data that can change at runtime (submissions,
                           resources, bookmarks) and the functions that mutate it
  utils.ts                 Small helpers (date formatting, class name merging, etc.)
```

## How the permission system works (for your presentation)

- **Student** — read-only consumer: browse, bookmark, track progress. No upload.
- **Teacher** — everything a Student can do, **plus** submitting new content.
  A submission starts as `pending` and is **not visible to students** until an
  Admin approves it (see `DataContext.approveSubmission`, which is what
  actually publishes a new `Resource`).
- **Admin** — full control: approves/rejects submissions, and (conceptually)
  manages the academic structure (University → Semester → Course → Topic).

`components/layout/AppShell.tsx` mirrors this in the UI: pages like
`/teacher/submissions` and `/admin/approvals` pass `allowedRoles={["teacher"]}` /
`["admin"]`, and AppShell shows an "Access restricted" panel to anyone else.

Server route handlers—not `AppShell`—are the security boundary. Every protected
backend handler must resolve the cookie session and assert the allowed role.

## Current prototype boundary

- Universities, semesters, courses, ordered topics, and approved active resources
  on the course/resource pages come from protected PostgreSQL APIs.
- Submission/review, bookmarks, progress, history, and solved-question state still
  live in `lib/data/*` + React state. **Refreshing the page resets those changes.**
- File download/preview remains disabled until a signed-file delivery API exists;
  raw storage metadata is not exposed through the catalog DTO.

## PostgreSQL schema baseline

The reconciled PostgreSQL schema and forward-only migration tooling now live in
[`database/`](database/README.md). Authentication and academic reads are wired to
it; the remaining workflow UI is not.
Use `npm run db:status`, `npm run db:verify`, `npm run db:migrate`, and
`npm run db:seed` as documented there.

## Backend foundation

Typed database rows, parameterized queries, repositories, transaction handling,
request validation, domain models, API DTOs, and safe error mapping live under
`lib/server/`. See the [backend foundation guide](docs/backend/foundations.md).
Authentication and read-only academic catalog routes are included. Transactional
submission/review, enrollment, progress, and bookmark APIs remain to be implemented.
