import {
  queryActiveUniversityInternalId,
  queryApproveUser,
  queryCreateSession,
  queryCreateStudentProfile,
  queryCreateTeacherProfile,
  queryCreateUser,
  queryCredentials,
  queryDeactivateUser,
  queryListAllUsers,
  queryListPendingUsers,
  queryRejectUser,
  queryRevokeAllSessionsForUser,
  queryRevokeSession,
  queryUserBySessionHash,
} from "../db/queries/auth-queries.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import type { AuthUserRow } from "../db/rows.ts";
import type { AuthenticatedUser, DirectoryUser, PendingUser, RegistrationStatus, UserRole } from "../domain/models.ts";
import { ConflictError } from "../api/errors.ts";

export interface InternalUserRecord {
  internalId: string;
  registrationStatus: RegistrationStatus;
  user: AuthenticatedUser;
}

export interface CredentialRecord extends InternalUserRecord {
  passwordHash: string;
  rejectionReason: string | null;
}

export interface AuthRepository {
  findActiveUniversityInternalId(publicId: string): Promise<string | null>;
  createUser(input: {
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<InternalUserRecord>;
  createStudentProfile(input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    yearOfStudy?: number;
  }): Promise<void>;
  createTeacherProfile(input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    designation?: string;
  }): Promise<void>;
  createSession(input: {
    expectedPasswordHash?: string;
    userInternalId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findCredentials(normalizedIdentifier: string): Promise<CredentialRecord | null>;
  findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUser | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;

  // Admin review of self-registered (learner/contributor) accounts.
  listPendingUsers(): Promise<PendingUser[]>;
  approveUser(userPublicId: string, reviewerPublicId: string, reviewedAt: Date): Promise<boolean>;
  rejectUser(
    userPublicId: string,
    reviewerPublicId: string,
    reviewedAt: Date,
    reason: string
  ): Promise<boolean>;

  // Admin user directory: everyone regardless of role or review state, plus
  // the ability to deactivate (never hard-delete) an account.
  listAllUsers(): Promise<DirectoryUser[]>;
  deactivateUser(userPublicId: string, deactivatedAt: Date): Promise<boolean>;
  revokeAllSessionsForUser(userPublicId: string, revokedAt: Date): Promise<void>;
}

// pg unique-violation (23505) on the case-insensitive email/username indexes.
// Surfaced as a plain ConflictError otherwise, which is technically correct
// but not actionable -- this turns it into a field-specific message the
// sign-up form can show under the right input.
function translateDuplicateAccountError(error: unknown): unknown {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505" &&
    "constraint" in error
  ) {
    const constraint = (error as { constraint?: unknown }).constraint;
    if (constraint === "uq_app_user_email_ci") {
      return new ConflictError("This email is already registered.", {
        email: ["This email is already registered."],
      });
    }
    if (constraint === "uq_app_user_username_ci") {
      return new ConflictError("This username is already taken.", {
        username: ["This username is already taken."],
      });
    }
  }
  return error;
}

function userRowToRecord(row: AuthUserRow): InternalUserRecord {
  return {
    internalId: row.user_internal_id,
    registrationStatus: row.registration_status,
    user: {
      id: row.user_public_id,
      name: row.user_name,
      username: row.user_username,
      email: row.user_email,
      role: row.user_role,
    },
  };
}

export class PostgresAuthRepository implements AuthRepository {
  private readonly executor: DatabaseExecutor;

  constructor(executor: DatabaseExecutor) {
    this.executor = executor;
  }

  findActiveUniversityInternalId(publicId: string): Promise<string | null> {
    return queryActiveUniversityInternalId(this.executor, publicId);
  }

  async createUser(input: {
    name: string;
    email: string;
    username: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<InternalUserRecord> {
    try {
      return userRowToRecord(await queryCreateUser(this.executor, input));
    } catch (error) {
      throw translateDuplicateAccountError(error);
    }
  }

  createStudentProfile(input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    yearOfStudy?: number;
  }): Promise<void> {
    return queryCreateStudentProfile(this.executor, input);
  }

  createTeacherProfile(input: {
    userInternalId: string;
    universityInternalId: string;
    department?: string;
    designation?: string;
  }): Promise<void> {
    return queryCreateTeacherProfile(this.executor, input);
  }

  createSession(input: {
    userInternalId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    return queryCreateSession(this.executor, input);
  }

  async findCredentials(normalizedIdentifier: string): Promise<CredentialRecord | null> {
    const row = await queryCredentials(this.executor, normalizedIdentifier);
    if (!row) return null;
    return {
      ...userRowToRecord(row),
      passwordHash: row.password_hash,
      rejectionReason: row.rejection_reason,
    };
  }

  async findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUser | null> {
    const row = await queryUserBySessionHash(this.executor, tokenHash);
    return row ? userRowToRecord(row).user : null;
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    return queryRevokeSession(this.executor, tokenHash, revokedAt);
  }

  async listPendingUsers(): Promise<PendingUser[]> {
    const rows = await queryListPendingUsers(this.executor);
    return rows.map((row) => ({
      id: row.user_public_id,
      name: row.user_name,
      email: row.user_email,
      username: row.user_username,
      role: row.user_role,
      universityName: row.university_name,
      registeredAt: row.created_at,
    }));
  }

  approveUser(userPublicId: string, reviewerPublicId: string, reviewedAt: Date): Promise<boolean> {
    return queryApproveUser(this.executor, userPublicId, reviewerPublicId, reviewedAt);
  }

  rejectUser(
    userPublicId: string,
    reviewerPublicId: string,
    reviewedAt: Date,
    reason: string
  ): Promise<boolean> {
    return queryRejectUser(this.executor, userPublicId, reviewerPublicId, reviewedAt, reason);
  }

  async listAllUsers(): Promise<DirectoryUser[]> {
    const rows = await queryListAllUsers(this.executor);
    return rows.map((row) => ({
      id: row.user_public_id,
      name: row.user_name,
      email: row.user_email,
      username: row.user_username,
      role: row.user_role,
      registrationStatus: row.registration_status,
      isActive: row.is_active,
      universityName: row.university_name,
      createdAt: row.created_at,
    }));
  }

  deactivateUser(userPublicId: string, deactivatedAt: Date): Promise<boolean> {
    return queryDeactivateUser(this.executor, userPublicId, deactivatedAt);
  }

  revokeAllSessionsForUser(userPublicId: string, revokedAt: Date): Promise<void> {
    return queryRevokeAllSessionsForUser(this.executor, userPublicId, revokedAt);
  }
}
