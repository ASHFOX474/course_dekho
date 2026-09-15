# TODAY'S CHECKLIST - Get from 0 to Hero

## ✅ Phase 0: Verify Current State (30 min)

### Step 1: Seed Demo Data
```bash
npm run db:seed
```
This populates:
- 5 universities
- 3 sample courses
- Demo accounts: `rafiul` (student), `sharif` (teacher), `nusrat` (admin)

**Verify in Neon console:**
```sql
SELECT count(*) FROM coursedekho.app_user;  -- Should be 3+
SELECT count(*) FROM coursedekho.university;  -- Should be 5+
SELECT count(*) FROM coursedekho.course;  -- Should be 3+
```

### Step 2: Start Dev Server
```bash
npm run dev
```
Should show: `ready on http://localhost:3000`

### Step 3: Test Sign-In
Visit `http://localhost:3000` → Try logging in:
- Email: `rafiul@example.com`
- Password: `student123`

**Status Check:**
- [ ] Page redirects to `/dashboard` (not stay on login)
- [ ] See "Hello, Rafiul" in top-right
- [ ] Sidebar shows student navigation

---

## 🔴 Critical Issues (Check These First)

### Issue 1: Login doesn't work
**Symptoms:** "Invalid credentials" or database error
**Fix:** 
```bash
# Check if users were created:
npm run db:status
# Run seed again
npm run db:seed
```

### Issue 2: "Cannot connect to database"
**Symptoms:** "DATABASE_URL is not configured" or timeout
**Fix:**
```bash
# Verify .env.local exists:
cat .env.local
# Should show: DATABASE_URL=postgresql://...
```

### Issue 3: Build fails
**Symptoms:** TypeScript errors or "Cannot find module"
**Fix:**
```bash
npm install
npm run build
```

---

## 🎯 YOUR DECISION (Pick ONE path below)

### PATH A: Fix Authentication Backend 
**Time: 3-4 hours**
**Outcome:** Real login/signup against Neon (no hardcoded credentials)

Do this if:
- ✅ Demo login works but you want real registration
- ✅ You want to show "users stored in database" during demo
- ✅ You're comfortable with SQL and transactions

**I will implement:**
1. `POST /api/v1/auth/register` writes to `app_user` + profile table
2. `POST /api/v1/auth/login` verifies scrypt hash from `app_user`
3. `POST /api/v1/auth/logout` revokes session
4. Frontend forms connected to these APIs

---

### PATH B: Replace Mock Data with Real API Calls
**Time: 4-5 hours**
**Outcome:** All pages show live Neon data (universities, courses, topics, resources)

Do this if:
- ✅ Auth already works (login shows real user from DB)
- ✅ You want quick visual proof of database integration
- ✅ You want all catalog pages reading from PostgreSQL

**I will implement:**
1. Replace `lib/data/academics.ts` mock imports with `/api/v1/*` calls
2. Update `app/courses/page.tsx` to fetch real courses
3. Update `app/courses/[courseId]/page.tsx` to fetch real topics
4. Verify all pages render live data on load/refresh

---

### PATH C: Complete the Approval Workflow
**Time: 5-6 hours**
**Outcome:** Teacher submits → Admin approves → Student sees content (end-to-end)

Do this if:
- ✅ You want to show the "real DBMS workflow" at demo time
- ✅ You understand transactions and role-based access
- ✅ You have PATH A + B working first

**I will implement:**
1. Verify `POST /api/v1/submissions` creates pending submissions
2. Implement `POST /api/v1/admin/submissions/:id/approve` with transaction:
   - Lock submission
   - Insert into `content`, `content_revision`
   - Publish and commit
3. Wire `/admin/approvals` UI to real approval endpoint
4. Test: Teacher submits → Admin approves → Student sees content

---

## 📝 What We'll Show at Demo Time

Once we complete Paths A + B + C:

**Student View:**
1. Login as Rafiul
2. See courses (live from DB)
3. See topics with order (live from DB)
4. Click topic → see resources from approved submissions (live DB)
5. Enroll → data persists → refresh → still enrolled
6. Bookmark resource → appears on /bookmarks page

**Teacher View:**
1. Login as Sharif
2. Go to /contributor/submissions
3. Submit new resource (title, description, course, topic)
4. See submission with status="pending"

**Admin View:**
1. Login as Nusrat
2. Go to /admin/approvals
3. See pending submission from Sharif
4. Click "Approve" → Single database transaction:
   - content row created
   - content_revision row created
   - submission status → "approved"
   - content is_active → true
5. Logout, login as Rafiul → New content appears in course

**Reporter's Quote:**
> "The application demonstrates a complete DBMS workflow: authentication (scrypt-hashed passwords in PostgreSQL), role-based access control (student/teacher/admin enforced server-side), a transactional approval workflow (teacher → pending submission → atomic approval → published content), and real-time data persistence. All data lives in PostgreSQL. No mock data."

---

## 🚀 Let's Go

**Reply with:**
```
PATH: A | B | C (or multiple: A,B or A,B,C)
DEADLINE: Day X of 10
CURRENT BLOCKERS: (list any errors you see)
```

**I'll:**
1. Implement the selected paths
2. Provide step-by-step instructions
3. Verify each piece works
4. Have you ready for demo in 1.5 weeks

---

## 📞 Questions?

- **"Will this break existing code?"** No — I'll extend, not delete. Old mock data routes stay.
- **"How do we deploy?"** Vercel + Neon (same setup, just `git push`).
- **"What about file uploads?"** Out of scope for this sprint — metadata is there, we skip binary delivery.
- **"How do we test?"** Manual testing via browser + SQL spot-checks in Neon console.

---

**STATUS: READY TO BUILD**

Your database is live. Your schema is reconciled. Your frontend is beautiful.
Let's make it a **real DBMS application.**

Which path? ➡️
