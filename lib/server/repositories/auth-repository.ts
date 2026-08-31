import {
  queryActiveUniversityInternalId,
  queryCreateSession,
  queryCreateStudentProfile,
  queryCreateTeacherProfile,
  queryCreateUser,
  queryCredentials,
  queryRevokeSession,
  queryUserBySessionHash,
} from "../db/queries/auth-queries.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import type { AuthUserRow } from "../db/rows.ts";
import type { AuthenticatedUser, UserRole } from "../domain/models.ts";

export interface InternalUserRecord {
  internalId: string;
  user: AuthenticatedUser;
}

export interface CredentialRecord extends InternalUserRecord {
  passwordHash: string;
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
    userInternalId: string;
    tokenHash: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findCredentials(normalizedIdentifier: string): Promise<CredentialRecord | null>;
  findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUser | null>;
  revokeSession(tokenHash: string, revokedAt: Date): Promise<void>;
}

function userRowToRecord(row: AuthUserRow): InternalUserRecord {
  return {
    internalId: row.user_internal_id,
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
    return userRowToRecord(await queryCreateUser(this.executor, input));
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
    return { ...userRowToRecord(row), passwordHash: row.password_hash };
  }

  async findUserBySessionHash(tokenHash: string): Promise<AuthenticatedUser | null> {
    const row = await queryUserBySessionHash(this.executor, tokenHash);
    return row ? userRowToRecord(row).user : null;
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    return queryRevokeSession(this.executor, tokenHash, revokedAt);
  }
}
