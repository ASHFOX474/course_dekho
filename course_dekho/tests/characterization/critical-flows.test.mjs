import assert from "node:assert/strict";
import test from "node:test";

import {
  WorkflowPolicyError,
  approvePendingSubmission,
  can,
  createPendingSubmission,
  isApprovedContentVisible,
  isEnrollmentActive,
  rejectPendingSubmission,
} from "../../lib/domain/critical-behavior.ts";

const learner = {
  id: "user-learner",
  name: "Learner User",
  role: "learner",
};

const contributor = {
  id: "user-contributor",
  name: "Contributor User",
  role: "contributor",
};

const admin = {
  id: "user-admin",
  name: "Admin User",
  role: "admin",
};

const submissionInput = {
  resourceType: "Study Material",
  title: "  Graph Notes  ",
  description: "  BFS and DFS notes.  ",
  courseId: "course-dsa",
  courseCode: "CSE-211",
  topicId: "topic-graph",
  topicName: "Graph",
};

const submittedAt = "2026-08-31T10:00:00.000Z";
const reviewedAt = "2026-08-31T11:00:00.000Z";

function createSubmission() {
  return createPendingSubmission(contributor, submissionInput, {
    submissionId: "submission-1",
    now: submittedAt,
  });
}

function assertPolicyError(expectedCode) {
  return (error) => {
    assert.ok(error instanceof WorkflowPolicyError);
    assert.equal(error.code, expectedCode);
    return true;
  };
}

test("role permissions preserve learner, contributor, and admin boundaries", () => {
  assert.equal(can("learner", "browse_approved_content"), true);
  assert.equal(can("learner", "bookmark_content"), true);
  assert.equal(can("learner", "submit_content"), false);
  assert.equal(can("learner", "manage_academic_structure"), false);

  assert.equal(can("contributor", "browse_approved_content"), true);
  assert.equal(can("contributor", "bookmark_content"), true);
  assert.equal(can("contributor", "submit_content"), true);
  assert.equal(can("contributor", "approve_submission"), false);

  assert.equal(can("admin", "browse_approved_content"), true);
  assert.equal(can("admin", "approve_submission"), true);
  assert.equal(can("admin", "manage_academic_structure"), true);
  assert.equal(can("admin", "manage_users"), true);
});

test("learners can see only active content produced by an approved submission", () => {
  assert.equal(isApprovedContentVisible({ submissionStatus: "pending", isActive: true }), false);
  assert.equal(isApprovedContentVisible({ submissionStatus: "rejected", isActive: true }), false);
  assert.equal(isApprovedContentVisible({ submissionStatus: "approved", isActive: false }), false);
  assert.equal(isApprovedContentVisible({ submissionStatus: "approved", isActive: true }), true);
});

test("enrollment is explicit and is not inferred from progress", () => {
  assert.equal(isEnrollmentActive(undefined), false);
  assert.equal(isEnrollmentActive({ status: "active" }), true);
  assert.equal(isEnrollmentActive({ status: "completed" }), true);
  assert.equal(isEnrollmentActive({ status: "dropped" }), false);
});

test("a contributor submission starts pending and records server-owned identity and time", () => {
  const submission = createSubmission();

  assert.deepEqual(submission, {
    id: "submission-1",
    contributorId: contributor.id,
    contributorName: contributor.name,
    resourceType: "Study Material",
    title: "Graph Notes",
    description: "BFS and DFS notes.",
    courseId: "course-dsa",
    courseCode: "CSE-211",
    topicId: "topic-graph",
    topicName: "Graph",
    status: "pending",
    submittedAt,
  });
});

test("learners and admins cannot create contributor submissions", () => {
  assert.throws(
    () =>
      createPendingSubmission(learner, submissionInput, {
        submissionId: "submission-2",
        now: submittedAt,
      }),
    assertPolicyError("FORBIDDEN")
  );

  assert.throws(
    () =>
      createPendingSubmission(admin, submissionInput, {
        submissionId: "submission-3",
        now: submittedAt,
      }),
    assertPolicyError("FORBIDDEN")
  );
});

test("blank contributor submission fields are rejected", () => {
  assert.throws(
    () =>
      createPendingSubmission(contributor, { ...submissionInput, title: "   " }, {
        submissionId: "submission-4",
        now: submittedAt,
      }),
    assertPolicyError("VALIDATION_ERROR")
  );
});

test("admin approval publishes one resource and records review metadata", () => {
  const result = approvePendingSubmission(admin, createSubmission(), {
    resourceId: "resource-1",
    now: reviewedAt,
  });

  assert.equal(result.submission.status, "approved");
  assert.equal(result.submission.reviewedById, admin.id);
  assert.equal(result.submission.reviewedByName, admin.name);
  assert.equal(result.submission.reviewedAt, reviewedAt);
  assert.equal(result.resource.id, "resource-1");
  assert.equal(result.resource.topicId, "topic-graph");
  assert.equal(result.resource.addedById, contributor.id);
  assert.equal(result.resource.title, "Graph Notes");
  assert.equal(result.resource.uploadedAt, reviewedAt);
});

test("non-admin approval and repeated approval are rejected", () => {
  const submission = createSubmission();

  assert.throws(
    () => approvePendingSubmission(contributor, submission, { resourceId: "resource-2", now: reviewedAt }),
    assertPolicyError("FORBIDDEN")
  );

  const approved = approvePendingSubmission(admin, submission, {
    resourceId: "resource-2",
    now: reviewedAt,
  }).submission;

  assert.throws(
    () => approvePendingSubmission(admin, approved, { resourceId: "resource-3", now: reviewedAt }),
    assertPolicyError("INVALID_TRANSITION")
  );
});

test("admin rejection requires and preserves a reason", () => {
  const submission = createSubmission();

  assert.throws(
    () => rejectPendingSubmission(admin, submission, "   ", reviewedAt),
    assertPolicyError("VALIDATION_ERROR")
  );

  const rejected = rejectPendingSubmission(admin, submission, "  Duplicate content.  ", reviewedAt);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Duplicate content.");
  assert.equal(rejected.reviewedById, admin.id);
  assert.equal(rejected.reviewedAt, reviewedAt);
});
