# Admin academic management

Open **Academic management** in the admin sidebar (`/admin/courses`).

1. Use **Universities** to create a university with its name and short name.
2. Select **Manage semesters** to add semesters to that university.
3. Select **Manage courses** (or select a university and semester in the Courses tab), then **New course** to enter its code/number, name, and optional description. Save without topics or resources if you prefer.
4. Select **Manage topics** on a course to build its roadmap. Topics need a name and optional description. There is no fixed topic count.
5. Select **Manage subtopics** on a topic to add its ordered subtopics by name. Subtopics are optional.
6. Add content whenever you choose using **Add resource link** on a topic or the existing submission workflow. Saving a course, topic, or subtopic never requires resources.

Use the up/down arrows to order semesters, topics, or subtopics. Changes persist in PostgreSQL and appear in the learner catalog. Ordering includes reserved positions for archived items, so visible position numbers can have gaps.

All five levels support editing, archiving, and restoring. **Show archived** reveals archived items. Archiving a parent hides its branch from the learning catalog without deleting children, resources, enrollments, bookmarks, or progress. Restore parents before restoring children. A child archived separately remains archived when its parent is restored.

Editing preserves UUIDs, slugs, and parent relationships. University short names and course codes remain unique under the existing database constraints, including archived records. No schema migration or seed changes are required.

## API and security

`GET /api/v1/admin/academics` returns the complete administrative hierarchy, including archive state and effective parent visibility. `POST` accepts validated `create`, `edit`, `archive`, `restore`, and `move` operations. Both require an authenticated admin; writes also verify the request origin. IDs are public UUIDs and database values are parameterized.

Writes use the existing transaction helper and a transaction-scoped advisory lock to serialize changes through this endpoint. Reordering temporarily reserves a free positive sequence position before swapping two siblings; any error rolls back the entire operation. Parent visibility and ownership are resolved on the server. No hard delete is exposed.

## Verification

- `npm test`: authorization, validation, ordering rollback, archive semantics, and existing regression tests.
- `node scripts/db/verify-academics.mjs`: exercises real PostgreSQL creates/edits, semester/topic/subtopic ordering, uniqueness, archive/restore, and learner catalog visibility. All verification records are created inside an outer transaction and unconditionally rolled back. Identity sequence counters may advance.
- `npm run lint -- --ignore-pattern '.data/**'`: excludes generated local uploads/browser profiles from source linting.
- `npx tsc --noEmit --incremental false`
- `npm run build`

`node scripts/ui/verify-workspaces.mjs` runs headless browser checks using intercepted API fixtures, without database writes. It defaults to `http://localhost:3002`; set `COURSEDEKHO_UI_ORIGIN` to use another local development port. It verifies empty course creation, topic edit/order/archive/restore, subtopic creation/edit/order/archive/restore, desktop/mobile layouts, and existing role workspaces. Screenshots are saved under `.data/ui-check`.

Manual check: sign in as an admin, create a hierarchy, reorder topics, edit names, archive and restore a parent, and confirm the learner catalog follows the saved order and visibility. Learner/contributor accounts must receive 403 from the management API and cannot enter the admin page.
