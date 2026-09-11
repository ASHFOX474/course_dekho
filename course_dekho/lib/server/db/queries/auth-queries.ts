import type { DatabaseExecutor } from "../executor.ts";
import type { AuthCredentialRow, AuthUserRow, DirectoryUserRow, InternalIdRow, PendingUserRow } from "../rows.ts";
import type { UserRole } from "../../domain/models.ts";

const findActiveUniversityInternalIdSql = `
  SELECT university.id::text AS internal_id
  FROM coursedekho.university AS university
  WHERE university.public_id = $1::uuid
    AND university.is_active
  LIMIT 1
`;

const createUserSql = `
  INSERT INTO coursedekho.app_user (name, email, username, password_hash, role)
  VALUES ($1, $2, $3, $4, $5::coursedekho.user_role)
  RETURNING
    id::text AS user_internal_id,
    public_id::text AS user_public_id,
    name AS user_name,
    email AS user_email,
    username AS user_username,
    role AS user_role,
    registration_status
`;

const createStudentProfileSql = `
  INSERT INTO coursedekho.student_profile (
    user_id,
    university_id,
    department,
    year_of_study
  )
  VALUES ($1::bigint, $2::bigint, $3, $4)
`;

const createTeacherProfileSql = `
  INSERT INTO coursedekho.teacher_profile (
    user_id,
    university_id,
    department,
    designation
  )
  VALUES ($1::bigint, $2::bigint, $3, $4)
`;

const createSessionSql = `
  INSERT INTO coursedekho.auth_session (
    user_id,
    token_hash,
    created_at,
    last_seen_at,
    expires_at
  )
  VALUES ($1::bigint, $2, $3, $3, $4)
`;

const findCredentialsSql = `
  SELECT
    app_user.id::text AS user_internal_id,
    app_user.public_id::text AS user_public_id,
    app_user.name AS user_name,
    app_user.email AS user_email,
    app_user.username AS user_username,
    app_user.role AS user_role,
    app_user.registration_status,
    app_user.rejection_reason,
    app_user.password_hash
  FROM coursedekho.app_user AS app_user
  WHERE app_user.is_active
    AND (
      lower(app_user.username) = $1
      OR lower(app_user.email) = $1
    )
    AND (
      (
        app_user.role = 'learner'
        AND EXISTS (
          SELECT 1 FROM coursedekho.student_profile
          WHERE student_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'contributor'
        AND EXISTS (
          SELECT 1 FROM coursedekho.teacher_profile
          WHERE teacher_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM coursedekho.admin_profile
          WHERE admin_profile.user_id = app_user.id
        )
      )
    )
  LIMIT 1
`;

const findUserBySessionHashSql = `
  SELECT
    app_user.id::text AS user_internal_id,
    app_user.public_id::text AS user_public_id,
    app_user.name AS user_name,
    app_user.email AS user_email,
    app_user.username AS user_username,
    app_user.role AS user_role,
    app_user.registration_status
  FROM coursedekho.auth_session AS auth_session
  JOIN coursedekho.app_user AS app_user
    ON app_user.id = auth_session.user_id
  WHERE auth_session.token_hash = $1
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND app_user.registration_status = 'approved'
    AND app_user.is_active
    AND (
      (
        app_user.role = 'learner'
        AND EXISTS (
          SELECT 1 FROM coursedekho.student_profile
          WHERE student_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'contributor'
        AND EXISTS (
          SELECT 1 FROM coursedekho.teacher_profile
          WHERE teacher_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'admin'
        AND EXISTS (
          SELECT 1 FROM coursedekho.admin_profile
          WHERE admin_profile.user_id = app_user.id
        )
      )
    )
  LIMIT 1
`;

const revokeSessionSql = `
  UPDATE coursedekho.auth_session
  SET revoked_at = COALESCE(revoked_at, $2)
  WHERE token_hash = $1
`;

export async function queryActiveUniversityInternalId(
  executor: DatabaseExecutor,
  universityPublicId: string
): Promise<string | null> {
  const result = await executor.query<InternalIdRow, [string]>({
    name: "auth-find-active-university-v1",
    text: findActiveUniversityInternalIdSql,
    values: [universityPublicId],
  });
  return result.rows[0]?.internal_id ?? null;
}

export async function queryCreateUser(
  executor: DatabaseExecutor,
  input: {
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: UserRole;
  }
): Promise<AuthUserRow> {
  const result = await executor.query<
    AuthUserRow,
    [string, string, string, string, UserRole]
  >({
    name: "auth-create-user-v1",
    text: createUserSql,
    values: [input.name, input.email, input.username, input.passwordHash, input.role],
  });
  return result.rows[0];
}

export async function queryCreateStudentProfile(
  executor: DatabaseExecutor,
  input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    yearOfStudy?: number;
  }
): Promise<void> {
  await executor.query({
    name: "auth-create-student-profile-v1",
    text: createStudentProfileSql,
    values: [
      input.userInternalId,
      input.universityInternalId,
      input.department ?? null,
      input.yearOfStudy ?? null,
    ],
  });
}

export async function queryCreateTeacherProfile(
  executor: DatabaseExecutor,
  input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    designation?: string;
  }
): Promise<void> {
  await executor.query({
    name: "auth-create-teacher-profile-v1",
    text: createTeacherProfileSql,
    values: [
      input.userInternalId,
      input.universityInternalId,
      input.department ?? null,
      input.designation ?? null,
    ],
  });
}

export async function queryCreateSession(
  executor: DatabaseExecutor,
  input: {
    userInternalId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }
): Promise<void> {
  await executor.query({
    name: "auth-create-session-v1",
    text: createSessionSql,
    values: [input.userInternalId, input.tokenHash, input.createdAt, input.expiresAt],
  });
}

export async function queryCredentials(
  executor: DatabaseExecutor,
  normalizedIdentifier: string
): Promise<AuthCredentialRow | null> {
  const result = await executor.query<AuthCredentialRow, [string]>({
    name: "auth-find-credentials-v1",
    text: findCredentialsSql,
    values: [normalizedIdentifier],
  });
  return result.rows[0] ?? null;
}

export async function queryUserBySessionHash(
  executor: DatabaseExecutor,
  tokenHash: string
): Promise<AuthUserRow | null> {
  const result = await executor.query<AuthUserRow, [string]>({
    name: "auth-find-user-by-session-v1",
    text: findUserBySessionHashSql,
    values: [tokenHash],
  });
  return result.rows[0] ?? null;
}

export async function queryRevokeSession(
  executor: DatabaseExecutor,
  tokenHash: string,
  revokedAt: Date
): Promise<void> {
  await executor.query({
    name: "auth-revoke-session-v1",
    text: revokeSessionSql,
    values: [tokenHash, revokedAt],
  });
}

// --- Admin review of self-registered (learner/contributor) accounts ---
// Deliberately excludes 'admin' rows: admins are never self-registered, so they
// never appear in this queue.

const listPendingUsersSql = `
  SELECT
    app_user.public_id::text AS user_public_id,
    app_user.name AS user_name,
    app_user.email AS user_email,
    app_user.username AS user_username,
    app_user.role AS user_role,
    university.name AS university_name,
    app_user.created_at
  FROM coursedekho.app_user AS app_user
  LEFT JOIN coursedekho.student_profile AS student ON student.user_id = app_user.id
  LEFT JOIN coursedekho.teacher_profile AS teacher ON teacher.user_id = app_user.id
  LEFT JOIN coursedekho.university AS university
    ON university.id = COALESCE(student.university_id, teacher.university_id)
  WHERE app_user.registration_status = 'pending'
    AND app_user.role IN ('learner', 'contributor')
  ORDER BY app_user.created_at ASC, app_user.id ASC
`;

const approveUserSql = `
  UPDATE coursedekho.app_user
  SET registration_status = 'approved',
      reviewed_by_user_id = (SELECT id FROM coursedekho.app_user WHERE public_id = $2::uuid),
      reviewed_at = $3
  WHERE public_id = $1::uuid
    AND registration_status = 'pending'
  RETURNING public_id::text AS user_public_id
`;

const rejectUserSql = `
  UPDATE coursedekho.app_user
  SET registration_status = 'rejected',
      reviewed_by_user_id = (SELECT id FROM coursedekho.app_user WHERE public_id = $2::uuid),
      reviewed_at = $3,
      rejection_reason = $4
  WHERE public_id = $1::uuid
    AND registration_status = 'pending'
  RETURNING public_id::text AS user_public_id
`;

export async function queryListPendingUsers(
  executor: DatabaseExecutor
): Promise<PendingUserRow[]> {
  const result = await executor.query<PendingUserRow>({
    name: "auth-list-pending-users-v1",
    text: listPendingUsersSql,
    values: [],
  });
  return result.rows;
}

export async function queryApproveUser(
  executor: DatabaseExecutor,
  userPublicId: string,
  reviewerPublicId: string,
  reviewedAt: Date
): Promise<boolean> {
  const result = await executor.query<{ user_public_id: string }, [string, string, Date]>({
    name: "auth-approve-user-v1",
    text: approveUserSql,
    values: [userPublicId, reviewerPublicId, reviewedAt],
  });
  return result.rowCount === 1;
}

export async function queryRejectUser(
  executor: DatabaseExecutor,
  userPublicId: string,
  reviewerPublicId: string,
  reviewedAt: Date,
  reason: string
): Promise<boolean> {
  const result = await executor.query<
    { user_public_id: string },
    [string, string, Date, string]
  >({
    name: "auth-reject-user-v1",
    text: rejectUserSql,
    values: [userPublicId, reviewerPublicId, reviewedAt, reason],
  });
  return result.rowCount === 1;
}

// --- Admin user directory: every account, any role, any review state ---

const listAllUsersSql = `
  SELECT
    app_user.public_id::text AS user_public_id,
    app_user.name AS user_name,
    app_user.email AS user_email,
    app_user.username AS user_username,
    app_user.role AS user_role,
    app_user.registration_status,
    app_user.is_active,
    university.name AS university_name,
    app_user.created_at
  FROM coursedekho.app_user AS app_user
  LEFT JOIN coursedekho.student_profile AS student ON student.user_id = app_user.id
  LEFT JOIN coursedekho.teacher_profile AS teacher ON teacher.user_id = app_user.id
  LEFT JOIN coursedekho.university AS university
    ON university.id = COALESCE(student.university_id, teacher.university_id)
  ORDER BY app_user.created_at DESC, app_user.id DESC
`;

const deactivateUserSql = `
  UPDATE coursedekho.app_user
  SET is_active = FALSE,
      deactivated_at = $2
  WHERE public_id = $1::uuid
    AND is_active
  RETURNING public_id::text AS user_public_id
`;

export async function queryListAllUsers(
  executor: DatabaseExecutor
): Promise<DirectoryUserRow[]> {
  const result = await executor.query<DirectoryUserRow>({
    name: "auth-list-all-users-v1",
    text: listAllUsersSql,
    values: [],
  });
  return result.rows;
}

export async function queryDeactivateUser(
  executor: DatabaseExecutor,
  userPublicId: string,
  deactivatedAt: Date
): Promise<boolean> {
  const result = await executor.query<{ user_public_id: string }, [string, Date]>({
    name: "auth-deactivate-user-v1",
    text: deactivateUserSql,
    values: [userPublicId, deactivatedAt],
  });
  return result.rowCount === 1;
}

const revokeAllSessionsForUserSql = `
  UPDATE coursedekho.auth_session
  SET revoked_at = $2
  WHERE user_id = (SELECT id FROM coursedekho.app_user WHERE public_id = $1::uuid)
    AND revoked_at IS NULL
`;

export async function queryRevokeAllSessionsForUser(
  executor: DatabaseExecutor,
  userPublicId: string,
  revokedAt: Date
): Promise<void> {
  await executor.query({
    name: "auth-revoke-all-sessions-for-user-v1",
    text: revokeAllSessionsForUserSql,
    values: [userPublicId, revokedAt],
  });
}
