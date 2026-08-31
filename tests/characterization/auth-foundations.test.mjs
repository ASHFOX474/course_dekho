import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenError, UnauthenticatedError, ValidationError } from "../../lib/server/api/errors.ts";
import {
  validateLoginRequest,
  validateRegisterRequest,
} from "../../lib/server/api/validation.ts";
import { requireRole } from "../../lib/server/auth/authorization.ts";
import { createAuthHttpHandlers } from "../../lib/server/auth/http-handlers.ts";
import { ScryptPasswordHasher } from "../../lib/server/auth/password.ts";
import {
  SESSION_COOKIE_NAME,
  assertTrustedOrigin,
  createSessionToken,
  hashSessionToken,
  readSessionToken,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "../../lib/server/auth/session.ts";
import { AuthService } from "../../lib/server/auth/service.ts";
import { PostgresAuthRepository } from "../../lib/server/repositories/auth-repository.ts";

const universityId = "00000000-0000-4000-8000-000000000201";
const user = {
  id: "00000000-0000-4000-8000-000000000101",
  name: "Rafiul Islam",
  username: "rafiul",
  email: "rafiul@example.com",
  role: "student",
};

test("registration validation normalizes identity fields and keeps passwords exact", () => {
  assert.deepEqual(
    validateRegisterRequest({
      name: "  Rafiul Islam  ",
      email: "  RAFIUL@Example.COM ",
      username: "  RAFIUL_1 ",
      password: "  correct horse battery  ",
      role: "student",
      universityId: universityId.toUpperCase(),
      department: "  CSE  ",
      yearOfStudy: 2,
    }),
    {
      name: "Rafiul Islam",
      email: "rafiul@example.com",
      username: "rafiul_1",
      password: "  correct horse battery  ",
      role: "student",
      universityId,
      department: "CSE",
      yearOfStudy: 2,
    }
  );
});

test("public registration rejects admin creation, weak passwords, and mismatched profiles", () => {
  for (const input of [
    {
      name: "Admin User",
      email: "admin@example.com",
      username: "admin_user",
      password: "long enough password",
      role: "admin",
      universityId,
    },
    {
      name: "Student User",
      email: "student@example.com",
      username: "student_user",
      password: "short",
      role: "student",
      universityId,
      designation: "Lecturer",
    },
    {
      name: "Teacher User",
      email: "teacher@example.com",
      username: "teacher_user",
      password: "long enough password",
      role: "teacher",
      universityId,
      yearOfStudy: 2,
    },
  ]) {
    assert.throws(
      () => validateRegisterRequest(input),
      (error) => error instanceof ValidationError && Object.keys(error.fieldErrors).length > 0
    );
  }
});

test("login accepts usernames or email addresses without normalizing passwords", () => {
  assert.deepEqual(
    validateLoginRequest({ identifier: "  RAFIUL@Example.COM ", password: " pass word " }),
    { identifier: "rafiul@example.com", password: " pass word " }
  );
});

test("scrypt hashes are salted, verifiable, and fail closed on malformed records", async () => {
  const hasher = new ScryptPasswordHasher({ cost: 1024 });
  const first = await hasher.hash("correct horse battery staple");
  const second = await hasher.hash("correct horse battery staple");

  assert.match(first, /^scrypt\$1024\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second);
  assert.equal(first.includes("correct horse battery staple"), false);
  assert.equal(await hasher.verify("correct horse battery staple", first), true);
  assert.equal(await hasher.verify("incorrect", first), false);
  assert.equal(await hasher.verify("anything", "not-a-valid-hash"), false);
});

test("session tokens are random while PostgreSQL receives only stable SHA-256 digests", () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(hashSessionToken(first), /^[0-9a-f]{64}$/);
  assert.equal(hashSessionToken(first), hashSessionToken(first));
  assert.notEqual(hashSessionToken(first), first);
});

test("session cookies are HTTP-only, same-site, scoped, expiring, and secure in production", () => {
  const expiresAt = new Date("2026-09-07T00:00:00.000Z");
  const cookie = serializeSessionCookie("a".repeat(43), { secure: true, expiresAt });

  assert.match(cookie, new RegExp(`^${SESSION_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Expires=Mon, 07 Sep 2026 00:00:00 GMT/);

  const expired = serializeExpiredSessionCookie({ secure: true });
  assert.match(expired, /Max-Age=0/);
  assert.match(expired, /HttpOnly/);
  assert.match(expired, /Secure/);
});

test("cookie parsing rejects malformed or ambiguous session cookies", () => {
  const token = "a".repeat(43);

  assert.equal(
    readSessionToken(new Request("https://coursedekho.test", {
      headers: { cookie: `other=x; ${SESSION_COOKIE_NAME}=${token}` },
    })),
    token
  );
  assert.equal(
    readSessionToken(new Request("https://coursedekho.test", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=bad token` },
    })),
    null
  );
  assert.equal(
    readSessionToken(new Request("https://coursedekho.test", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}; ${SESSION_COOKIE_NAME}=${token}` },
    })),
    null
  );
});

test("unsafe browser requests require a trusted same origin", () => {
  assert.doesNotThrow(() =>
    assertTrustedOrigin(
      new Request("https://coursedekho.test/api/v1/auth/login", {
        method: "POST",
        headers: { origin: "https://coursedekho.test" },
      }),
      "https://coursedekho.test"
    )
  );
  assert.throws(
    () =>
      assertTrustedOrigin(
        new Request("https://coursedekho.test/api/v1/auth/login", {
          method: "POST",
          headers: { origin: "https://evil.test" },
        }),
        "https://coursedekho.test"
      ),
    (error) => error instanceof ForbiddenError
  );
  assert.throws(
    () =>
      assertTrustedOrigin(
        new Request("https://coursedekho.test/api/v1/auth/login", {
          method: "POST",
          headers: { origin: "not a URL" },
        }),
        "https://coursedekho.test"
      ),
    ForbiddenError
  );
  assert.throws(
    () =>
      assertTrustedOrigin(
        new Request("https://coursedekho.test/api/v1/auth/login", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        }),
        "https://coursedekho.test"
      ),
    ForbiddenError
  );
  assert.doesNotThrow(() =>
    assertTrustedOrigin(
      new Request("https://coursedekho.test/api/v1/auth/login", { method: "POST" }),
      "https://coursedekho.test"
    )
  );
});

test("handler authorization distinguishes missing sessions from wrong roles", () => {
  assert.equal(requireRole(user, ["student"]), user);
  assert.throws(() => requireRole(null, ["student"]), UnauthenticatedError);
  assert.throws(() => requireRole(user, ["teacher"]), ForbiddenError);
});

test("registration creates the account, matching profile, and session in one transaction", async () => {
  const calls = [];
  const client = {
    async query(statement) {
      calls.push(typeof statement === "string" ? statement : statement.name);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  const pool = {
    async connect() {
      calls.push("CONNECT");
      return client;
    },
    async query() {
      throw new Error("registration must not use the pool outside its transaction");
    },
  };
  const repository = {
    async findActiveUniversityInternalId(id) {
      calls.push(`university:${id}`);
      return "201";
    },
    async createUser(input) {
      calls.push(`user:${input.role}:${input.passwordHash}`);
      return { internalId: "101", user };
    },
    async createStudentProfile(input) {
      calls.push(`student-profile:${input.userInternalId}:${input.universityInternalId}`);
    },
    async createTeacherProfile() {
      calls.push("teacher-profile");
    },
    async createSession(input) {
      calls.push(`session:${input.userInternalId}:${input.tokenHash}`);
    },
  };
  const service = new AuthService({
    pool,
    repositoryFactory(executor) {
      assert.equal(executor, client);
      return repository;
    },
    passwordHasher: {
      async hash(password) {
        calls.push(`hash:${password}`);
        return "encoded-password-hash";
      },
      async verify() {
        return false;
      },
    },
    tokens: {
      create: () => "s".repeat(43),
      hash: () => "d".repeat(64),
    },
    now: () => new Date("2026-08-31T00:00:00.000Z"),
  });

  const result = await service.register({
    name: user.name,
    email: user.email,
    username: user.username,
    password: "correct horse battery staple",
    role: "student",
    universityId,
    department: "CSE",
    yearOfStudy: 2,
  });

  assert.equal(result.user, user);
  assert.equal(result.sessionToken, "s".repeat(43));
  assert.equal(result.expiresAt.toISOString(), "2026-09-07T00:00:00.000Z");
  assert.deepEqual(calls, [
    "hash:correct horse battery staple",
    "CONNECT",
    "BEGIN",
    `university:${universityId}`,
    "user:student:encoded-password-hash",
    "student-profile:101:201",
    `session:101:${"d".repeat(64)}`,
    "COMMIT",
    "RELEASE",
  ]);
});

test("HTTP handlers return safe envelopes and set or clear only hardened cookies", async () => {
  const calls = [];
  const handlers = createAuthHttpHandlers({
    service: {
      async register(input) {
        calls.push(["register", input.username]);
        return {
          user,
          sessionToken: "s".repeat(43),
          expiresAt: new Date("2026-09-07T00:00:00.000Z"),
        };
      },
      async login() {
        throw new Error("not used");
      },
      async getSessionUser() {
        calls.push(["session"]);
        return user;
      },
      async logout(token) {
        calls.push(["logout", token]);
      },
    },
    appOrigin: "https://coursedekho.test",
    secureCookies: true,
  });

  const registerResponse = await handlers.register(
    new Request("https://coursedekho.test/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://coursedekho.test" },
      body: JSON.stringify({
        name: user.name,
        email: user.email,
        username: user.username,
        password: "correct horse battery staple",
        role: "student",
        universityId,
      }),
    })
  );
  assert.equal(registerResponse.status, 201);
  assert.deepEqual(await registerResponse.json(), { data: user });
  assert.match(registerResponse.headers.get("set-cookie"), /HttpOnly/);
  assert.equal(registerResponse.headers.get("cache-control"), "no-store");

  const token = "t".repeat(43);
  const logoutResponse = await handlers.logout(
    new Request("https://coursedekho.test/api/v1/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        origin: "https://coursedekho.test",
      },
    })
  );
  assert.equal(logoutResponse.status, 204);
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);
  assert.deepEqual(calls.at(-1), ["logout", token]);
});

test("the PostgreSQL auth repository runs every operation as a named parameterized query", async () => {
  const seen = [];
  const row = {
    user_internal_id: "101",
    user_public_id: user.id,
    user_name: user.name,
    user_email: user.email,
    user_username: user.username,
    user_role: user.role,
  };
  const executor = {
    async query(config) {
      seen.push(config);
      if (config.name === "auth-find-active-university-v1") {
        return { rows: [{ internal_id: "201" }], rowCount: 1 };
      }
      if (config.name === "auth-create-user-v1") {
        return { rows: [row], rowCount: 1 };
      }
      if (config.name === "auth-find-credentials-v1") {
        return {
          rows: [{ ...row, password_hash: "scrypt$1024$8$1$salt$hash" }],
          rowCount: 1,
        };
      }
      if (config.name === "auth-find-user-by-session-v1") {
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
  };
  const repository = new PostgresAuthRepository(executor);

  assert.equal(await repository.findActiveUniversityInternalId(universityId), "201");
  assert.deepEqual(
    await repository.createUser({
      name: user.name,
      email: user.email,
      username: user.username,
      passwordHash: "encoded-password",
      role: "student",
    }),
    { internalId: "101", user }
  );
  await repository.createStudentProfile({
    userInternalId: "101",
    universityInternalId: "201",
    department: "CSE",
    yearOfStudy: 2,
  });
  await repository.createTeacherProfile({
    userInternalId: "102",
    universityInternalId: "201",
    designation: "Lecturer",
  });
  await repository.createSession({
    userInternalId: "101",
    tokenHash: "d".repeat(64),
    createdAt: new Date("2026-08-31T00:00:00.000Z"),
    expiresAt: new Date("2026-09-07T00:00:00.000Z"),
  });
  assert.equal((await repository.findCredentials("rafiul")).passwordHash, "scrypt$1024$8$1$salt$hash");
  assert.deepEqual(await repository.findUserBySessionHash("d".repeat(64)), user);
  await repository.revokeSession("d".repeat(64), new Date("2026-08-31T01:00:00.000Z"));

  assert.deepEqual(
    seen.map((query) => query.name),
    [
      "auth-find-active-university-v1",
      "auth-create-user-v1",
      "auth-create-student-profile-v1",
      "auth-create-teacher-profile-v1",
      "auth-create-session-v1",
      "auth-find-credentials-v1",
      "auth-find-user-by-session-v1",
      "auth-revoke-session-v1",
    ]
  );
  assert.equal(seen.every((query) => Array.isArray(query.values)), true);
  assert.equal(seen.some((query) => JSON.stringify(query.values).includes("d".repeat(64))), true);
  assert.equal(seen.some((query) => JSON.stringify(query.values).includes("s".repeat(43))), false);
  assert.doesNotMatch(seen.map((query) => query.text).join("\n"), /SELECT\s+\*/i);
  for (const queryName of ["auth-find-credentials-v1", "auth-find-user-by-session-v1"]) {
    const query = seen.find((candidate) => candidate.name === queryName);
    assert.match(query.text, /student_profile/i);
    assert.match(query.text, /teacher_profile/i);
    assert.match(query.text, /admin_profile/i);
  }
});

test("the auth repository maps absent universities, credentials, and sessions to null", async () => {
  const repository = new PostgresAuthRepository({
    async query() {
      return { rows: [], rowCount: 0 };
    },
  });

  assert.equal(await repository.findActiveUniversityInternalId(universityId), null);
  assert.equal(await repository.findCredentials("missing"), null);
  assert.equal(await repository.findUserBySessionHash("d".repeat(64)), null);
});

function createServiceHarness(overrides = {}) {
  const calls = [];
  const client = {
    async query(statement) {
      calls.push(typeof statement === "string" ? statement : statement.name);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  const pool = {
    async connect() {
      calls.push("CONNECT");
      return client;
    },
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };
  const baseRepository = {
    async findActiveUniversityInternalId() {
      return "201";
    },
    async createUser(input) {
      return { internalId: "101", user: { ...user, role: input.role } };
    },
    async createStudentProfile() {},
    async createTeacherProfile() {},
    async createSession(input) {
      calls.push(["create-session", input]);
    },
    async findCredentials() {
      return { internalId: "101", user, passwordHash: "encoded" };
    },
    async findUserBySessionHash() {
      return user;
    },
    async revokeSession(tokenHash) {
      calls.push(["revoke", tokenHash]);
    },
    ...overrides.repository,
  };
  const passwordHasher = {
    async hash(password) {
      calls.push(["hash", password]);
      return "encoded";
    },
    async verify(password, encoded) {
      calls.push(["verify", password, encoded]);
      return true;
    },
    ...overrides.passwordHasher,
  };
  const service = new AuthService({
    pool,
    repositoryFactory: () => baseRepository,
    passwordHasher,
    tokens: {
      create: () => "s".repeat(43),
      hash: (token) => `hash:${token}`,
    },
    now: () => new Date("2026-08-31T00:00:00.000Z"),
  });
  return { service, calls };
}

test("login verifies credentials, rotates an existing session, and authenticates the new token", async () => {
  const { service, calls } = createServiceHarness();

  const result = await service.login(
    { identifier: "rafiul", password: "student123" },
    "o".repeat(43)
  );
  assert.equal(result.user, user);
  assert.equal(result.sessionToken, "s".repeat(43));
  assert.equal(result.expiresAt.toISOString(), "2026-09-07T00:00:00.000Z");
  assert.deepEqual(await service.getSessionUser("s".repeat(43)), user);
  await service.logout("s".repeat(43));

  const structuredCalls = calls.filter((call) => Array.isArray(call));
  assert.deepEqual(structuredCalls[0], ["verify", "student123", "encoded"]);
  assert.deepEqual(structuredCalls[1], ["revoke", `hash:${"o".repeat(43)}`]);
  assert.equal(structuredCalls[2][0], "create-session");
  assert.equal(structuredCalls[2][1].tokenHash, `hash:${"s".repeat(43)}`);
  assert.deepEqual(structuredCalls[3], ["revoke", `hash:${"s".repeat(43)}`]);
});

test("login uses generic failures for unknown accounts and incorrect passwords", async () => {
  const missing = createServiceHarness({
    repository: { async findCredentials() { return null; } },
  });
  await assert.rejects(
    missing.service.login({ identifier: "missing", password: "password" }),
    (error) => error instanceof UnauthenticatedError && error.message === "Incorrect username or password."
  );
  assert.deepEqual(missing.calls[0], ["hash", "password"]);

  const incorrect = createServiceHarness({
    passwordHasher: { async verify() { return false; } },
  });
  await assert.rejects(
    incorrect.service.login({ identifier: "rafiul", password: "wrong" }),
    (error) => error instanceof UnauthenticatedError && error.message === "Incorrect username or password."
  );
});

test("session lookup and registration reject inactive references without partial commits", async () => {
  const session = createServiceHarness({
    repository: { async findUserBySessionHash() { return null; } },
  });
  await assert.rejects(session.service.getSessionUser("s".repeat(43)), UnauthenticatedError);

  const registration = createServiceHarness({
    repository: { async findActiveUniversityInternalId() { return null; } },
  });
  await assert.rejects(
    registration.service.register({
      name: user.name,
      email: user.email,
      username: user.username,
      password: "correct horse battery staple",
      role: "student",
      universityId,
    }),
    (error) => error instanceof ValidationError && "universityId" in error.fieldErrors
  );
  assert.equal(registration.calls.includes("ROLLBACK"), true);
  assert.equal(registration.calls.includes("COMMIT"), false);
});

test("teacher registration creates only the teacher profile", async () => {
  let studentProfiles = 0;
  let teacherProfiles = 0;
  const registration = createServiceHarness({
    repository: {
      async createStudentProfile() { studentProfiles += 1; },
      async createTeacherProfile() { teacherProfiles += 1; },
    },
  });

  const result = await registration.service.register({
    name: "Teacher User",
    email: "teacher@example.com",
    username: "teacher_user",
    password: "correct horse battery staple",
    role: "teacher",
    universityId,
    designation: "Lecturer",
  });
  assert.equal(result.user.role, "teacher");
  assert.equal(studentProfiles, 0);
  assert.equal(teacherProfiles, 1);
});

test("HTTP handlers cover login/session and map malformed or unexpected requests safely", async () => {
  const unexpected = [];
  const service = {
    async register() { throw new Error("not used"); },
    async login() {
      return {
        user,
        sessionToken: "s".repeat(43),
        expiresAt: new Date("2026-09-07T00:00:00.000Z"),
      };
    },
    async getSessionUser(token) {
      if (token === "x".repeat(43)) throw new Error("DATABASE_URL=secret");
      return user;
    },
    async logout() {},
  };
  const handlers = createAuthHttpHandlers({
    service,
    appOrigin: "https://coursedekho.test",
    secureCookies: false,
    onUnexpectedError: (error) => unexpected.push(error),
  });

  const login = await handlers.login(new Request("https://coursedekho.test/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://coursedekho.test" },
    body: JSON.stringify({ identifier: "rafiul", password: "student123" }),
  }));
  assert.equal(login.status, 200);
  assert.doesNotMatch(login.headers.get("set-cookie"), /Secure/);

  const session = await handlers.session(new Request("https://coursedekho.test/api/v1/session", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${"s".repeat(43)}` },
  }));
  assert.equal(session.status, 200);
  assert.equal(session.headers.get("vary"), "Cookie");

  const malformed = await handlers.login(new Request("https://coursedekho.test/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "text/plain", origin: "https://coursedekho.test" },
    body: "not json",
  }));
  assert.equal(malformed.status, 400);

  const failure = await handlers.session(new Request("https://coursedekho.test/api/v1/session", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${"x".repeat(43)}` },
  }));
  assert.equal(failure.status, 500);
  assert.doesNotMatch(JSON.stringify(await failure.json()), /DATABASE_URL|secret/);
  assert.equal(unexpected.length, 1);

  const missingLogout = await handlers.logout(new Request("https://coursedekho.test/api/v1/auth/logout", {
    method: "POST",
    headers: { origin: "https://coursedekho.test" },
  }));
  assert.equal(missingLogout.status, 401);
  assert.match(missingLogout.headers.get("set-cookie"), /Max-Age=0/);
});
