import type { PoolClient } from "pg";

import type { LoginRequestDto, RegisterRequestDto } from "../api/dtos.ts";
import {
  AccountPendingApprovalError,
  AccountRejectedError,
  InvalidTransitionError,
  UnauthenticatedError,
  ValidationError,
} from "../api/errors.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import { withTransaction, type TransactionPool } from "../db/transaction.ts";
import type { AuthenticatedUser, DirectoryUser, PendingUser } from "../domain/models.ts";
import {
  PostgresAuthRepository,
  type AuthRepository,
} from "../repositories/auth-repository.ts";
import { requireRole } from "./authorization.ts";
import type { PasswordHasher } from "./password.ts";
import { ScryptPasswordHasher } from "./password.ts";
import {
  defaultSessionTokens,
  SESSION_DURATION_MS,
  type SessionTokenService,
} from "./session.ts";

export interface AuthResult {
  user: AuthenticatedUser;
  sessionToken: string;
  expiresAt: Date;
}

// register() never returns a session: learner/contributor accounts always
// start in "pending" review, so there is nothing to log in with yet. The
// caller (http-handlers.ts) uses this to render a "check back after admin
// approval" response instead of setting a session cookie.
export interface RegistrationOutcome {
  status: "pending";
  name: string;
  email: string;
  username: string;
}

export interface AuthApplicationService {
  register(input: RegisterRequestDto): Promise<RegistrationOutcome>;
  login(input: LoginRequestDto, currentSessionToken?: string | null): Promise<AuthResult>;
  getSessionUser(sessionToken: string): Promise<AuthenticatedUser>;
  logout(sessionToken: string): Promise<void>;

  // Admin review of self-registered (learner/contributor) accounts.
  listPendingUsers(actor: AuthenticatedUser): Promise<PendingUser[]>;
  approveUser(actor: AuthenticatedUser, userPublicId: string): Promise<void>;
  rejectUser(actor: AuthenticatedUser, userPublicId: string, reason: string): Promise<void>;

  // Admin user directory ("how many people are using this") and the ability
  // to remove someone's access. Deactivation, never hard deletion -- the
  // database itself refuses to hard-delete a user row.
  listAllUsers(actor: AuthenticatedUser): Promise<DirectoryUser[]>;
  deactivateUser(actor: AuthenticatedUser, userPublicId: string): Promise<void>;
}

type AuthPool = DatabaseExecutor & TransactionPool;

interface AuthServiceDependencies {
  pool: AuthPool;
  repositoryFactory?: (executor: DatabaseExecutor) => AuthRepository;
  passwordHasher?: PasswordHasher;
  tokens?: SessionTokenService;
  now?: () => Date;
  sessionDurationMs?: number;
}

const adminRoles = ["admin"] as const;

export class AuthService implements AuthApplicationService {
  private readonly pool: AuthPool;
  private readonly repositoryFactory: (executor: DatabaseExecutor) => AuthRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly tokens: SessionTokenService;
  private readonly now: () => Date;
  private readonly sessionDurationMs: number;

  constructor(dependencies: AuthServiceDependencies) {
    this.pool = dependencies.pool;
    this.repositoryFactory =
      dependencies.repositoryFactory ?? ((executor) => new PostgresAuthRepository(executor));
    this.passwordHasher = dependencies.passwordHasher ?? new ScryptPasswordHasher();
    this.tokens = dependencies.tokens ?? defaultSessionTokens;
    this.now = dependencies.now ?? (() => new Date());
    this.sessionDurationMs = dependencies.sessionDurationMs ?? SESSION_DURATION_MS;

    if (this.sessionDurationMs <= 0 || this.sessionDurationMs > 30 * 24 * 60 * 60 * 1000) {
      throw new Error("Session duration must be greater than zero and at most 30 days.");
    }
  }

  // Learner/contributor self-registration. Deliberately does NOT create a
  // session or return one: the account is created with registration_status
  // = 'pending' (the database column default) and cannot log in until an
  // admin approves it via approveUser(). Admin accounts are never created
  // through this path (validateRegisterRequest only accepts learner/contributor).
  async register(input: RegisterRequestDto): Promise<RegistrationOutcome> {
    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await withTransaction(this.pool, async (client: PoolClient) => {
      const repository = this.repositoryFactory(client);
      const universityInternalId = await repository.findActiveUniversityInternalId(
        input.universityId
      );
      if (!universityInternalId) {
        throw new ValidationError("Request validation failed.", {
          universityId: ["universityId must identify an active university."],
        });
      }

      const account = await repository.createUser({
        name: input.name,
        email: input.email,
        username: input.username,
        passwordHash,
        role: input.role,
      });

      if (input.role === "learner") {
        await repository.createStudentProfile({
          userInternalId: account.internalId,
          universityInternalId,
          department: input.department || "Computer Science",
          yearOfStudy: input.yearOfStudy,
        });
      } else {
        await repository.createTeacherProfile({
          userInternalId: account.internalId,
          universityInternalId,
          department: input.department || "Computer Science",
        });
      }

      return account.user;
    });

    return { status: "pending", name: user.name, email: user.email, username: user.username };
  }

  async login(
    input: LoginRequestDto,
    currentSessionToken?: string | null
  ): Promise<AuthResult> {
    const repository = this.repositoryFactory(this.pool);
    const credentials = await repository.findCredentials(input.identifier);

    if (!credentials) {
      // Perform equivalent memory-hard work to reduce account-enumeration timing.
      await this.passwordHasher.hash(input.password);
      throw new UnauthenticatedError("Incorrect username or password.");
    }

    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      credentials.passwordHash
    );
    if (!passwordMatches) {
      throw new UnauthenticatedError("Incorrect username or password.");
    }

    // Password is correct at this point, so revealing the review state below
    // does not leak anything an attacker couldn't already infer.
    if (credentials.registrationStatus === "pending") {
      throw new AccountPendingApprovalError();
    }
    if (credentials.registrationStatus === "rejected") {
      throw new AccountRejectedError(
        credentials.rejectionReason
          ? `This account's registration was not approved: ${credentials.rejectionReason}`
          : undefined
      );
    }

    const sessionToken = this.tokens.create();
    const tokenHash = this.tokens.hash(sessionToken);
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.sessionDurationMs);

    await withTransaction(this.pool, async (client: PoolClient) => {
      const transactionRepository = this.repositoryFactory(client);
      if (currentSessionToken) {
        await transactionRepository.revokeSession(
          this.tokens.hash(currentSessionToken),
          createdAt
        );
      }
      await transactionRepository.createSession({
        expectedPasswordHash: credentials.passwordHash,
        userInternalId: credentials.internalId,
        tokenHash,
        createdAt,
        expiresAt,
      });
    });

    return { user: credentials.user, sessionToken, expiresAt };
  }

  async getSessionUser(sessionToken: string): Promise<AuthenticatedUser> {
    const user = await this.repositoryFactory(this.pool).findUserBySessionHash(
      this.tokens.hash(sessionToken)
    );
    if (!user) throw new UnauthenticatedError();
    return user;
  }

  async logout(sessionToken: string): Promise<void> {
    await this.repositoryFactory(this.pool).revokeSession(
      this.tokens.hash(sessionToken),
      this.now()
    );
  }

  async listPendingUsers(actor: AuthenticatedUser): Promise<PendingUser[]> {
    requireRole(actor, adminRoles);
    return this.repositoryFactory(this.pool).listPendingUsers();
  }

  async approveUser(actor: AuthenticatedUser, userPublicId: string): Promise<void> {
    requireRole(actor, adminRoles);
    const updated = await this.repositoryFactory(this.pool).approveUser(
      userPublicId,
      actor.id,
      this.now()
    );
    if (!updated) {
      throw new InvalidTransitionError("Only pending accounts can be approved or rejected.");
    }
  }

  async rejectUser(actor: AuthenticatedUser, userPublicId: string, reason: string): Promise<void> {
    requireRole(actor, adminRoles);
    const updated = await this.repositoryFactory(this.pool).rejectUser(
      userPublicId,
      actor.id,
      this.now(),
      reason
    );
    if (!updated) {
      throw new InvalidTransitionError("Only pending accounts can be approved or rejected.");
    }
  }

  async listAllUsers(actor: AuthenticatedUser): Promise<DirectoryUser[]> {
    requireRole(actor, adminRoles);
    return this.repositoryFactory(this.pool).listAllUsers();
  }

  // Removes a user's access without ever hard-deleting the row: flips
  // is_active off (the database rejects hard deletion of app_user outright)
  // and revokes every one of their active sessions in the same transaction,
  // so a deactivated account is logged out immediately, not just blocked
  // from its next login.
  async deactivateUser(actor: AuthenticatedUser, userPublicId: string): Promise<void> {
    requireRole(actor, adminRoles);
    if (actor.id === userPublicId) {
      throw new InvalidTransitionError("You cannot deactivate your own account.");
    }

    await withTransaction(this.pool, async (client: PoolClient) => {
      const transactionRepository = this.repositoryFactory(client);
      const deactivatedAt = this.now();
      const updated = await transactionRepository.deactivateUser(userPublicId, deactivatedAt);
      if (!updated) {
        throw new InvalidTransitionError("This account is already deactivated.");
      }
      await transactionRepository.revokeAllSessionsForUser(userPublicId, deactivatedAt);
    });
  }
}
