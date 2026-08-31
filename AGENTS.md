# CourseDekho Engineering Guide

## Project Identity

CourseDekho is a DBMS-focused academic resource management platform.

The core structure:

University → Semester → Course → Topic → Content
User → Student / Teacher / Admin
Teacher → Submission → Admin → Approved Content

The goal is not only storing PDFs/resources. The platform organizes learning paths and connects students with structured course content.

---

# Current Technical State

Current stack:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- PostgreSQL (planned real integration)
- SQL schema already designed

Current prototype limitations:

- Some pages use mock data.
- Authentication is currently prototype-level.
- Some state is stored in React contexts.
- Database integration is incomplete.

Do not assume mock data represents the final architecture.

Before replacing mock data, understand:

- existing UI flow
- existing types
- existing contexts
- database schema
- API requirements

---

# Core Business Model

## User Roles

There are three roles:

- student
- teacher
- admin

Never break these permission boundaries.

---

# Student Rules

Students are learners.

Students can:

- register/login
- browse universities
- browse courses
- view topics
- access approved content
- bookmark content
- track progress
- solve questions
- view learning history

Students cannot:

- create courses
- create topics
- upload resources
- publish content
- approve submissions
- modify official structure
- manage users

---

# Teacher Rules

Teachers are contributors.

Teachers can:

- do everything students can do
- submit educational content

Supported submissions include:

- study materials
- practice materials
- books
- tutorials
- slides
- questions
- LeetCode problems

Important:

Teacher submission ≠ published content.

Workflow:

Teacher\
↓\
Submission\
↓\
Pending\
↓\
Admin Review\
↓\
Approved / Rejected

Teachers cannot:

- create courses
- create universities
- create semesters
- directly publish resources
- approve their own submissions
- bypass approval workflow
- manage users

Any modification to approved content requires a new approval process.

---

# Admin Rules

Admins control the platform.

Admins can:

- manage users
- manage universities
- manage semesters
- create courses
- manage topics
- manage resources
- approve submissions
- reject submissions
- modify/delete platform content

Admin controls the official learning roadmap.

Example:

Course:\
Data Structures

Topics:

1. Array
2. Linked List
3. Stack
4. Queue
5. Tree
6. Graph
7. Dynamic Programming

Topic order must remain database-driven.

---

# Development Workflow

Before changing code:

1. Inspect existing implementation.
2. Understand data flow.
3. Identify affected files.
4. Explain the proposed architecture.
5. Explain database impact.
6. Explain security implications.
7. Explain testing strategy.
8. Only then modify code.

Do not immediately write code for feature requests.

---

# Database Rules

Database correctness is critical.

Before modifying:

- tables
- relationships
- constraints
- migrations
- seed data

Explain:

- why the change is needed
- affected tables
- possible data integrity issues
- migration strategy

Never casually delete or recreate production-like data.

---

# Backend Rules

When implementing backend:

Prioritize:

- real authentication
- server-side authorization
- database transactions
- validation
- error handling

Frontend role checks are not security.

The backend must enforce:

student permissions\
teacher permissions\
admin permissions

---

# Content Approval Rules

Never expose unapproved teacher submissions.

Content lifecycle:

Submission\
→ Pending\
→ Approved\
→ Published

Rejected submissions must preserve rejection reasons.

---

# Code Change Rules

When editing:

- make minimal focused changes
- preserve existing architecture
- avoid unnecessary rewrites
- do not remove working features
- explain every major modification

Do not modify unrelated files.

---

# Git Rules

Before major changes:

- check git status
- avoid overwriting existing work
- do not create commits automatically
- do not modify git history

---

# Files and Dependencies

Never manually edit:

- node\_modules
- .next
- generated files

Do not add dependencies without explaining:

- why current dependencies are insufficient
- alternative solutions
- impact

---

# Verification

After changes, run relevant checks.

Default:

npm run lint

npx tsc --noEmit --incremental false

npm run build

For role-related changes manually verify:

Student flow:

- browsing
- bookmarks
- progress

Teacher flow:

- submission
- rejection
- approval status

Admin flow:

- approval queue
- content management

---

# Long-Term Goal

Transform the current frontend prototype into a complete DBMS application:

Frontend\
+\
Backend APIs\
+\
PostgreSQL\
+\
Authentication\
+\
Role-based authorization\
+\
Real CRUD operations\
+\
Approval workflow\
+\
Progress tracking\
+\
Bookmark system

The final application should demonstrate:

- strong database design
- meaningful SQL usage
- role-based access control
- transaction handling
- real application workflow
