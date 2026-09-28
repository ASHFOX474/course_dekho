import assert from "node:assert/strict";
import test from "node:test";

import { PostgresWorkspaceRepository } from "../../lib/server/repositories/workspace-repository.ts";
import { WorkspaceService } from "../../lib/server/workspace/service.ts";

const student = {
  id: "00000000-0000-4000-8000-000000000101",
  name: "Student",
  username: "learner",
  email: "student@example.com",
  role: "learner",
};
const teacher = { ...student, id: "00000000-0000-4000-8000-000000000102", role: "contributor" };
const admin = { ...student, id: "00000000-0000-4000-8000-000000000103", role: "admin" };
const courseId = "00000000-0000-4000-8000-000000000401";
const topicId = "00000000-0000-4000-8000-000000000501";
const resourceId = "00000000-0000-4000-8000-000000000601";
const submissionId = "00000000-0000-4000-8000-000000000701";
const bookmarkId = "00000000-0000-4000-8000-000000001201";
const at = new Date("2026-09-01T00:00:00.000Z");

const profileRow = {
  user_public_id: student.id,
  user_name: student.name,
  user_email: student.email,
  user_username: student.username,
  user_role: "learner",
  university_public_id: "00000000-0000-4000-8000-000000000201",
  university_name: "University",
  university_short_name: "UNI",
  department: "CSE",
  year_of_study: 2,
  designation: null,
};
const learningRow = {
  enrollment_public_id: "00000000-0000-4000-8000-000000001001",
  course_public_id: courseId,
  course_code: "CSE-211",
  course_name: "Algorithms",
  enrollment_status: "active",
  enrolled_at: at,
  progress_percent: 60,
};
const enrollmentRequestRow = {
  enrollment_public_id: learningRow.enrollment_public_id,
  user_public_id: student.id,
  user_name: student.name,
  user_email: student.email,
  course_public_id: courseId,
  course_code: learningRow.course_code,
  course_name: learningRow.course_name,
  review_status: "pending",
  requested_at: at,
  reviewer_public_id: null,
  reviewer_name: null,
  reviewed_at: null,
  rejection_reason: null,
};
const enrollmentRequest = {
  id: learningRow.enrollment_public_id,
  user: { id: student.id, name: student.name },
  userEmail: student.email,
  courseId,
  courseCode: learningRow.course_code,
  courseName: learningRow.course_name,
  status: "pending",
  requestedAt: at,
  reviewedBy: null,
  reviewedAt: null,
  rejectionReason: null,
};
const progressRow = {
  progress_public_id: "00000000-0000-4000-8000-000000001101",
  topic_public_id: topicId,
  topic_name: "Graph",
  course_public_id: courseId,
  course_code: "CSE-211",
  course_name: "Algorithms",
  progress_percent: 60,
  is_completed: false,
  last_accessed_at: at,
};
const bookmarkRow = {
  bookmark_public_id: bookmarkId,
  target_type: "resource",
  target_public_id: resourceId,
  title: "Graph Questions",
  subtitle: "CSE-211 > Graph",
  resource_type: "question",
  course_public_id: courseId,
  created_at: at,
};
const accessRow = {
  access_public_id: "00000000-0000-4000-8000-000000001301",
  content_public_id: resourceId,
  title: "Graph Questions",
  resource_type: "question",
  course_public_id: courseId,
  course_code: "CSE-211",
  topic_public_id: topicId,
  topic_name: "Graph",
  accessed_at: at,
};
const solvedRow = {
  solved_public_id: "00000000-0000-4000-8000-000000001401",
  content_public_id: resourceId,
  title: "Graph Questions",
  course_public_id: courseId,
  course_code: "CSE-211",
  topic_public_id: topicId,
  topic_name: "Graph",
  solved_at: at,
};
const submissionRow = {
  submission_public_id: submissionId,
  contributor_public_id: teacher.id,
  contributor_name: teacher.name,
  resource_type: "question",
  title: "Graph Questions",
  description: "Question set",
  course_public_id: courseId,
  course_code: "CSE-211",
  topic_public_id: topicId,
  topic_name: "Graph",
  status: "approved",
  submitted_at: at,
  reviewer_public_id: admin.id,
  reviewer_name: admin.name,
  reviewed_at: at,
  rejection_reason: null,
};

function result(rows = [], rowCount = rows.length) {
  return { rows, rowCount };
}

test("workspace repository executes and maps every database workflow", async () => {
  const calls = [];
  const executor = {
    async query(statement) {
      assert.equal(typeof statement, "object");
      assert.ok(statement.name);
      assert.ok(Array.isArray(statement.values));
      calls.push(statement.name);
      switch (statement.name) {
        case "workspace-profile-v1": return result([profileRow]);
        case "workspace-learning-courses-v2": return result([learningRow]);
        case "workspace-topic-progress-v2": return result([progressRow]);
        case "workspace-user-enrollment-requests-v1": return result([enrollmentRequestRow]);
        case "workspace-bookmarks-v1": return result([bookmarkRow]);
        case "workspace-create-resource-bookmark-v1": return result([{ bookmark_public_id: bookmarkId }]);
        case "workspace-delete-bookmark-v1": return result([{ internal_id: "1" }]);
        case "workspace-create-enrollment-request-v2": return result([{ enrollment_public_id: learningRow.enrollment_public_id }]);
        case "workspace-admin-enrollment-requests-v1": return result([enrollmentRequestRow]);
        case "workspace-review-enrollment-v1": return result([{ internal_id: "1" }]);
        case "workspace-resource-completions-v1": return result([{ content_public_id: resourceId }]);
        case "workspace-complete-resource-v1": return result([{ internal_id: "1" }]);
        case "workspace-record-folder-activity-v1": return result([{ internal_id: "1" }]);
        case "workspace-continue-learning-v1": return result([{ course_public_id: courseId, topic_public_id: topicId }]);
        case "workspace-display-preference-v1": return result([{ theme: "dark" }]);
        case "workspace-update-display-preference-v1": return result([{ internal_id: "1" }]);
        case "workspace-access-history-v1": return result([accessRow]);
        case "workspace-record-access-v1": return result([{ internal_id: "1" }]);
        case "workspace-solved-questions-v1": return result([solvedRow]);
        case "workspace-mark-solved-v1": return result([{ internal_id: "1" }]);
        case "workspace-replace-approved-content-detail-v1": return result([{ internal_id: "20" }]);
        case "submission-list-by-contributor-v1": return result([submissionRow]);
        case "workspace-list-all-submissions-v1": return result([submissionRow]);
        case "submission-find-by-public-id-v1": return result([submissionRow]);
        case "workspace-create-submission-v2": return result([{ submission_public_id: submissionId }]);
        case "workspace-lock-pending-submission-v1": return result([{ submission_internal_id: "10", target_content_internal_id: null }]);
        case "workspace-mark-submission-approved-v1": return result([{ internal_id: "10" }]);
        case "workspace-create-content-for-approved-submission-v1": return result([{ internal_id: "20" }]);
        case "workspace-create-approved-content-revision-v1": return result([{ internal_id: "30" }]);
        case "workspace-publish-approved-content-v1": return result([{ internal_id: "20" }]);
        case "workspace-audit-approved-submission-v1": return result([{ internal_id: "40" }]);
        case "workspace-reject-submission-v1": return result([{ internal_id: "40" }]);
        case "workspace-admin-stats-v1": return result([{ user_count: 3, course_count: 1, published_resource_count: 1, submission_count: 3 }]);
        default: throw new Error(`Unexpected query ${statement.name}`);
      }
    },
  };
  const repository = new PostgresWorkspaceRepository(executor);

  assert.equal((await repository.getProfile(student.id)).user.id, student.id);
  assert.equal((await repository.getLearning(student.id)).topics[0].topicId, topicId);
  assert.equal((await repository.listBookmarks(student.id))[0].id, bookmarkId);
  assert.equal((await repository.createBookmark(student.id, "resource", resourceId)).targetId, resourceId);
  assert.equal(await repository.deleteBookmark(student.id, bookmarkId), true);
  assert.equal((await repository.createEnrollment(student.id, courseId)).id, learningRow.enrollment_public_id);
  assert.equal((await repository.listEnrollmentRequestsForAdmin())[0].status, "pending");
  assert.equal(await repository.reviewEnrollment({ enrollmentId: learningRow.enrollment_public_id, reviewerId: admin.id, decision: "approved", reason: null, reviewedAt: at }), true);
  assert.deepEqual(await repository.listResourceCompletions(student.id, topicId), [resourceId]);
  assert.equal(await repository.setResourceCompletion(student.id, resourceId, true, at), true);
  assert.equal(await repository.recordFolderActivity(student.id, courseId, topicId, at), true);
  assert.equal((await repository.getContinueLearning(student.id)).topicId, topicId);
  assert.equal(await repository.getDisplayPreference(student.id), "dark");
  assert.equal(await repository.updateDisplayPreference(student.id, "dark", at), true);
  assert.equal((await repository.listAccessHistory(student.id))[0].resourceId, resourceId);
  assert.equal(await repository.recordAccess(student.id, resourceId), true);
  assert.equal((await repository.listSolvedQuestions(student.id))[0].resourceId, resourceId);
  assert.equal(await repository.markSolved(student.id, resourceId), true);
  assert.equal((await repository.listSubmissionsByContributor(teacher.id))[0].id, submissionId);
  assert.equal((await repository.listAllSubmissions())[0].id, submissionId);
  assert.equal((await repository.findSubmission(submissionId)).id, submissionId);
  assert.equal((await repository.createSubmission({ contributorId: teacher.id, resourceType: "question", title: "Graph", description: "Set", courseId, topicId })).id, submissionId);
  assert.equal((await repository.approveSubmission({ submissionId, reviewerId: admin.id, reviewedAt: at })).status, "approved");
  assert.equal((await repository.rejectSubmission({ submissionId, reviewerId: admin.id, reason: "Duplicate", reviewedAt: at })).id, submissionId);
  assert.deepEqual(await repository.getAdminStats(), { userCount: 3, courseCount: 1, publishedResourceCount: 1, submissionCount: 3 });
  assert.ok(calls.includes("workspace-create-approved-content-revision-v1"));
});

test("workspace service enforces role-scoped success paths over its repository", async () => {
  const profile = {
    user: student,
    university: { id: profileRow.university_public_id, name: "University", shortName: "UNI" },
    department: "CSE",
    yearOfStudy: 2,
    designation: null,
  };
  const learning = { courses: [], topics: [], enrollmentRequests: [] };
  const bookmark = { id: bookmarkId, targetType: "resource", targetId: resourceId, title: "Graph", subtitle: "CSE-211", resourceType: "question", courseId, createdAt: at };
  const submission = {
    id: submissionId,
    contributor: { id: teacher.id, name: teacher.name },
    resourceType: "question",
    title: "Graph",
    description: "Set",
    courseId,
    courseCode: "CSE-211",
    topicId,
    topicName: "Graph",
    status: "approved",
    submittedAt: at,
    reviewedBy: { id: admin.id, name: admin.name },
    reviewedAt: at,
    rejectionReason: null,
  };
  const repository = {
    async getProfile() { return profile; },
    async getLearning() { return learning; },
    async listBookmarks() { return [bookmark]; },
    async createBookmark() { return bookmark; },
    async deleteBookmark() { return true; },
    async createEnrollment() { return enrollmentRequest; },
    async listEnrollmentRequestsForAdmin() { return [enrollmentRequest]; },
    async reviewEnrollment() { return true; },
    async listResourceCompletions() { return [resourceId]; },
    async setResourceCompletion() { return true; },
    async recordFolderActivity() { return true; },
    async getContinueLearning() { return { href: `/courses/${courseId}/topics/${topicId}`, courseId, topicId }; },
    async getDisplayPreference() { return "dark"; },
    async updateDisplayPreference() { return true; },
    async listAccessHistory() { return []; },
    async recordAccess() { return true; },
    async listSolvedQuestions() { return []; },
    async markSolved() { return true; },
    async listSubmissionsByContributor() { return [submission]; },
    async listAllSubmissions() { return [submission]; },
    async findSubmission() { return submission; },
    async createSubmission() { return submission; },
    async approveSubmission() { return submission; },
    async rejectSubmission() { return submission; },
    async getAdminStats() { return { userCount: 3, courseCount: 1, publishedResourceCount: 1, submissionCount: 3 }; },
  };
  const client = { async query() { return result(); }, release() {} };
  const pool = { async query() { return result(); }, async connect() { return client; } };
  const service = new WorkspaceService({ pool, repositoryFactory: () => repository, now: () => at });

  assert.equal((await service.getProfile(student)).user.id, student.id);
  assert.equal(await service.getLearning(student), learning);
  assert.equal((await service.listBookmarks(student))[0], bookmark);
  assert.equal(await service.createBookmark(student, { targetType: "resource", targetId: resourceId }), bookmark);
  await service.deleteBookmark(student, bookmarkId);
  assert.equal(await service.createEnrollment(student, courseId), enrollmentRequest);
  assert.equal((await service.listEnrollmentRequests(admin))[0], enrollmentRequest);
  assert.equal(await service.reviewEnrollment(admin, enrollmentRequest.id, "approved", null), enrollmentRequest);
  assert.deepEqual(await service.listResourceCompletions(student, topicId), [resourceId]);
  assert.deepEqual(await service.setResourceCompletion(student, resourceId, true), { resourceId, completed: true });
  await service.recordFolderActivity(student, courseId, topicId);
  assert.equal((await service.getContinueLearning(student)).topicId, topicId);
  assert.deepEqual(await service.getDisplayPreference(student), { theme: "dark" });
  assert.deepEqual(await service.updateDisplayPreference(student, "dark"), { theme: "dark" });
  assert.deepEqual(await service.listAccessHistory(student), []);
  await service.recordAccess(student, resourceId);
  assert.deepEqual(await service.listSolvedQuestions(student), []);
  assert.deepEqual(await service.markSolved(student, resourceId), []);
  assert.equal((await service.listSubmissions(teacher))[0], submission);
  assert.equal((await service.listSubmissions(admin))[0], submission);
  assert.equal(await service.createSubmission(teacher, { resourceType: "question", title: "Graph", description: "Set", courseId, topicId }), submission);
  assert.equal(await service.approveSubmission(admin, submissionId), submission);
  assert.equal(await service.rejectSubmission(admin, submissionId, "Duplicate"), submission);
  assert.equal((await service.getAdminStats(admin)).userCount, 3);
});

test("enrollment review and completion permissions fail closed by role and transition", async () => {
  const repository = {
    async createEnrollment() { return enrollmentRequest; },
    async listEnrollmentRequestsForAdmin() { return [enrollmentRequest]; },
    async reviewEnrollment() { return false; },
    async setResourceCompletion() { return false; },
  };
  const client = { async query() { return result(); }, release() {} };
  const pool = { async query() { return result(); }, async connect() { return client; } };
  const service = new WorkspaceService({ pool, repositoryFactory: () => repository, now: () => at });

  await assert.rejects(service.listEnrollmentRequests(student), error => error.code === "FORBIDDEN");
  await assert.rejects(service.reviewEnrollment(student, enrollmentRequest.id, "approved", null), error => error.code === "FORBIDDEN");
  await assert.rejects(service.reviewEnrollment(admin, enrollmentRequest.id, "rejected", ""), error => error.code === "VALIDATION_ERROR");
  await assert.rejects(service.reviewEnrollment(admin, enrollmentRequest.id, "approved", null), error => error.code === "INVALID_TRANSITION");
  await assert.rejects(service.setResourceCompletion(student, resourceId, true), error => error.code === "CONFLICT");
  await assert.rejects(service.setResourceCompletion(admin, resourceId, true), error => error.code === "FORBIDDEN");
});

test("contributors cannot enroll or access learning tracking, but retain bookmarks and history", async () => {
  const service = new WorkspaceService({
    pool: {},
    repositoryFactory: () => ({
      async listBookmarks() { return [bookmarkRow]; },
      async createBookmark() { return bookmarkRow; },
      async deleteBookmark() { return true; },
      async listAccessHistory() { return [accessRow]; },
      async recordAccess() { return true; },
    }),
  });
  const learnerActions = [
    () => service.getLearning(teacher),
    () => service.createEnrollment(teacher, courseId),
    () => service.listResourceCompletions(teacher, topicId),
    () => service.setResourceCompletion(teacher, resourceId, true),
    () => service.setResourceCompletion(teacher, resourceId, false),
    () => service.recordFolderActivity(teacher, courseId, topicId),
    () => service.getContinueLearning(teacher),
    () => service.listSolvedQuestions(teacher),
    () => service.markSolved(teacher, resourceId),
  ];
  for (const action of learnerActions) {
    await assert.rejects(action(), error => error.code === "FORBIDDEN");
  }
  assert.deepEqual(await service.listBookmarks(teacher), [bookmarkRow]);
  assert.equal(await service.createBookmark(teacher, { targetType: "resource", targetId: resourceId }), bookmarkRow);
  await service.deleteBookmark(teacher, bookmarkId);
  assert.deepEqual(await service.listAccessHistory(teacher), [accessRow]);
  await service.recordAccess(teacher, resourceId);
});


test("approval detail SQL covers every supported resource subtype", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../../lib/server/db/queries/workspace-queries.ts", import.meta.url), "utf8");
  for (const table of ["study_material_detail", "practice_material_detail", "book_detail", "tutorial_detail", "slide_detail", "question_detail", "leetcode_problem_detail"]) {
    assert.match(source, new RegExp(table));
  }
});
