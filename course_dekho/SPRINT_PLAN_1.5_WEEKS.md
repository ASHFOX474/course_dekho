# CourseDekho — 1.5 Week Sprint to Production

**Goal:** Transform from "beautiful prototype" to "real DBMS application" ready for presentation/demo.

**Deadline:** 1.5 weeks
**Database:** Neon (8 migrations applied, ready)
**Deployment:** Vercel (frontend) + Neon (database)

---

## 📋 Scope Definition

### MUST HAVE (by deadline)
1. ✅ Real authentication (sign up, login, logout — no localStorage)
2. ✅ Real database reads (all catalog pages use live data)
3. ✅ Teacher submission workflow (create → pending)
4. ✅ Admin approval workflow (review → approve/reject in transaction)
5. ✅ Enrollment (student clicks "Enroll", persists)
6. ✅ Progress tracking (view topic progress)
7. ✅ Bookmarks (create, delete, view)
8. ✅ Demo data seeded & demo accounts working

### NICE TO HAVE (if time)
- Search functionality
- Admin CRUD for creating courses/topics
- Solved questions workflow
- Access history
- File metadata in submissions

### OUT OF SCOPE
- Binary file upload/download (API structure exists, delivery mechanism deferred)
- Advanced analytics
- Email notifications

---

## 🗓️ Timeline Breakdown

### **WEEK 1: Database Integration + Auth**

#### Day 1-2: Verify & Seed
- [ ] Run `npm run db:seed` to populate demo data (universities, courses, topics, demo accounts)
- [ ] Verify demo accounts exist: `rafiul` (student), `sharif` (teacher), `nusrat` (admin)
- [ ] Spot-check: SELECT from `coursedekho.app_user`, `coursedekho.course`, `coursedekho.content`
- [ ] Ensure all 5 universities + 3 demo courses exist
- **Deliverable:** Live data in Neon, no mock data needed

#### Day 2-3: Real Authentication Backend
- [ ] Audit current auth implementation (`lib/server/auth/`)
- [ ] Verify `POST /api/v1/auth/register` writes to `app_user`, `student_profile`/`teacher_profile`
- [ ] Verify `POST /api/v1/auth/login` verifies scrypt hash, creates session in `auth_session`
- [ ] Verify `POST /api/v1/auth/logout` revokes session
- [ ] Verify `GET /api/v1/session` returns current user from cookie
- [ ] **Test locally:** Sign up as new student, verify it saves to DB, persist across page refresh
- **Deliverable:** Real accounts in database, no hardcoded credentials

#### Day 4-5: Frontend Auth Integration
- [ ] Replace `lib/auth/AuthContext.tsx` mock login with real `/api/v1/auth/login` calls
- [ ] Update sign-up form (`app/login/page.tsx`) to hit `/api/v1/auth/register`
- [ ] Verify session persists on page refresh
- [ ] Test role-based redirect (student→dashboard, admin→approvals, etc.)
- [ ] Verify logout works and clears session cookie
- **Deliverable:** Login/register/logout against live Neon database

#### Day 5-6: Catalog API Verification
- [ ] Verify `GET /api/v1/universities` returns live data
- [ ] Verify `GET /api/v1/courses` returns live filtered courses
- [ ] Verify `GET /api/v1/courses/:id/topics` returns ordered topics
- [ ] Verify `GET /api/v1/resources/:id` returns approved resources with details
- [ ] **Test:** Navigate courses page, see real universities/courses/topics
- **Deliverable:** All catalog pages show live Neon data (not mock)

---

### **WEEK 2: Workspace APIs + Core Workflows**

#### Day 6-7: Enrollment Workflow
- [ ] Verify `POST /api/v1/enrollments` implementation
  - Requires: authenticated session, valid course ID
  - Checks: no duplicate enrollment, required role
  - Writes to `coursedekho.enrollment` table
- [ ] Add "Enroll" button to course detail page (if not exists)
- [ ] Verify enrollment persists and shows "Enrolled" status
- [ ] Test unenroll via `DELETE /api/v1/enrollments/:id`
- **Deliverable:** Students can enroll/unenroll, data persists

#### Day 7-8: Progress Tracking
- [ ] Verify `GET /api/v1/me/progress` returns user's progress per course
- [ ] Verify `POST /api/v1/me/progress/:topicId` updates progress when viewing topic
- [ ] Add auto-increment view count on topic/resource access
- [ ] Display progress bar on course detail page
- [ ] Test: Enroll → View topics → Progress updates
- **Deliverable:** Progress tracking works end-to-end

#### Day 8-9: Bookmarks Workflow
- [ ] Verify `POST /api/v1/me/bookmarks` (create bookmark)
- [ ] Verify `DELETE /api/v1/me/bookmarks/:id` (remove)
- [ ] Verify `GET /api/v1/me/bookmarks` returns all user bookmarks
- [ ] Add bookmark button to course/topic/resource pages
- [ ] Display bookmarks on `/bookmarks` page (pull from real API)
- **Deliverable:** Bookmark creation, deletion, viewing work

#### Day 9-10: Submission Workflow (Teacher)
- [ ] Verify `POST /api/v1/submissions` implementation
  - Requires: authenticated teacher session
  - Writes to `coursedekho.content_submission` with status='pending'
- [ ] Create submission form on `/contributor/submissions` page
- [ ] Fields: course, topic, resource type, title, description
- [ ] Test: Teacher submits, appears in teacher's submissions list
- [ ] Verify submission status shows "pending"
- **Deliverable:** Teachers can submit content, appears in DB

#### Day 10-11: Approval Workflow (Admin)
- [ ] Verify `POST /api/v1/admin/submissions/:id/approve` in single transaction:
  - Verify actor is admin
  - Lock submission `FOR UPDATE`
  - Insert into `coursedekho.content` (stable identity)
  - Insert into `coursedekho.content_revision` (immutable snapshot)
  - Update `submission.status = 'approved'`
  - Update `content.current_revision_id` → new revision
  - Publish content (`is_active = true`, `published_at = now()`)
- [ ] Verify `POST /api/v1/admin/submissions/:id/reject` requires rejection reason
- [ ] Wire `/admin/approvals` page to real API
- [ ] Test: Submit → Admin approves → Content visible to students
- **Deliverable:** Approval workflow works, publishes content

#### Day 11-12: End-to-End Testing
- [ ] Create demo script:
  1. Student account: browse courses → enroll → view topics → bookmark → see progress
  2. Teacher account: submit content → wait for approval
  3. Admin account: review submission → approve/reject → see published content
  4. Verify student sees approved content, not pending submissions
- [ ] Performance check: `EXPLAIN ANALYZE` on 3-4 key queries
- [ ] Error handling: Test invalid IDs, permission mismatches, edge cases
- **Deliverable:** Full workflow demo-ready

---

### **DAYS 13-14: Polish + Deployment**

#### Day 12-13: Remaining Workspace APIs (if time)
- [ ] Solved questions: `POST /api/v1/me/solved-questions`, view
- [ ] Access history: Auto-log on resource/topic view
- [ ] Admin stats: `/api/v1/admin/stats` for dashboard
- **Deliverable:** Nice-to-have features working

#### Day 13-14: Deployment
- [ ] Verify `.env.local` has correct Neon `DATABASE_URL`
- [ ] Run `npm run build` with production NODE_ENV
- [ ] Test build locally: `npm run start`
- [ ] Deploy to Vercel
  - Add `DATABASE_URL` env var in Vercel project settings
  - Push to GitHub (if using)
  - Deploy via `vercel deploy`
- [ ] Smoke test deployed app (login, browse, enroll, submit)
- **Deliverable:** App live on Vercel + Neon

#### Day 14: Presentation Prep
- [ ] Screenshot demo scenarios
- [ ] Write final report: ERD, key queries, architecture decisions
- [ ] Rehearse 10-minute demo (student → teacher → admin flow)
- **Deliverable:** Presentation-ready

---

## 🔍 Definition of Done

| # | Item | How to Verify |
|---|------|---|
| 1 | Real auth (no localStorage) | Sign up new account, refresh page → still logged in |
| 2 | Real database reads | All pages use `/api/v1/*` endpoints |
| 3 | Enrollment persists | Enroll → refresh → still enrolled |
| 4 | Progress tracking | View topic → progress updates → persists on refresh |
| 5 | Bookmarks work | Bookmark resource → view on `/bookmarks` → delete → gone |
| 6 | Teacher can submit | Teacher submits → appears in "My Submissions" with status="pending" |
| 7 | Admin can approve | Admin approves → submission status→"approved" → student sees content |
| 8 | Demo accounts work | Login as rafiul/sharif/nusrat with seeded passwords |
| 9 | No mock data visible | Every page reads from PostgreSQL (via `/api/v1/*`) |
| 10 | Deployed & working | App live on Vercel, database on Neon, no errors |

---

## 🎯 Key Implementation Notes

### Database Best Practices
- Always use parameterized queries (never string interpolation)
- Use transactions for multi-step operations (approval workflow)
- Lock rows (`FOR UPDATE`) in approval to prevent race conditions
- Never hardcode UUIDs; always retrieve via query

### Backend Patterns
```ts
// In route handler:
import { withRole } from "@/lib/server/auth/assertions";
export async function POST(request: Request) {
  const user = await resolveSession(request);
  withRole(user, ["teacher"]); // throws 403 if not teacher
  // Safe to proceed — authorization proven
}

// In repository:
const result = await withTransaction(pool, async (client) => {
  const repos = createRepositories(client);
  // All reads/writes use transaction client
  // Automatic rollback on error
});
```

### Frontend Patterns
```ts
// Replace mock data:
// ❌ BEFORE: import { courses } from "@/lib/data/academics";
// ✅ AFTER:
const courses = await listCourses();

// API errors:
try {
  await loginUser(email, password);
} catch (error) {
  if (error instanceof WorkspaceApiError) {
    if (error.code === "UNAUTHENTICATED") showLoginForm();
  }
}
```

### Test Scenarios

**Student Journey**
```
1. Sign up as new student (random email@test.com)
2. Login → see dashboard with empty progress
3. Browse courses → see "Data Structures" course
4. Click "Enroll" → enrollment persists
5. Click course → see topics in order
6. Click topic → progress updates to "In Progress"
7. Bookmark a resource → appears in /bookmarks
8. View resource → view count increments
9. Logout → session cleared
10. Login again → enrollment/progress still there
```

**Teacher Journey**
```
1. Login as teacher (sharif/teacher123)
2. Go to /contributor/submissions
3. Submit new resource (type="Study Material", topic="Arrays")
4. See submission in "My Submissions" with status="pending"
5. Logout, wait for admin approval...
6. Check /submissions again → status updates to "approved" (optional auto-refresh)
```

**Admin Journey**
```
1. Login as admin (nusrat/admin123)
2. Go to /admin/approvals
3. See pending submission from sharif
4. Click "Approve" → modal shows submission details
5. Click confirm → status changes to "approved"
6. Check /courses → see new content under Data Structures > Arrays
7. Logout and login as student → content now visible
```

---

## 🚀 Quick Start Commands

```bash
# Install dependencies (if not done)
npm install

# Check migrations
npm run db:status

# Seed demo data
npm run db:seed

# Run tests (if any)
npm test

# Build for production
npm run build

# Start production build locally
npm run start

# Development
npm run dev
```

---

## 📞 Status Checks (Daily)

Run these daily to verify progress:

```bash
# Build check
npm run build

# TypeScript check only
npx tsc --noEmit

# Lint check
npm run lint

# Database status
npm run db:status

# (Later) Test coverage
npm run test:coverage
```

---

## ⚠️ Common Gotchas

1. **Session expires?** Max 7 days, but check `auth_session.expires_at` in DB
2. **404 on API?** Verify route handler is properly wired (check `app/api/v1/*/route.ts`)
3. **"User not found"?** Check `app_user.role` matches expectations
4. **Submission won't approve?** Verify actor is admin, submission is pending, transaction commits
5. **Permissions broken?** Add logging in `requireRole()` to see which user/role failed
6. **Database connection fails?** Verify `DATABASE_URL` in `.env.local`, SSL settings correct

---

## 📊 Success Metrics (for your presentation)

By deadline, you should have:

| Metric | Target |
|--------|--------|
| Real database tables used | All 26 (or 20+) |
| Live queries in production | 15+ |
| Authenticated features | 8+ (auth, profile, enrollments, progress, bookmarks, submissions, approvals, activity) |
| Transactions in use | 3+ (approval workflow is one) |
| Constraint violations handled | Enrollment uniqueness, submission status, content publication |
| End-to-end flows working | 3 (student, teacher, admin) |
| Pages using real data | 10+ |
| API error codes defined | 8+ (from contract) |
| User roles enforced server-side | Yes (not just UI) |
| Deployed to production | Yes (Vercel + Neon) |

**This is a real DBMS project.** Show it off.

---

## 🎬 Next Immediate Action

**TODAY:**
1. Run `npm run db:seed` (populate demo data)
2. Verify `/api/v1/universities` returns live courses
3. Test login with real `app_user` rows
4. Report back: "Auth is working" / "Courses page loads live data" / "Approval workflow executes"

I'm here to implement each piece as we work through this list. Pick the area you want to tackle first:
- **A.** Auth backend (sign up/login/logout)
- **B.** Frontend API integration (replace mock data)
- **C.** Workflow APIs (enroll, progress, bookmarks)
- **D.** Submission → Approval transaction

**Which area should we start with?**
