Workflow verification
=====================

Run `node scripts/db/verify-workflows.mjs` against the configured DATABASE_URL.
It needs approved learner, contributor and admin accounts, plus an active topic.
It uses existing application services and HTTP handlers with real PostgreSQL,
multipart file uploads and authenticated sessions.

All database writes run inside one outer transaction that is always rolled back.
Application transactions use savepoints within it. Temporary uploads are removed
afterward. Identity sequences may advance even though rows are rolled back.
No existing account credentials are read or changed.

Checks include submission permissions, pending/rejected visibility, admin review,
approval, exact PDF delivery, image upload, Drive-link metadata, bookmark ownership,
learning progress, revoked sessions and persistence through a fresh session.
The Drive link is a test value; no external Drive file is accessed.

Verified on 2026-09-15 against the configured database. This is a real database
integration check, not browser automation. Browser acceptance remains useful for
file-picker interaction, upload progress, PDF rendering and resubmission UX.

Rejected submissions can now be revised from My Submissions. Their details prefill
a new form; attach the corrected file or paste the link again. The original row
and rejection reason remain unchanged. The new submission requires admin approval.
