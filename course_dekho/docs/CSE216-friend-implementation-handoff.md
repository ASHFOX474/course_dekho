# CourseDekho: minimal implementation handoff

Prepared 25 September 2026. Forward this file with access to the current repository.

## Scope and relevance

Implement the three items below without redesigning the UI, APIs, or database model.

| Item | Why it is relevant | Minimum approach |
|---|---|---|
| Server authentication for private pages | The existing APIs validate sessions, but private pages currently rely on client-side AppShell redirects. The checklist asks for authentication before processing page requests. | Reuse existing authentication in a server helper; add thin server wrappers to private pages. |
| Computed SQL function | CourseDekho already calculates course progress. This is a natural example of the checklist's statistical/computed database function. | Extract the existing formula into one SQL function and call it from the existing learning query. |
| Stored procedure | Admin deactivation already modifies a user and their sessions. This naturally matches the checklist's multi-table procedure requirement. | Move those two writes into one procedure and call it from the existing deactivation service. |

The function and procedure are appropriate DBMS demonstration choices, but the application can implement the same behavior without them. Server page authentication has a direct access-control purpose. Custom authentication, triggers, and at least three complex queries already exist; do not add replacements.

**Transaction-expansion work is excluded at the project owner's request.** However, the supplied checklist explicitly requires explicit transaction control for every DML operation. Excluding that work leaves that checklist item unresolved unless the instructor waives it. Preserve the existing transactions, including the deactivation transaction used below.

These are implementation instructions and proposed snippets, not applied or runtime-tested changes. Follow the repository's AGENTS.md, inspect current Git changes first, and avoid overwriting other work. No additional dependencies or skills are needed for this handoff.

## 1. Server checks for protected pages

### Existing code to reuse

- `lib/server/auth/service.ts`: `AuthService.getSessionUser` checks the database session.
- `lib/server/auth/session.ts`: cookie name and token helpers.
- `lib/server/auth/runtime.ts`: already creates `authService`; change its declaration to `export const authService = ...` so the page guard can reuse it.
- `lib/server/auth/authorization.ts`: API role enforcement. Keep all API checks.
- `components/layout/AppShell.tsx`: current client-side navigation/role UI. Keep it.

### Add `lib/server/auth/page-guard.ts`

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { UnauthenticatedError } from '../api/errors';
import type { AuthenticatedUser, UserRole } from '../domain/models';
import { authService } from './runtime';
import { SESSION_COOKIE_NAME } from './session';

export async function requirePageUser(
  roles: readonly UserRole[] = ['learner', 'contributor', 'admin']
): Promise<AuthenticatedUser> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) redirect('/login');

  let actor: AuthenticatedUser;
  try {
    actor = await authService.getSessionUser(token);
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect('/login');
    throw error; // Do not disguise database failures as an invalid login.
  }

  if (!roles.includes(actor.role)) notFound();
  return actor;
}
```

Do not import this helper/runtime from a client component. Do not globally cache session validation across requests. The actor comes from the database session, not a client-supplied role.

### Wrap pages, leaving their UI intact

For example, rename `app/admin/user-approvals/page.tsx` to a sibling `page-client.tsx`. Keep its `"use client"` directive and existing contents. Add this new `page.tsx`:

```tsx
import { requirePageUser } from '@/lib/server/auth/page-guard';
import PageClient from './page-client';

export default async function Page() {
  await requirePageUser(['admin']);
  return <PageClient />;
}
```

Apply the same small wrapper pattern to **every private page**, not only this example. Retain/forward existing props where a page accepts them. Client pages using route hooks can keep those hooks.

| Routes | Server access |
|---|---|
| `/admin/**` | admin |
| `/contributor/**` | contributor |
| `/progress`, `/bookmarks`, `/access-history`, `/solved-questions` | learner or contributor, consistent with their backend endpoints |
| `/dashboard`, `/courses`, `/courses/[courseId]`, `/courses/[courseId]/topics/[topicId]`, `/resources/[resourceId]`, `/profile`, `/settings`, `/support` | signed-in users; preserve any narrower restrictions already enforced by each feature |

Keep login/registration, forgot-password, reset-password, and required signup lookup endpoints public. `/` is currently a public redirect screen and can remain so. `/support/request/[requestId]` supports guest recovery tokens: do not accidentally require a normal account session there. Preserve its existing token/ownership-checked API access; if moving thread data into server rendering, validate the recovery token server-side first. A token in the URL alone is not proof of authorization.

Document these intentional public entry points for the evaluator. The literal phrase “every page” needs that clarification because users must be able to reach login/recovery before authenticating.

Do not rely solely on a shared layout or cookie-presence check. Private API calls still need their existing per-request checks, including when reached without a page load.

**Impact:** no schema change, API response change, new authentication system, or redesigned screen. Most changed page files are mechanical moves plus short wrappers.

## 2. Extract course progress into a SQL function

Create a new forward-only migration, such as `database/migrations/0013_checklist_routines.sql` if `0013` is still unused. Do not edit previously applied migrations. Both routines in this handoff can share this migration.

```sql
-- course-dekho:migration 0013

CREATE FUNCTION coursedekho.calculate_course_progress(
    p_user_id BIGINT,
    p_course_id BIGINT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        round(
            sum(COALESCE(progress.progress_percent, 0))::numeric
            / NULLIF(count(topic.id), 0)
        ),
        0
    )::integer
    FROM coursedekho.topic AS topic
    LEFT JOIN coursedekho.topic_progress AS progress
      ON progress.topic_id = topic.id
     AND progress.user_id = p_user_id
    WHERE topic.course_id = p_course_id
      AND topic.is_active;
$$;
```

In `lib/server/db/queries/workspace-queries.ts`, update only `queryLearningCourses`:

1. Replace the current COALESCE/round/SUM/COUNT expression with:

   ```sql
   coursedekho.calculate_course_progress(
       enrollment.user_id, course.id
   ) AS progress_percent
   ```

2. Remove the now-unused LEFT JOINs to `topic` and `topic_progress` from this query.
3. Remove its GROUP BY; the outer query no longer aggregates.
4. Keep the enrollment/user/course/university/semester joins, all WHERE filters, ordering, selected field names, and parameter values unchanged.
5. Change the prepared statement name from `workspace-learning-courses-v1` to `workspace-learning-courses-v2`, because its SQL text changed.

The application already displays `progress_percent`; no frontend edit is required. Existing API authentication and actor-scoped queries remain responsible for visibility. This routine uses internal IDs only within server/database code.

**Expected behavior:** unstarted active topics contribute zero; archived topics are excluded; zero active topics returns zero; rounding matches the previous formula. For two active topics at 100 and 0, the result is 50.

**Database impact:** adds one read-only function over existing tables. No new table, stored progress total, data backfill, or destructive operation.

## 3. Use a procedure for admin deactivation

Keep this workflow small. Do not move the much larger content-approval implementation into a procedure merely to satisfy the checklist.

### Add this procedure to the new migration

```sql
CREATE PROCEDURE coursedekho.deactivate_user_and_revoke_sessions(
    IN p_actor_public_id UUID,
    IN p_target_public_id UUID,
    IN p_at TIMESTAMPTZ,
    INOUT p_changed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_id BIGINT;
BEGIN
    p_changed := FALSE;

    IF NOT EXISTS (
        SELECT 1 FROM coursedekho.app_user
        WHERE public_id = p_actor_public_id
          AND role = 'admin'
          AND is_active
          AND registration_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'An active approved admin is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_actor_public_id = p_target_public_id THEN
        RAISE EXCEPTION 'Self-deactivation is not allowed'
            USING ERRCODE = '42501';
    END IF;

    UPDATE coursedekho.app_user
    SET is_active = FALSE, deactivated_at = p_at
    WHERE public_id = p_target_public_id AND is_active
    RETURNING id INTO v_target_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE coursedekho.auth_session
    SET revoked_at = GREATEST(p_at, created_at)
    WHERE user_id = v_target_id AND revoked_at IS NULL;

    p_changed := TRUE;
END;
$$;
```

This updates two existing tables and preserves soft deletion. `GREATEST` respects the session constraint that revocation cannot precede creation. Existing revoked sessions stay unchanged. The SQL routine remains SECURITY INVOKER by default; do not introduce elevated database privileges.

The routine's actor check is defense in depth, not authentication: UUIDs are not credentials. Only the server's authenticated actor may supply `p_actor_public_id`. Keep the route/service admin guard and self-deactivation check.

### Wire it into the existing layers

In `lib/server/db/queries/auth-queries.ts`, change `queryDeactivateUser` to call the procedure:

```ts
export async function queryDeactivateUser(
  executor: DatabaseExecutor,
  userPublicId: string,
  deactivatedAt: Date,
  actorPublicId: string
): Promise<boolean> {
  const result = await executor.query<{ p_changed: boolean }>({
    text: `CALL coursedekho.deactivate_user_and_revoke_sessions(
      $1::uuid, $2::uuid, $3::timestamptz, $4::boolean
    )`,
    values: [actorPublicId, userPublicId, deactivatedAt, false],
  });
  return result.rows[0]?.p_changed === true;
}
```

Then make these small wiring changes:

1. In `lib/server/repositories/auth-repository.ts`, add `actorPublicId: string` as the third parameter of `AuthRepository.deactivateUser` and its class implementation. Pass it through to `queryDeactivateUser` as the fourth argument.
2. In `AuthService.deactivateUser` in `lib/server/auth/service.ts`, retain `requireRole`, the self-deactivation check, and the existing `withTransaction` block.
3. Inside that block, pass `actor.id` to `transactionRepository.deactivateUser(userPublicId, deactivatedAt, actor.id)`.
4. Retain the existing `InvalidTransitionError` when the result is false.
5. Remove the separate `revokeAllSessionsForUser` call from **this service method**, since the procedure now performs it. Do not remove other session-revocation paths.
6. Remove the old `deactivateUserSql` constant if unused. Other cleanup is optional; keep the change focused.
7. Update repository test doubles and deactivation tests for the additional argument and combined operation. Translate the procedure's `42501` denial into the existing `ForbiddenError` at the query/repository boundary if it can reach the API; do not expose raw database errors or silently treat denials as success.

Keep CALL inside the existing transaction client. The procedure contains no COMMIT/ROLLBACK statements; transaction ownership stays with the current application wrapper. This preserves existing behavior and is not the broader transaction-expansion task excluded above.

**Database impact:** adds one procedure modifying `app_user` and `auth_session`. No new tables, changed relationships, deleted accounts, or content-workflow changes. Existing UI and HTTP contracts remain unchanged.

## Implementation order and acceptance checks

1. Inspect Git status and current migrations; coordinate with existing uncommitted work.
2. Add the function/procedure migration and update the corresponding query/service wiring. Apply to a development database before running application code that calls the routines. Deploy migration before dependent application code.
3. Add the page helper and private-page wrappers, retaining public recovery routes.
4. Add focused behavior tests and run the checks below.

```text
npm run db:status
npm run db:migrate
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
```

Run database commands only against the intended development database. Do not delete/recreate the database or reapply seeds as part of this task. Forward-fix a migration defect with a new migration after it has been applied.

Acceptance list:

- [ ] Private-page requests with missing, forged, expired, or revoked sessions cannot access the page. Valid sessions still work. Learners cannot access admin pages or admin APIs.
- [ ] Login, signup, recovery/reset, and token-protected support conversations remain usable.
- [ ] Progress returns 0 for no topics/unstarted topics, 50 for two active topics at 100 and 0, and 100 for fully completed topics. Archived topics and other users' progress do not distort the result.
- [ ] Existing progress screens receive the same response fields and values after extraction.
- [ ] Admin deactivation updates the user and revokes unrevoked sessions. Non-admin and self-deactivation are denied; already-inactive behavior is preserved.
- [ ] An induced failure during session revocation rolls back deactivation in an isolated test database. No partial state remains.
- [ ] Existing student browsing/bookmarks/progress, contributor submission/review status, and admin content approval still work.
- [ ] Demonstrate the function from the progress screen and the procedure from admin user management; neither routine is merely unused migration code.

The earlier audit's `npm test` attempt could not launch test processes because of `spawn EPERM`; no passing-test claim is made for these snippets. Verify them in the implementer's environment. Code changes have not been applied by this handoff.

For evaluation, also prepare to explain the existing triggers, three complex queries, and authentication flow. Those checklist items need demonstration and understanding, not additional features.
