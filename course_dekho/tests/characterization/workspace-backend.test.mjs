import assert from "node:assert/strict";
import test from "node:test";

import { PostgresWorkspaceRepository } from "../../lib/server/repositories/workspace-repository.ts";
import { WorkspaceService } from "../../lib/server/workspace/service.ts";

const student = {
  id: "00000000-0000-4000-8000-000000000101",
  name: "Student",
  username: "student",
  email: "student@example.com",
  role: "student",
};
const teacher = { ...student, id: "00000000-0000-4000-8000-000000000102", role: "teacher" };
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
  user_role: "student",
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
  teacher_public_id: teacher.id,
  teacher_name: teacher.name,
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
        case "workspace-learning-courses-v1": return result([learningRow]);
        case "workspace-topic-progress-v1": return result([progressRow]);
        case "workspace-bookmarks-v1": return result([bookmarkRow]);
        case "workspace-create-resource-bookmark-v1": return result([{ bookmark_public_id: bookmarkId }]);
        case "workspace-delete-bookmark-v1": return result([{ internal_id: "1" }]);
        case "workspace-create-enrollment-v1": return result([{ enrollment_public_id: learningRow.enrollment_public_id }]);
        case "workspace-upsert-topic-progress-v1": return result([{ internal_id: "1" }]);
        case "workspace-access-history-v1": return result([accessRow]);
        case "workspace-record-access-v1": return result([{ internal_id: "1" }]);
        case "workspace-solved-questions-v1": return result([solvedRow]);
        case "workspace-mark-solved-v1": return result([{ internal_id: "1" }]);
        case "workspace-replace-approved-content-detail-v1": return result([{ internal_id: "20" }]);
        case "submission-list-by-teacher-v1": return result([submissionRow]);
        case "workspace-list-all-submissions-v1": return result([submissionRow]);
        case "submission-find-by-public-id-v1": return result([submissionRow]);
        case "workspace-create-submission-v1": return result([{ submission_public_id: submissionId }]);
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
  assert.equal(await repository.createEnrollment(student.id, courseId), learningRow.enrollment_public_id);
  assert.equal(await repository.updateProgress(student.id, topicId, 60, at), true);
  assert.equal((await repository.listAccessHistory(student.id))[0].resourceId, resourceId);
  assert.equal(await repository.recordAccess(student.id, resourceId), true);
  assert.equal((await repository.listSolvedQuestions(student.id))[0].resourceId, resourceId);
  assert.equal(await repository.markSolved(student.id, resourceId), true);
  assert.equal((await repository.listSubmissionsByTeacher(teacher.id))[0].id, submissionId);
  assert.equal((await repository.listAllSubmissions())[0].id, submissionId);
  assert.equal((await repository.findSubmission(submissionId)).id, submissionId);
  assert.equal((await repository.createSubmission({ teacherId: teacher.id, resourceType: "question", title: "Graph", description: "Set", courseId, topicId })).id, submissionId);
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
  const learning = { courses: [], topics: [] };
  const bookmark = { id: bookmarkId, targetType: "resource", targetId: resourceId, title: "Graph", subtitle: "CSE-211", resourceType: "question", courseId, createdAt: at };
  const submission = {
    id: submissionId,
    teacher: { id: teacher.id, name: teacher.name },
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
    async createEnrollment() { return learningRow.enrollment_public_id; },
    async updateProgress() { return true; },
    async listAccessHistory() { return []; },
    async recordAccess() { return true; },
    async listSolvedQuestions() { return []; },
    async markSolved() { return true; },
    async listSubmissionsByTeacher() { return [submission]; },
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
  assert.deepEqual(await service.createEnrollment(student, courseId), { id: learningRow.enrollment_public_id });
  assert.equal(await service.updateProgress(student, topicId, 60), learning);
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


test("approval detail SQL covers every supported resource subtype", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../../lib/server/db/queries/workspace-queries.ts", import.meta.url), "utf8");
  for (const table of ["study_material_detail", "practice_material_detail", "book_detail", "tutorial_detail", "slide_detail", "question_detail", "leetcode_problem_detail"]) {
    assert.match(source, new RegExp(table));
  }
});
