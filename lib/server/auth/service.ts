import type { PoolClient } from "pg";

import type { LoginRequestDto, RegisterRequestDto } from "../api/dtos.ts";
import { UnauthenticatedError, ValidationError } from "../api/errors.ts";
import type { DatabaseExecutor } from "../db/executor.ts";
import { withTransaction, type TransactionPool } from "../db/transaction.ts";
import type { AuthenticatedUser } from "../domain/models.ts";
import {
  PostgresAuthRepository,
  type AuthRepository,
} from "../repositories/auth-repository.ts";
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

export interface AuthApplicationService {
  register(input: RegisterRequestDto): Promise<AuthResult>;
  login(input: LoginRequestDto, currentSessionToken?: string | null): Promise<AuthResult>;
  getSessionUser(sessionToken: string): Promise<AuthenticatedUser>;
  logout(sessionToken: string): Promise<void>;
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

  async register(input: RegisterRequestDto): Promise<AuthResult> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const sessionToken = this.tokens.create();
    const tokenHash = this.tokens.hash(sessionToken);
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + this.sessionDurationMs);

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

      if (input.role === "student") {
        await repository.createStudentProfile({
          userInternalId: account.internalId,
          universityInternalId,
          department: input.department,
          yearOfStudy: input.yearOfStudy,
        });
      } else {
        await repository.createTeacherProfile({
          userInternalId: account.internalId,
          universityInternalId,
          department: input.department,
          designation: input.designation,
        });
      }

      await repository.createSession({
        userInternalId: account.internalId,
        tokenHash,
        createdAt,
        expiresAt,
      });
      return account.user;
    });

    return { user, sessionToken, expiresAt };
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
}
