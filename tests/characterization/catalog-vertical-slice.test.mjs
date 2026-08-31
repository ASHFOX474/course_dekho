import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../lib/server/api/errors.ts";
import { validateCourseListQuery } from "../../lib/server/api/validation.ts";
import { createCatalogHttpHandlers } from "../../lib/server/catalog/http-handlers.ts";
import { CatalogService } from "../../lib/server/catalog/service.ts";
import { SESSION_COOKIE_NAME } from "../../lib/server/auth/session.ts";
import { PostgresCatalogRepository } from "../../lib/server/repositories/catalog-repository.ts";

const universityId = "00000000-0000-4000-8000-000000000201";
const semesterId = "00000000-0000-4000-8000-000000000301";
const courseId = "00000000-0000-4000-8000-000000000401";
const topicId = "00000000-0000-4000-8000-000000000505";
const resourceId = "00000000-0000-4000-8000-000000000601";

const actor = {
  id: "00000000-0000-4000-8000-000000000101",
  name: "Rafiul Islam",
  username: "rafiul",
  email: "rafiul@example.com",
  role: "student",
};

const university = {
  id: universityId,
  name: "Bangladesh University of Engineering and Technology",
  shortName: "BUET",
};

const semester = {
  id: semesterId,
  universityId,
  name: "Level 2, Term 1",
  sortOrder: 3,
};

const course = {
  id: courseId,
  code: "CSE-211",
  name: "Data Structures and Algorithms",
  description: "Core structures.",
  university,
  semester,
};

const topic = {
  id: topicId,
  courseId,
  slug: "graph",
  name: "Graph",
  description: "Graph algorithms.",
  sequenceOrder: 5,
  subtopics: [
    {
      id: "00000000-0000-4000-8000-000000000901",
      slug: "representations",
      title: "Graph representations",
      sequenceOrder: 1,
    },
  ],
};

const resource = {
  id: resourceId,
  topicId,
  courseId,
  type: "question",
  title: "BUET Graph Final 2024",
  description: "Final questions.",
  addedBy: {
    id: "00000000-0000-4000-8000-000000000102",
    name: "Dr. Sharif Ahmed",
  },
  year: 2024,
  topicsCovered: ["Shortest Paths"],
  fileSizeBytes: 2048,
  views: 12,
  downloads: 4,
  uploadedAt: new Date("2026-08-21T10:00:00.000Z"),
};

test("course-list query validation normalizes UUID filters and bounded search", () => {
  assert.deepEqual(
    validateCourseListQuery(
      new URL(
        `https://coursedekho.test/api/v1/courses?universityId=${universityId.toUpperCase()}&semesterId=${semesterId}&query=%20Graph%20`
      ).searchParams
    ),
    { universityId, semesterId, query: "Graph" }
  );

  for (const query of [
    "universityId=not-a-uuid",
    "query=",
    `query=${"x".repeat(101)}`,
    "unknown=value",
    `universityId=${universityId}&universityId=${universityId}`,
  ]) {
    assert.throws(
      () => validateCourseListQuery(new URLSearchParams(query)),
      (error) => error instanceof ValidationError
    );
  }
});

test("catalog repository parameterizes hierarchy reads and hard-codes approved visibility", async () => {
  const seen = [];
  const executor = {
    async query(config) {
      seen.push(config);
      return { rows: [], rowCount: 0 };
    },
  };
  const repository = new PostgresCatalogRepository(executor);

  await repository.listUniversities();
  await repository.findUniversity(universityId);
  await repository.listSemesters(universityId);
  await repository.listCourses({ universityId, semesterId, query: "Graph" });
  await repository.findCourse(courseId);
  await repository.listTopics(courseId);
  await repository.findTopic(topicId);
  await repository.listApprovedResourcesByCourse(courseId);
  await repository.listApprovedResources(topicId);
  await repository.findApprovedResource(resourceId);

  assert.deepEqual(
    seen.map((query) => query.values),
    [
      [],
      [universityId],
      [universityId],
      [universityId, semesterId, "Graph"],
      [courseId],
      [courseId],
      [topicId],
      [courseId],
      [topicId],
      [resourceId],
    ]
  );

  for (const query of seen.slice(-3)) {
    assert.match(query.text, /submission\.status = 'approved'/);
    assert.match(query.text, /content\.is_active/);
    assert.match(query.text, /topic\.is_active/);
    assert.match(query.text, /course\.is_active/);
    assert.match(query.text, /university\.is_active/);
    assert.match(query.text, /semester\.is_active/);
    assert.doesNotMatch(query.text, /submission\.status = '(?:pending|rejected)'/);
    assert.doesNotMatch(query.text, /SELECT\s+\*/i);
  }
});

test("catalog repository maps university and semester rows into domain summaries", async () => {
  const executor = {
    async query(config) {
      if (config.name === "catalog-list-active-semesters-v1") {
        return {
          rows: [
            {
              semester_public_id: semesterId,
              university_public_id: universityId,
              semester_name: semester.name,
              semester_sequence_order: semester.sortOrder,
            },
          ],
          rowCount: 1,
        };
      }
      return {
        rows: [
          {
            university_public_id: universityId,
            university_name: university.name,
            university_short_name: university.shortName,
          },
        ],
        rowCount: 1,
      };
    },
  };
  const repository = new PostgresCatalogRepository(executor);

  assert.deepEqual(await repository.listUniversities(), [university]);
  assert.deepEqual(await repository.findUniversity(universityId), university);
  assert.deepEqual(await repository.listSemesters(universityId), [semester]);
});

test("catalog service distinguishes missing hierarchy nodes from empty collections", async () => {
  const calls = [];
  const repository = {
    async listUniversities() { return [university]; },
    async findUniversity(id) {
      calls.push(["findUniversity", id]);
      return id === universityId ? university : null;
    },
    async listSemesters(id) { calls.push(["listSemesters", id]); return [semester]; },
    async listCourses(filters) { calls.push(["listCourses", filters]); return [course]; },
    async findCourse(id) { calls.push(["findCourse", id]); return id === courseId ? course : null; },
    async listTopics(id) { calls.push(["listTopics", id]); return [topic]; },
    async findTopic(id) { calls.push(["findTopic", id]); return id === topicId ? topic : null; },
    async listApprovedResourcesByCourse(id) { calls.push(["courseResources", id]); return [resource]; },
    async listApprovedResources(id) { calls.push(["topicResources", id]); return [resource]; },
    async findApprovedResource(id) { calls.push(["findResource", id]); return id === resourceId ? resource : null; },
  };
  const service = new CatalogService(repository);

  assert.deepEqual(await service.listUniversities(), [university]);
  assert.deepEqual(await service.listSemesters(universityId), [semester]);
  assert.deepEqual(await service.listCourses({ query: "Graph" }), [course]);
  assert.equal(await service.getCourse(courseId), course);
  assert.deepEqual(await service.listTopics(courseId), [topic]);
  assert.deepEqual(await service.listCourseResources(courseId), [resource]);
  assert.deepEqual(await service.listTopicResources(topicId), [resource]);
  assert.equal(await service.getApprovedResource(resourceId), resource);

  await assert.rejects(service.getCourse(universityId), (error) => error.code === "NOT_FOUND");
  await assert.rejects(service.listSemesters(courseId), (error) => error.code === "NOT_FOUND");
  await assert.rejects(service.listTopicResources(courseId), (error) => error.code === "NOT_FOUND");
  await assert.rejects(service.getApprovedResource(topicId), (error) => error.code === "NOT_FOUND");
});

test("catalog HTTP handlers authenticate and authorize inside every read", async () => {
  const calls = [];
  const token = "t".repeat(43);
  const handlers = createCatalogHttpHandlers({
    authService: {
      async getSessionUser(sessionToken) {
        calls.push(["session", sessionToken]);
        return actor;
      },
    },
    catalogService: {
      async listUniversities() { calls.push(["universities"]); return [university]; },
      async listSemesters(id) { calls.push(["semesters", id]); return [semester]; },
      async listCourses(filters) { calls.push(["courses", filters]); return [course]; },
      async getCourse(id) { calls.push(["course", id]); return course; },
      async listTopics(id) { calls.push(["topics", id]); return [topic]; },
      async listCourseResources(id) { calls.push(["courseResources", id]); return [resource]; },
      async listTopicResources(id) { calls.push(["topicResources", id]); return [resource]; },
      async getApprovedResource(id) { calls.push(["resource", id]); return resource; },
    },
  });

  function request(path) {
    return new Request(`https://coursedekho.test${path}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
  }

  const responses = await Promise.all([
    handlers.listUniversities(request("/api/v1/universities")),
    handlers.listSemesters(
      request(`/api/v1/universities/${universityId}/semesters`),
      universityId
    ),
    handlers.listCourses(request("/api/v1/courses?query=Graph")),
    handlers.getCourse(request(`/api/v1/courses/${courseId}`), courseId),
    handlers.listTopics(request(`/api/v1/courses/${courseId}/topics`), courseId),
    handlers.listCourseResources(
      request(`/api/v1/courses/${courseId}/resources`),
      courseId
    ),
    handlers.listTopicResources(
      request(`/api/v1/topics/${topicId}/resources`),
      topicId
    ),
    handlers.getApprovedResource(
      request(`/api/v1/resources/${resourceId}`),
      resourceId
    ),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("vary"), "Cookie");
  }

  assert.deepEqual(await responses[6].json(), {
    data: [
      {
        ...resource,
        uploadedAt: "2026-08-21T10:00:00.000Z",
        publicationStatus: "published",
        isActive: true,
      },
    ],
  });
  assert.equal(calls.filter(([name]) => name === "session").length, 8);
  assert.deepEqual(calls.filter(([name]) => name !== "session"), [
    ["universities"],
    ["semesters", universityId],
    ["courses", { query: "Graph" }],
    ["course", courseId],
    ["topics", courseId],
    ["courseResources", courseId],
    ["topicResources", topicId],
    ["resource", resourceId],
  ]);
});

test("catalog handlers reject missing sessions before calling catalog services", async () => {
  let catalogCalls = 0;
  const handlers = createCatalogHttpHandlers({
    authService: {
      async getSessionUser() {
        throw new Error("must not resolve an absent token");
      },
    },
    catalogService: {
      async listUniversities() { catalogCalls += 1; return []; },
      async listSemesters() { catalogCalls += 1; return []; },
      async listCourses() { catalogCalls += 1; return []; },
      async getCourse() { catalogCalls += 1; return course; },
      async listTopics() { catalogCalls += 1; return []; },
      async listCourseResources() { catalogCalls += 1; return []; },
      async listTopicResources() { catalogCalls += 1; return []; },
      async getApprovedResource() { catalogCalls += 1; return resource; },
    },
  });

  const response = await handlers.listCourses(
    new Request("https://coursedekho.test/api/v1/courses")
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
  assert.equal(catalogCalls, 0);
});

test("catalog handlers validate public IDs only after authenticating the actor", async () => {
  const calls = [];
  const handlers = createCatalogHttpHandlers({
    authService: {
      async getSessionUser() {
        calls.push("session");
        return actor;
      },
    },
    catalogService: {
      async listUniversities() { return []; },
      async listSemesters() { calls.push("catalog"); return []; },
      async listCourses() { return []; },
      async getCourse() { return course; },
      async listTopics() { return []; },
      async listCourseResources() { return []; },
      async listTopicResources() { return []; },
      async getApprovedResource() { return resource; },
    },
  });

  const response = await handlers.listSemesters(
    new Request("https://coursedekho.test/api/v1/universities/not-a-uuid/semesters", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${"t".repeat(43)}` },
    }),
    "not-a-uuid"
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  assert.deepEqual(calls, ["session"]);
});
