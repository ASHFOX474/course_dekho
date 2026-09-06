import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { SESSION_COOKIE_NAME } from "../../lib/server/auth/session.ts";

const repositoryRoot = new URL("../../", import.meta.url);
const learner = {
  id: "00000000-0000-4000-8000-000000000101",
  name: "Rafiul Islam",
  username: "rafiul",
  email: "rafiul@example.com",
  role: "student",
};
const teacher = { ...learner, id: "00000000-0000-4000-8000-000000000102", role: "teacher" };
const admin = { ...learner, id: "00000000-0000-4000-8000-000000000103", role: "admin" };
const courseId = "00000000-0000-4000-8000-000000000401";
const topicId = "00000000-0000-4000-8000-000000000505";
const resourceId = "00000000-0000-4000-8000-000000000601";
const submissionId = "00000000-0000-4000-8000-000000000702";

async function source(path) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

async function collectSourceFiles(directory) {
  const root = new URL(`${directory}/`, repositoryRoot);
  const files = [];

  async function visit(url) {
    for (const entry of await readdir(url, { withFileTypes: true })) {
      const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), url);
      if (entry.isDirectory()) await visit(child);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(child);
    }
  }

  await visit(root);
  return files;
}

test("the frontend has no mock-data provider, imports, or hard-coded academic feed", async () => {
  const files = [
    ...(await collectSourceFiles("app")),
    ...(await collectSourceFiles("components")),
    ...(await collectSourceFiles("lib/client")),
    new URL("lib/auth/AuthContext.tsx", repositoryRoot),
  ];
  const violations = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (/@\/lib\/(?:data|queries|store\/DataContext)/.test(text)) {
      violations.push(file.pathname);
    }
    if (/const announcements\s*=\s*\[/.test(text)) violations.push(file.pathname);
  }

  assert.deepEqual(violations, []);
  assert.doesNotMatch(await source("app/layout.tsx"), /DataProvider/);
  assert.doesNotMatch(await source("app/login/page.tsx"), /demoAccounts|Quick demo login/);
});

test("the temporary backend demo route and command are completely removed", async () => {
  await assert.rejects(access(new URL("app/backend-demo/page.tsx", repositoryRoot)));
  await assert.rejects(access(new URL("scripts/db/demo-queries.mjs", repositoryRoot)));
  await assert.rejects(access(new URL("tests/characterization/backend-demo.test.mjs", repositoryRoot)));

  const packageJson = JSON.parse(await source("package.json"));
  assert.equal(packageJson.scripts["db:demo"], undefined);
  assert.doesNotMatch(await source("components/layout/Sidebar.tsx"), /Backend Demo|backend-demo/);
});

test("database-backed workspace routes delegate at request time", async () => {
  const routes = new Map([
    ["app/api/v1/me/profile/route.ts", ["GET", "getProfile"]],
    ["app/api/v1/me/learning/route.ts", ["GET", "getLearning"]],
    ["app/api/v1/me/progress/[topicId]/route.ts", ["PUT", "updateProgress"]],
    ["app/api/v1/me/bookmarks/route.ts", ["GET", "listBookmarks", "POST", "createBookmark"]],
    ["app/api/v1/me/bookmarks/[bookmarkId]/route.ts", ["DELETE", "deleteBookmark"]],
    ["app/api/v1/me/access-history/route.ts", ["GET", "listAccessHistory"]],
    ["app/api/v1/me/solved-questions/route.ts", ["GET", "listSolvedQuestions"]],
    ["app/api/v1/resources/[resourceId]/access/route.ts", ["POST", "recordAccess"]],
    ["app/api/v1/resources/[resourceId]/solved/route.ts", ["POST", "markSolved"]],
    ["app/api/v1/enrollments/route.ts", ["POST", "createEnrollment"]],
    ["app/api/v1/submissions/route.ts", ["POST", "createSubmission"]],
    ["app/api/v1/submissions/mine/route.ts", ["GET", "listSubmissions"]],
    ["app/api/v1/admin/submissions/route.ts", ["GET", "listSubmissions"]],
    ["app/api/v1/admin/submissions/[submissionId]/approve/route.ts", ["POST", "approveSubmission"]],
    ["app/api/v1/admin/submissions/[submissionId]/reject/route.ts", ["POST", "rejectSubmission"]],
    ["app/api/v1/admin/stats/route.ts", ["GET", "getAdminStats"]],
  ]);

  for (const [path, exportsAndHandlers] of routes) {
    const text = await source(path);
    for (const expected of exportsAndHandlers) assert.match(text, new RegExp(`\\b${expected}\\b`));
    assert.match(text, /workspaceHttpHandlers/);
  }
  assert.doesNotMatch(await source("app/api/v1/submissions/route.ts"), /export async function GET/);
});

test("workspace validation rejects client-owned identity and invalid targets", async () => {
  const {
    validateBookmarkRequest,
    validateProgressRequest,
  } = await import("../../lib/server/api/validation.ts");

  assert.deepEqual(validateBookmarkRequest({ targetType: "resource", targetId: resourceId }), {
    targetType: "resource",
    targetId: resourceId,
  });
  assert.throws(
    () => validateBookmarkRequest({ targetType: "resource", targetId: resourceId, userId: learner.id }),
    (error) => error.code === "VALIDATION_ERROR" && "userId" in error.fieldErrors
  );
  assert.throws(
    () => validateBookmarkRequest({ targetType: "unknown", targetId: "bad" }),
    (error) => error.code === "VALIDATION_ERROR"
  );
  assert.deepEqual(validateProgressRequest({ progressPercent: 100 }), { progressPercent: 100 });
  assert.throws(() => validateProgressRequest({ progressPercent: 101 }), /validation/i);
});

test("workspace SQL is parameterized and preserves approved-content visibility", async () => {
  const text = await source("lib/server/db/queries/workspace-queries.ts");

  assert.doesNotMatch(text, /SELECT\s+\*/i);
  assert.doesNotMatch(text, /\$\{(?:userId|targetId|courseId|topicId|resourceId|submissionId)\}/);
  assert.match(text, /targetType === "resource" \? "content_id" : `\$\{targetType\}_id`/);
  assert.match(text, /submission\.status = 'approved'/);
  assert.match(text, /content\.is_active/);
  assert.match(text, /ORDER BY[\s\S]*last_accessed_at DESC/i);
  assert.match(text, /FOR UPDATE/);
  assert.match(text, /\$3::smallint/);
  assert.match(text, /values:\s*\[/);
});

test("workspace handlers enforce learner, teacher, and admin roles inside handlers", async () => {
  const { createWorkspaceHttpHandlers } = await import(
    "../../lib/server/workspace/http-handlers.ts"
  );
  const calls = [];
  let actor = learner;
  const service = new Proxy(
    {},
    {
      get(_target, property) {
        return async (...args) => {
          calls.push([property, ...args]);
          if (property === "listBookmarks" || property === "listSubmissions") return [];
          if (property === "approveSubmission") return {
            id: submissionId,
            teacher: { id: teacher.id, name: teacher.name },
            resourceType: "question",
            title: "Graph Questions",
            description: "Questions",
            courseId,
            courseCode: "CSE-211",
            topicId,
            topicName: "Graph",
            status: "approved",
            submittedAt: new Date("2026-08-29T09:00:00Z"),
            reviewedBy: { id: admin.id, name: admin.name },
            reviewedAt: new Date("2026-09-01T00:00:00Z"),
            rejectionReason: null,
          };
          return { id: submissionId };
        };
      },
    }
  );
  const handlers = createWorkspaceHttpHandlers({
    authService: { async getSessionUser() { return actor; } },
    workspaceService: service,
    appOrigin: "https://coursedekho.test",
  });
  const token = "t".repeat(43);
  const request = (path, init = {}) =>
    new Request(`https://coursedekho.test${path}`, {
      ...init,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
        origin: "https://coursedekho.test",
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });

  assert.equal((await handlers.listBookmarks(request("/api/v1/me/bookmarks"))).status, 200);
  assert.equal(
    (await handlers.createSubmission(request("/api/v1/submissions", {
      method: "POST",
      body: JSON.stringify({
        resourceType: "question",
        title: "Graph Questions",
        description: "A reviewed question set.",
        courseId,
        topicId,
      }),
    }))).status,
    403
  );

  actor = teacher;
  assert.equal((await handlers.listSubmissions(request("/api/v1/submissions"))).status, 200);
  assert.equal(
    (await handlers.approveSubmission(
      request(`/api/v1/admin/submissions/${submissionId}/approve`, { method: "POST" }),
      submissionId
    )).status,
    403
  );

  actor = admin;
  assert.equal(
    (await handlers.approveSubmission(
      request(`/api/v1/admin/submissions/${submissionId}/approve`, { method: "POST" }),
      submissionId
    )).status,
    200
  );
  assert.equal(
    (await handlers.listBookmarks(request("/api/v1/me/bookmarks"))).status,
    403
  );
  assert.ok(calls.some(([name]) => name === "approveSubmission"));
});

test("approval is executed through one transaction and publishes only after review", async () => {
  const { WorkspaceService } = await import("../../lib/server/workspace/service.ts");
  const calls = [];
  const client = {
    async query(statement) {
      calls.push(typeof statement === "string" ? statement : statement.name);
      return { rows: [], rowCount: 0 };
    },
    release() { calls.push("RELEASE"); },
  };
  const pool = { async connect() { calls.push("CONNECT"); return client; } };
  const reviewed = {
    id: submissionId,
    teacher: { id: teacher.id, name: teacher.name },
    resourceType: "question",
    title: "Graph Questions",
    description: "Questions",
    courseId,
    courseCode: "CSE-211",
    topicId,
    topicName: "Graph",
    status: "approved",
    submittedAt: new Date("2026-08-29T09:00:00Z"),
    reviewedBy: { id: admin.id, name: admin.name },
    reviewedAt: new Date("2026-09-01T00:00:00Z"),
    rejectionReason: null,
  };
  const service = new WorkspaceService({
    pool,
    repositoryFactory(executor) {
      assert.equal(executor, client);
      return {
        async approveSubmission(input) { calls.push(["approve", input]); return reviewed; },
      };
    },
    now: () => new Date("2026-09-01T00:00:00Z"),
  });

  assert.equal(await service.approveSubmission(admin, submissionId), reviewed);
  assert.deepEqual(calls.slice(0, 3), ["CONNECT", "BEGIN", ["approve", {
    submissionId,
    reviewerId: admin.id,
    reviewedAt: new Date("2026-09-01T00:00:00.000Z"),
  }]]);
  assert.deepEqual(calls.slice(-2), ["COMMIT", "RELEASE"]);
});

test("all formerly mocked pages consume the database workspace client", async () => {
  for (const path of [
    "app/dashboard/page.tsx",
    "app/profile/page.tsx",
    "app/progress/page.tsx",
    "app/bookmarks/page.tsx",
    "app/access-history/page.tsx",
    "app/solved-questions/page.tsx",
    "app/teacher/submissions/page.tsx",
    "app/admin/approvals/page.tsx",
    "app/courses/[courseId]/topics/[topicId]/page.tsx",
    "app/resources/[resourceId]/page.tsx",
  ]) {
    assert.match(await source(path), /@\/lib\/client\/workspace-api/);
  }

  const client = await source("lib/client/workspace-api.ts");
  assert.match(client, /cache:\s*"no-store"/);
  assert.match(client, /credentials:\s*"same-origin"/);
});
