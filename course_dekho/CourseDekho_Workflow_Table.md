# CourseDekho — Remaining Workflow (Table Format)

Based on the actual repo contents (`course_dekho.zip`), not a fresh guess. Legend: ✅ Done · 🟡 Partial · ⬜ Not started

## 0. Current status snapshot

| Layer | Component | Status | Notes |
|---|---|---|---|
| Database | ERD + schema design | ✅ | 26-table schema, ISA hierarchy for User/Content |
| Database | Tables created in Postgres | 🟡 | Done, but **check which of the 3 SQL files you actually ran** — see warning above |
| Database | Seed/demo data | 🟡 | `demo_setup.sql` exists but matches a different, older schema shape |
| Database | Connection pool in the app (`pg` client setup) | ⬜ | `.env.local` has `DATABASE_URL`, but no code in `lib/` opens a connection yet |
| Backend | API routes (any) | ⬜ | Zero found in `app/` — no `route.ts` files anywhere |
| Backend | Real authentication | ⬜ | Current login is hardcoded demo accounts + `localStorage`, not real |
| Backend | Business logic (enrollment, approval, progress) | ⬜ | Currently simulated only in-memory via `DataContext.tsx` |
| Frontend | Login + role-aware layout/nav | ✅ | Working with demo accounts |
| Frontend | Dashboard, Courses list/detail, Topic resources, Resource detail | ✅ | Built, using mock data from `lib/data/` |
| Frontend | Bookmarks, Progress, Solved Questions, Access History | ✅ | Built, mock data |
| Frontend | Teacher "My Submissions" | ✅ | Built, mock data, shows rejection reasons |
| Frontend | Admin "Approval Queue" | ✅ | Built, mock approve/reject (doesn't persist on refresh) |
| Frontend | **Admin CRUD for University/Semester/Course/Topic** | ⬜ | Not built at all — only the approvals queue exists under `/admin` |
| Frontend | **Explicit Enroll/Unenroll action** | ⬜ | "Enrolled" is currently just inferred from having a progress record — no real enroll button/table write |
| Frontend | Search | ⬜ | Not built |
| Integration | Swap mock data for real API calls | ⬜ | `lib/queries.ts` was deliberately written to make this swap easy later — that time is now |

**Bottom line:** you're not behind — you have 10+ fully designed, working screens. But essentially 100% of the actual "database project" grading criteria (real queries, real transactions, a live approval workflow) still needs to be built, since nothing currently talks to Postgres.

---

## 1. Fix before writing more code

| # | Issue | Why it matters | Action |
|---|---|---|---|
| 1 | Three different SQL files in the repo (`CourseDekho_schema.sql`, `CourseDekho_fresh_schema.sql`, `demo_setup.sql`) describe **three different schemas** | You risk building the API against a schema that isn't actually the one in your database, or one with the bugs from the earlier review | Pick ONE canonical file (recommend the fixed version with `NOT NULL`/`UNIQUE`/`CHECK` fixes), delete or archive the other two, `DROP`+recreate your dev DB from it |
| 2 | No `lib/db.ts` (or similar) connection module | Every API route would otherwise open its own client — connection leaks | Add one `Pool` instance, imported everywhere |
| 3 | No admin UI for building the academic structure | Without it, nobody can create a University/Course/Topic through the app — someone has to hand-write SQL for every demo course | Build this in Phase 2 below, don't leave it for the end |

---

## 2. Remaining work by phase

### Phase 1 — Wire the backend to the real database

| Task | Layer | Owner | Status |
|---|---|---|---|
| Reconcile the 3 schema files into 1, rebuild dev DB | Database | A | ⬜ |
| Add `lib/db.ts` with a pooled `pg` client | Backend | A | ⬜ |
| Real auth: bcrypt hashing, session/JWT, `POST /api/auth/register`, `/login`, `/logout` | Backend | A | ⬜ |
| Server-side role guard (middleware), not just the UI's `AppShell` check | Backend | A | ⬜ |
| `GET /api/universities`, `/api/courses`, `/api/courses/:id`, `/api/courses/:id/topics` | Backend | A | ⬜ |
| Replace `lib/data/academics.ts` mock reads with real `fetch()` calls | Frontend | B | ⬜ |
| Replace demo login with real register/login forms hitting the new auth API | Frontend | B | ⬜ |

### Phase 2 — Missing features + real mutations

| Task | Layer | Owner | Status |
|---|---|---|---|
| Enrollment API (`POST/DELETE /api/enrollments`) + real enroll button | Backend + Frontend | A / B | ⬜ |
| Progress API (update on topic access, get progress-per-course) | Backend + Frontend | A / B | ⬜ |
| Bookmark API backed by the DB's `UNIQUE(user_id, content_id)` constraint (handle the 409) | Backend + Frontend | A / B | ⬜ |
| **New:** Admin CRUD pages for University/Semester/Course/Topic (create/edit/delete, reorder `topic_order`) | Backend + Frontend | A / B | ⬜ |
| Wire `DataContext` bookmark/progress state to real API instead of in-memory only | Frontend | B | ⬜ |

### Phase 3 — Submission → approval workflow for real

| Task | Layer | Owner | Status |
|---|---|---|---|
| `POST /api/submissions` (teacher creates, one endpoint per content type or a generic one) | Backend | A | ⬜ |
| `POST /api/submissions/:id/approve` — transaction: insert `approved_content` + correct subtype row | Backend | A | ⬜ |
| `POST /api/submissions/:id/reject` — requires `rejection_reason` | Backend | A | ⬜ |
| Wire the existing Teacher Submissions + Admin Approvals *pages* (UI already built) to these real endpoints | Frontend | B | ⬜ |
| Access-history logging on content open, "mark question solved" endpoint | Backend + Frontend | A / B | ⬜ |
| Reconcile `demo_setup.sql` seed data with the final schema so demo accounts have real submissions to review | Database | A | ⬜ |

### Phase 4 — Search, polish, deploy, report

| Task | Layer | Owner | Status |
|---|---|---|---|
| Search/filter endpoint + UI | Backend + Frontend | A / B | ⬜ |
| `EXPLAIN ANALYZE` on the 3–4 heaviest queries | Database | A | ⬜ |
| Loading/empty/error states across pages already built | Frontend | B | ⬜ |
| Deploy: Vercel (app) + hosted Postgres (Neon/Supabase/Railway) | Both | A / B | ⬜ |
| Write report: final ERD, schema, sample queries, screenshots | Both | A / B | ⬜ |
| Rehearse demo: student → teacher → admin walkthrough | Both | A / B | ⬜ |

---

## 3. Definition of done

| # | Item | Status |
|---|---|---|
| 1 | One canonical, verified SQL schema — everything else deleted | ⬜ |
| 2 | Real auth (no more `localStorage` demo login) | ⬜ |
| 3 | Every existing page fetches from Postgres, not `lib/data/` | ⬜ |
| 4 | Admin can build the academic structure through the UI | ⬜ |
| 5 | Enrollment is a real, persisted action | ⬜ |
| 6 | Submission → approval loop writes real rows and survives a refresh | ⬜ |
| 7 | Search works | ⬜ |
| 8 | Deployed and demoable | ⬜ |
| 9 | Report + slides ready | ⬜ |

**Priority if time runs short:** #2, #3, #6 are what turn this from "a nice-looking prototype" into an actual database project. Cut search and visual polish before cutting those.
