import assert from "node:assert/strict";
import test from "node:test";

import {
  ConflictError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  mapErrorToApi,
} from "../../lib/server/api/errors.ts";
import {
  toApprovedResourceDto,
  toCourseDto,
  toEnrollmentDto,
  toSubmissionDto,
  toTopicDto,
} from "../../lib/server/api/mappers.ts";
import {
  validateCreateSubmissionRequest,
  validatePublicId,
  validateRejectSubmissionRequest,
} from "../../lib/server/api/validation.ts";
import { withTransaction } from "../../lib/server/db/transaction.ts";
import { PostgresCatalogRepository } from "../../lib/server/repositories/catalog-repository.ts";
import { PostgresSubmissionRepository } from "../../lib/server/repositories/submission-repository.ts";

const courseId = "00000000-0000-4000-8000-000000000401";
const topicId = "00000000-0000-4000-8000-000000000505";

test("submission request validation trims contract fields and accepts public UUIDs", () => {
  const request = validateCreateSubmissionRequest({
    resourceType: "study_material",
    title: "  Graph Notes  ",
    description: "  BFS and DFS  ",
    courseId,
    topicId,
  });

  assert.deepEqual(request, {
    resourceType: "study_material",
    title: "Graph Notes",
    description: "BFS and DFS",
    courseId,
    topicId,
  });
  assert.equal(validatePublicId(courseId, "courseId"), courseId);
});

test("request validation rejects unknown fields and aggregates field-specific errors", () => {
  assert.throws(
    () =>
      validateCreateSubmissionRequest({
        resourceType: "video",
        title: "   ",
        description: "x".repeat(5001),
        courseId: "not-a-uuid",
        topicId,
        teacherId: "client-controlled",
      }),
    (error) => {
      assert.ok(error instanceof ValidationError);
      assert.deepEqual(Object.keys(error.fieldErrors).sort(), [
        "courseId",
        "description",
        "resourceType",
        "teacherId",
        "title",
      ]);
      return true;
    }
  );
});

test("rejection validation requires a bounded non-blank reason", () => {
  assert.deepEqual(validateRejectSubmissionRequest({ reason: "  Duplicate content.  " }), {
    reason: "Duplicate content.",
  });

  assert.throws(
    () => validateRejectSubmissionRequest({ reason: " " }),
    (error) => error instanceof ValidationError && "reason" in error.fieldErrors
  );
});

test("application, PostgreSQL, and unexpected errors map to safe contract responses", () => {
  assert.deepEqual(mapErrorToApi(new NotFoundError("Submission not found.")), {
    status: 404,
    body: { error: { code: "NOT_FOUND", message: "Submission not found." } },
  });

  assert.deepEqual(mapErrorToApi(new ConflictError("Already reviewed.")), {
    status: 409,
    body: { error: { code: "CONFLICT", message: "Already reviewed." } },
  });

  const duplicate = mapErrorToApi({ code: "23505", detail: "private index and row values" });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, "CONFLICT");
  assert.doesNotMatch(JSON.stringify(duplicate.body), /private index|row values/i);

  const unexpected = mapErrorToApi(new Error("DATABASE_URL contains a secret"));
  assert.deepEqual(unexpected, {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } },
  });
});

test("validation errors preserve field errors in the frozen API envelope", () => {
  const mapped = mapErrorToApi(
    new ValidationError("Request validation failed.", { title: ["title is required."] })
  );

  assert.deepEqual(mapped, {
    status: 400,
    body: {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        fieldErrors: { title: ["title is required."] },
      },
    },
  });
});

test("authorization, transition, and invalid-reference errors use frozen status/code pairs", () => {
  assert.equal(mapErrorToApi(new UnauthenticatedError()).status, 401);
  assert.equal(mapErrorToApi(new ForbiddenError()).body.error.code, "FORBIDDEN");
  assert.equal(
    mapErrorToApi(new InvalidTransitionError()).body.error.code,
    "INVALID_TRANSITION"
  );

  const invalidReference = mapErrorToApi({ code: "23503", detail: "private foreign key" });
  assert.equal(invalidReference.status, 400);
  assert.equal(invalidReference.body.error.code, "VALIDATION_ERROR");
  assert.doesNotMatch(JSON.stringify(invalidReference.body), /foreign key/i);
});

test("non-object request bodies and malformed standalone IDs are rejected", () => {
  assert.throws(
    () => validateCreateSubmissionRequest(null),
    (error) => error instanceof ValidationError && "body" in error.fieldErrors
  );
  assert.throws(
    () => validatePublicId("not-a-uuid", "submissionId"),
    (error) => error instanceof ValidationError && "submissionId" in error.fieldErrors
  );
});

test("transaction helper commits on success and always releases its client", async () => {
  const calls = [];
  const client = {
    async query(query) {
      calls.push(typeof query === "string" ? query : query.text);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  const pool = { async connect() { calls.push("CONNECT"); return client; } };

  const result = await withTransaction(
    pool,
    async (transaction) => {
      await transaction.query("SELECT work");
      return "done";
    },
    { isolationLevel: "serializable", readOnly: true, deferrable: true }
  );

  assert.equal(result, "done");
  assert.deepEqual(calls, [
    "CONNECT",
    "BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE READ ONLY DEFERRABLE",
    "SELECT work",
    "COMMIT",
    "RELEASE",
  ]);
});

test("transaction helper rolls back the original error and releases its client", async () => {
  const calls = [];
  const client = {
    async query(query) {
      calls.push(query);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push("RELEASE");
    },
  };
  const pool = { async connect() { calls.push("CONNECT"); return client; } };
  const failure = new Error("service failed");

  await assert.rejects(
    withTransaction(pool, async () => {
      throw failure;
    }),
    (error) => error === failure
  );
  assert.deepEqual(calls, ["CONNECT", "BEGIN", "ROLLBACK", "RELEASE"]);
});

test("deferrable transactions must be serializable and read-only", async () => {
  let connectCount = 0;
  const pool = { async connect() { connectCount += 1; throw new Error("must not connect"); } };

  await assert.rejects(
    withTransaction(pool, async () => undefined, { deferrable: true }),
    /DEFERRABLE requires SERIALIZABLE and READ ONLY/
  );
  assert.equal(connectCount, 0);
});

test("transaction helper reports rollback failure and still releases the client", async () => {
  let released = false;
  const client = {
    async query(query) {
      if (query === "ROLLBACK") throw new Error("rollback failed");
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    },
  };
  const pool = { async connect() { return client; } };

  await assert.rejects(
    withTransaction(pool, async () => {
      throw new Error("operation failed");
    }),
    (error) => error instanceof AggregateError && error.errors.length === 2
  );
  assert.equal(released, true);
});

test("catalog repository uses typed prepared queries and returns domain models", async () => {
  const seen = [];
  const executor = {
    async query(config) {
      seen.push(config);
      if (config.name === "catalog-list-active-courses-v2") {
        return {
          rows: [
            {
              course_public_id: courseId,
              course_code: "CSE-211",
              course_name: "Data Structures and Algorithms",
              course_description: "Core structures.",
              university_public_id: "00000000-0000-4000-8000-000000000201",
              university_name: "Bangladesh University of Engineering and Technology",
              university_short_name: "BUET",
              semester_public_id: "00000000-0000-4000-8000-000000000301",
              semester_name: "Level 2, Term 1",
              semester_sequence_order: 3,
            },
          ],
          rowCount: 1,
        };
      }

      if (config.name === "catalog-list-active-topics-v1") {
        return {
          rows: [
            {
              topic_public_id: topicId,
              course_public_id: courseId,
              topic_slug: "graph",
              topic_name: "Graph",
              topic_description: "Graph algorithms.",
              topic_sequence_order: 5,
              subtopics: [
                {
                  public_id: "00000000-0000-4000-8000-000000000901",
                  slug: "representations",
                  title: "Graph representations",
                  sequence_order: 1,
                },
              ],
            },
          ],
          rowCount: 1,
        };
      }

      return {
        rows: [
          {
            content_public_id: "00000000-0000-4000-8000-000000000601",
            topic_public_id: topicId,
            course_public_id: courseId,
            resource_type: "question",
            title: "BUET Graph Final 2024",
            description: "Final questions.",
            contributor_public_id: "00000000-0000-4000-8000-000000000102",
            contributor_name: "Dr. Sharif Ahmed",
            publication_year: 2024,
            topics_covered: ["Shortest Paths"],
            file_size_bytes: "2048",
            view_count: "12",
            download_count: "4",
            published_at: new Date("2026-08-21T10:00:00.000Z"),
          },
        ],
        rowCount: 1,
      };
    },
  };
  const repository = new PostgresCatalogRepository(executor);

  const courses = await repository.listCourses();
  const topics = await repository.listTopics(courseId);
  const resources = await repository.listApprovedResources(topicId);

  assert.equal(courses[0].university.shortName, "BUET");
  assert.equal(topics[0].subtopics[0].slug, "representations");
  assert.equal(resources[0].fileSizeBytes, 2048);
  assert.equal(resources[0].views, 12);
  assert.equal(resources[0].uploadedAt.toISOString(), "2026-08-21T10:00:00.000Z");
  assert.deepEqual(seen.map((query) => query.values), [
    [null, null, null],
    [courseId],
    [topicId],
  ]);
  assert.match(seen[2].text, /submission\.status = 'approved'/);
  assert.match(seen[2].text, /content\.is_active/);
  assert.doesNotMatch(seen[2].text, /SELECT\s+\*/i);
});

test("submission repository maps nullable review fields without exposing row names", async () => {
  const executor = {
    async query(config) {
      assert.equal(config.name, "submission-list-by-teacher-v1");
      assert.deepEqual(config.values, ["00000000-0000-4000-8000-000000000102"]);
      return {
        rows: [
          {
            submission_public_id: "00000000-0000-4000-8000-000000000702",
            teacher_public_id: "00000000-0000-4000-8000-000000000102",
            teacher_name: "Dr. Sharif Ahmed",
            resource_type: "study_material",
            title: "Dynamic Programming Notes",
            description: "Memoization and tabulation.",
            course_public_id: courseId,
            course_code: "CSE-211",
            topic_public_id: topicId,
            topic_name: "Graph",
            status: "pending",
            submitted_at: new Date("2026-08-29T09:00:00.000Z"),
            reviewer_public_id: null,
            reviewer_name: null,
            reviewed_at: null,
            rejection_reason: null,
          },
        ],
        rowCount: 1,
      };
    },
  };
  const repository = new PostgresSubmissionRepository(executor);

  const submissions = await repository.listByTeacher("00000000-0000-4000-8000-000000000102");

  assert.equal(submissions[0].status, "pending");
  assert.equal(submissions[0].reviewedBy, null);
  assert.equal(submissions[0].reviewedAt, null);
  assert.equal("submitted_at" in submissions[0], false);
});

test("submission repository returns null for an unknown public ID", async () => {
  const executor = {
    async query(config) {
      assert.equal(config.name, "submission-find-by-public-id-v1");
      return { rows: [], rowCount: 0 };
    },
  };
  const repository = new PostgresSubmissionRepository(executor);

  assert.equal(
    await repository.findByPublicId("00000000-0000-4000-8000-000000000799"),
    null
  );
});

test("API mappers emit contract DTOs with camelCase fields and UTC timestamps", () => {
  const course = {
    id: courseId,
    code: "CSE-211",
    name: "Data Structures and Algorithms",
    description: "Core structures.",
    university: {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Bangladesh University of Engineering and Technology",
      shortName: "BUET",
    },
    semester: {
      id: "00000000-0000-4000-8000-000000000301",
      universityId: "00000000-0000-4000-8000-000000000201",
      name: "Level 2, Term 1",
      sortOrder: 3,
    },
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
    id: "00000000-0000-4000-8000-000000000601",
    topicId,
    courseId,
    type: "question",
    title: "BUET Graph Final 2024",
    description: "Final questions.",
    addedBy: { id: "00000000-0000-4000-8000-000000000102", name: "Teacher" },
    year: 2024,
    topicsCovered: [],
    fileSizeBytes: null,
    views: 0,
    downloads: 0,
    uploadedAt: new Date("2026-08-21T10:00:00.000Z"),
  };
  const submission = {
    id: "00000000-0000-4000-8000-000000000702",
    teacher: resource.addedBy,
    resourceType: "study_material",
    title: "Notes",
    description: "Description",
    courseId,
    courseCode: "CSE-211",
    topicId,
    topicName: "Graph",
    status: "pending",
    submittedAt: new Date("2026-08-29T09:00:00.000Z"),
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
  };

  assert.equal(toCourseDto(course).semester.universityId, course.university.id);
  assert.deepEqual(toTopicDto(topic).subtopics, ["Graph representations"]);
  assert.deepEqual(toApprovedResourceDto(resource), {
    id: resource.id,
    topicId,
    courseId,
    type: "question",
    title: resource.title,
    description: resource.description,
    addedBy: resource.addedBy,
    year: 2024,
    topicsCovered: [],
    fileSizeBytes: null,
    views: 0,
    downloads: 0,
    uploadedAt: "2026-08-21T10:00:00.000Z",
    publicationStatus: "published",
    isActive: true,
  });
  assert.equal(toSubmissionDto(submission).reviewedAt, null);
  assert.deepEqual(
    toEnrollmentDto({
      id: "00000000-0000-4000-8000-000000001001",
      userId: "00000000-0000-4000-8000-000000000101",
      courseId,
      status: "active",
      enrolledAt: new Date("2026-08-01T08:00:00.000Z"),
    }),
    {
      id: "00000000-0000-4000-8000-000000001001",
      userId: "00000000-0000-4000-8000-000000000101",
      courseId,
      status: "active",
      enrolledAt: "2026-08-01T08:00:00.000Z",
    }
  );
});
