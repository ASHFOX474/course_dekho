import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contractUrl = new URL("../../contracts/course-dekho.v1.openapi.json", import.meta.url);

async function loadContract() {
  return JSON.parse(await readFile(contractUrl, "utf8"));
}

function collectReferences(value, references = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, references);
    return references;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref") references.push(child);
      else collectReferences(child, references);
    }
  }

  return references;
}

test("the v1 contract exposes the three critical user journeys", async () => {
  const contract = await loadContract();

  assert.equal(contract.openapi, "3.1.0");
  assert.ok(contract.paths["/api/v1/universities"].get);
  assert.ok(contract.paths["/api/v1/universities/{universityId}/semesters"].get);
  assert.ok(contract.paths["/api/v1/courses"].get);
  assert.ok(contract.paths["/api/v1/courses/{courseId}"].get);
  assert.ok(contract.paths["/api/v1/topics/{topicId}/resources"].get);
  assert.ok(contract.paths["/api/v1/courses/{courseId}/resources"].get);
  assert.ok(contract.paths["/api/v1/resources/{resourceId}"].get);
  assert.ok(contract.paths["/api/v1/enrollments"].post);
  assert.ok(contract.paths["/api/v1/submissions"].post);
  assert.ok(contract.paths["/api/v1/admin/submissions/{submissionId}/approve"].post);
  assert.ok(contract.paths["/api/v1/admin/submissions/{submissionId}/reject"].post);
});

test("contract identifiers are opaque strings and public users never expose passwords", async () => {
  const contract = await loadContract();
  const schemas = contract.components.schemas;

  for (const schemaName of ["UserSummary", "CourseSummary", "TopicSummary", "ApprovedResource", "Enrollment", "Submission"]) {
    assert.equal(schemas[schemaName].properties.id.type, "string", `${schemaName}.id must remain an opaque string`);
  }

  assert.equal("password" in schemas.UserSummary.properties, false);
  assert.equal("passwordHash" in schemas.UserSummary.properties, false);
});

test("contract freezes status, resource-type, and error enums", async () => {
  const contract = await loadContract();
  const schemas = contract.components.schemas;

  assert.deepEqual(schemas.UserRole.enum, ["student", "teacher", "admin"]);
  assert.deepEqual(schemas.EnrollmentStatus.enum, ["active", "completed", "dropped"]);
  assert.deepEqual(schemas.SubmissionStatus.enum, ["pending", "approved", "rejected"]);
  assert.deepEqual(schemas.ResourceType.enum, [
    "study_material",
    "practice_material",
    "book",
    "tutorial",
    "slide",
    "question",
    "leetcode_problem",
  ]);
  assert.ok(schemas.ApiError.properties.error.properties.code.enum.includes("FORBIDDEN"));
  assert.ok(schemas.ApiError.properties.error.properties.code.enum.includes("INVALID_TRANSITION"));
});

test("contract freezes the role permission matrix", async () => {
  const contract = await loadContract();

  assert.deepEqual(contract["x-role-permissions"], {
    student: [
      "browse_approved_content",
      "bookmark_content",
      "track_progress",
      "solve_question",
      "view_learning_history",
    ],
    teacher: [
      "browse_approved_content",
      "bookmark_content",
      "track_progress",
      "solve_question",
      "view_learning_history",
      "submit_content",
      "view_own_submissions",
    ],
    admin: [
      "browse_approved_content",
      "approve_submission",
      "reject_submission",
      "manage_academic_structure",
      "manage_resources",
      "manage_users",
    ],
  });
});

test("all contract references stay inside the allowlisted local components tree and resolve", async () => {
  const contract = await loadContract();
  const references = collectReferences(contract);

  assert.ok(references.length > 0);
  for (const reference of references) {
    assert.match(reference, /^#\/components\/(schemas|responses|parameters)\/[A-Za-z][A-Za-z0-9]*$/);

    const target = reference
      .slice(2)
      .split("/")
      .reduce((value, segment) => value?.[segment], contract);
    assert.ok(target, `Unresolved contract reference: ${reference}`);
  }
});

test("each protected operation declares the permission enforced by its future provider", async () => {
  const contract = await loadContract();

  assert.equal(contract.paths["/api/v1/universities"].get["x-permission"], "browse_approved_content");
  assert.equal(contract.paths["/api/v1/courses"].get["x-permission"], "browse_approved_content");
  assert.equal(
    contract.paths["/api/v1/topics/{topicId}/resources"].get["x-permission"],
    "browse_approved_content"
  );
  assert.equal(contract.paths["/api/v1/submissions"].post["x-permission"], "submit_content");
  assert.equal(
    contract.paths["/api/v1/admin/submissions/{submissionId}/approve"].post["x-permission"],
    "approve_submission"
  );
  assert.equal(
    contract.paths["/api/v1/admin/submissions/{submissionId}/reject"].post["x-permission"],
    "reject_submission"
  );
});

test("approved-resource responses cannot represent pending or rejected content", async () => {
  const contract = await loadContract();
  const resource = contract.components.schemas.ApprovedResource;

  assert.equal(resource.properties.publicationStatus.const, "published");
  assert.ok(resource.required.includes("publicationStatus"));
  assert.ok(resource.required.includes("isActive"));
});

test("the v1 contract defines registration, login, logout, and cookie sessions", async () => {
  const contract = await loadContract();

  assert.ok(contract.paths["/api/v1/auth/register"].post);
  assert.ok(contract.paths["/api/v1/auth/login"].post);
  assert.ok(contract.paths["/api/v1/auth/logout"].post);
  assert.ok(contract.paths["/api/v1/session"].get);
  assert.deepEqual(contract.paths["/api/v1/auth/register"].post.security, []);
  assert.deepEqual(contract.paths["/api/v1/auth/login"].post.security, []);
  assert.deepEqual(contract.paths["/api/v1/auth/logout"].post.security, [
    { SessionCookie: [] },
  ]);
  assert.deepEqual(contract.paths["/api/v1/session"].get.security, [
    { SessionCookie: [] },
  ]);
  assert.deepEqual(contract.components.securitySchemes.SessionCookie, {
    type: "apiKey",
    in: "cookie",
    name: "course_dekho_session",
  });
});

test("public registration cannot create admins and passwords are write-only", async () => {
  const contract = await loadContract();
  const schemas = contract.components.schemas;

  assert.deepEqual(schemas.SelfRegistrationRole.enum, ["student", "teacher"]);
  assert.equal(
    schemas.RegisterRequest.properties.role.$ref,
    "#/components/schemas/SelfRegistrationRole"
  );
  assert.equal(schemas.RegisterRequest.properties.password.writeOnly, true);
  assert.equal(schemas.RegisterRequest.properties.password.minLength, 12);
  assert.equal(schemas.LoginRequest.properties.password.writeOnly, true);
  assert.equal("password" in schemas.UserSummary.properties, false);
  assert.equal("passwordHash" in schemas.UserSummary.properties, false);
});

test("protected operations declare cookie authentication in addition to permissions", async () => {
  const contract = await loadContract();

  for (const [path, method] of [
    ["/api/v1/universities", "get"],
    ["/api/v1/universities/{universityId}/semesters", "get"],
    ["/api/v1/courses", "get"],
    ["/api/v1/courses/{courseId}", "get"],
    ["/api/v1/courses/{courseId}/topics", "get"],
    ["/api/v1/courses/{courseId}/resources", "get"],
    ["/api/v1/topics/{topicId}/resources", "get"],
    ["/api/v1/resources/{resourceId}", "get"],
    ["/api/v1/submissions", "post"],
    ["/api/v1/admin/submissions/{submissionId}/approve", "post"],
    ["/api/v1/admin/submissions/{submissionId}/reject", "post"],
  ]) {
    assert.deepEqual(contract.paths[path][method].security, [{ SessionCookie: [] }]);
  }
});

test("academic read parameters use canonical UUIDs and declare validation responses", async () => {
  const contract = await loadContract();

  for (const parameterName of ["UniversityId", "CourseId", "TopicId", "ResourceId"]) {
    assert.equal(contract.components.parameters[parameterName].schema.format, "uuid");
  }

  for (const path of [
    "/api/v1/universities/{universityId}/semesters",
    "/api/v1/courses/{courseId}",
    "/api/v1/courses/{courseId}/topics",
    "/api/v1/courses/{courseId}/resources",
    "/api/v1/topics/{topicId}/resources",
    "/api/v1/resources/{resourceId}",
  ]) {
    assert.ok(contract.paths[path].get.responses["400"], `${path} must expose validation errors`);
  }

  assert.equal(
    contract.paths["/api/v1/courses"].get.parameters[0].schema.format,
    "uuid"
  );
  assert.equal(
    contract.paths["/api/v1/courses"].get.parameters[1].schema.format,
    "uuid"
  );
});
