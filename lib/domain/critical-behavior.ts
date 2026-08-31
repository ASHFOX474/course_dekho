import type { AppUser, Resource, Submission } from "@/lib/types";

export type Permission =
  | "browse_approved_content"
  | "bookmark_content"
  | "track_progress"
  | "solve_question"
  | "view_learning_history"
  | "submit_content"
  | "view_own_submissions"
  | "approve_submission"
  | "reject_submission"
  | "manage_academic_structure"
  | "manage_resources"
  | "manage_users";

type Role = AppUser["role"];
type WorkflowActor = Pick<AppUser, "id" | "name" | "role">;

export interface NewSubmissionInput {
  resourceType: Submission["resourceType"];
  title: string;
  description: string;
  courseId: string;
  courseCode: string;
  topicId: string;
  topicName: string;
}

export type WorkflowPolicyErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "INVALID_TRANSITION";

export class WorkflowPolicyError extends Error {
  code: WorkflowPolicyErrorCode;

  constructor(code: WorkflowPolicyErrorCode, message: string) {
    super(message);
    this.name = "WorkflowPolicyError";
    this.code = code;
  }
}

const studentPermissions: readonly Permission[] = [
  "browse_approved_content",
  "bookmark_content",
  "track_progress",
  "solve_question",
  "view_learning_history",
];

export const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = {
  student: studentPermissions,
  teacher: [...studentPermissions, "submit_content", "view_own_submissions"],
  admin: [
    "browse_approved_content",
    "approve_submission",
    "reject_submission",
    "manage_academic_structure",
    "manage_resources",
    "manage_users",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function isApprovedContentVisible(content: {
  submissionStatus: Submission["status"];
  isActive: boolean;
}): boolean {
  return content.submissionStatus === "approved" && content.isActive;
}

export function isEnrollmentActive(
  enrollment: { status: "active" | "completed" | "dropped" } | null | undefined
): boolean {
  return enrollment?.status === "active" || enrollment?.status === "completed";
}

function requireRole(actor: WorkflowActor | null, role: Role): WorkflowActor {
  if (!actor) {
    throw new WorkflowPolicyError("UNAUTHENTICATED", "Authentication is required.");
  }

  if (actor.role !== role) {
    throw new WorkflowPolicyError("FORBIDDEN", `This action requires the ${role} role.`);
  }

  return actor;
}

function requirePending(submission: Submission): void {
  if (submission.status !== "pending") {
    throw new WorkflowPolicyError(
      "INVALID_TRANSITION",
      `Only pending submissions can be reviewed; current status is ${submission.status}.`
    );
  }
}

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new WorkflowPolicyError("VALIDATION_ERROR", `${field} is required.`);
  }
  return trimmed;
}

export function createPendingSubmission(
  actor: WorkflowActor | null,
  input: NewSubmissionInput,
  context: { submissionId: string; now: string }
): Submission {
  const teacher = requireRole(actor, "teacher");

  return {
    id: context.submissionId,
    teacherId: teacher.id,
    teacherName: teacher.name,
    resourceType: input.resourceType,
    title: requiredText(input.title, "title"),
    description: requiredText(input.description, "description"),
    courseId: requiredText(input.courseId, "courseId"),
    courseCode: requiredText(input.courseCode, "courseCode"),
    topicId: requiredText(input.topicId, "topicId"),
    topicName: requiredText(input.topicName, "topicName"),
    status: "pending",
    submittedAt: context.now,
  };
}

export function approvePendingSubmission(
  actor: WorkflowActor | null,
  submission: Submission,
  context: { resourceId: string; now: string }
): { submission: Submission; resource: Resource } {
  const admin = requireRole(actor, "admin");
  requirePending(submission);

  return {
    submission: {
      ...submission,
      status: "approved",
      reviewedById: admin.id,
      reviewedByName: admin.name,
      reviewedAt: context.now,
      rejectionReason: undefined,
    },
    resource: {
      id: context.resourceId,
      topicId: submission.topicId,
      courseId: submission.courseId,
      type: submission.resourceType,
      title: submission.title,
      description: submission.description,
      addedById: submission.teacherId,
      addedByName: submission.teacherName,
      year: new Date(context.now).getUTCFullYear(),
      topicsCovered: [],
      views: 0,
      downloads: 0,
      uploadedAt: context.now,
    },
  };
}

export function rejectPendingSubmission(
  actor: WorkflowActor | null,
  submission: Submission,
  reason: string,
  now: string
): Submission {
  const admin = requireRole(actor, "admin");
  requirePending(submission);

  return {
    ...submission,
    status: "rejected",
    reviewedById: admin.id,
    reviewedByName: admin.name,
    reviewedAt: now,
    rejectionReason: requiredText(reason, "rejectionReason"),
  };
}
