# CourseDekho — Frontend

A centralized course/resource management platform for CSE students in Bangladesh.
This repo is the **frontend only**, built with realistic mock data standing in for
the Postgres database described in the project's ERD.

## Tech stack

| Layer       | Choice                                   |
|-------------|-------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)         |
| Language    | TypeScript                                 |
| UI          | React 19                                   |
| Styling     | Tailwind CSS v4                            |
| Icons       | lucide-react                               |
| Data        | In-memory mock data (`lib/data/`) — no DB calls yet |
| Auth        | Hand-rolled context, demo accounts, `localStorage` session |

No extra state-management library (Redux/Zustand/etc.) is used on purpose —
everything is plain React Context + `useState`, so it's easy to read and explain.

## Getting started (VS Code)

```bash
# 1. install dependencies
npm install

# 2. run the dev server
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

There's no real signup flow — log in with one of these (or use the
"Quick demo login" buttons on the login page itself):

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
  auth/AuthContext.tsx      Login/logout, session persisted in localStorage
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

`components/layout/AppShell.tsx` enforces this in the UI: pages like
`/teacher/submissions` and `/admin/approvals` pass `allowedRoles={["teacher"]}` /
`["admin"]`, and AppShell shows an "Access restricted" panel to anyone else.

## Important: this is a frontend-only prototype

- All data lives in memory (`lib/data/*` + React state). **Refreshing the page
  resets anything you changed** (new submissions, approvals, bookmarks) —
  there is no backend/database call yet.
- The `lib/queries.ts` layer is deliberately written so it can be swapped for
  real `fetch()` calls to a Postgres-backed API later without changing any
  page components.
