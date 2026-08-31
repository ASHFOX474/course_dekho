import type { DatabaseExecutor } from "../executor.ts";
import type { AuthCredentialRow, AuthUserRow, InternalIdRow } from "../rows.ts";
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
    role AS user_role
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
    app_user.password_hash
  FROM coursedekho.app_user AS app_user
  WHERE app_user.is_active
    AND (
      lower(app_user.username) = $1
      OR lower(app_user.email) = $1
    )
    AND (
      (
        app_user.role = 'student'
        AND EXISTS (
          SELECT 1 FROM coursedekho.student_profile
          WHERE student_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'teacher'
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
    app_user.role AS user_role
  FROM coursedekho.auth_session AS auth_session
  JOIN coursedekho.app_user AS app_user
    ON app_user.id = auth_session.user_id
  WHERE auth_session.token_hash = $1
    AND auth_session.revoked_at IS NULL
    AND auth_session.expires_at > now()
    AND app_user.is_active
    AND (
      (
        app_user.role = 'student'
        AND EXISTS (
          SELECT 1 FROM coursedekho.student_profile
          WHERE student_profile.user_id = app_user.id
        )
      )
      OR (
        app_user.role = 'teacher'
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
