export const userRoles = ["student", "teacher", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const resourceTypes = [
  "study_material",
  "practice_material",
  "book",
  "tutorial",
  "slide",
  "question",
  "leetcode_problem",
] as const;
export type ResourceType = (typeof resourceTypes)[number];

export const submissionStatuses = ["pending", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export const enrollmentStatuses = ["active", "completed", "dropped"] as const;
export type EnrollmentStatus = (typeof enrollmentStatuses)[number];

export type PublicId = string;

export interface AuthenticatedUser {
  id: PublicId;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface Contributor {
  id: PublicId;
  name: string;
}

export interface UniversitySummary {
  id: PublicId;
  name: string;
  shortName: string;
}

export interface SemesterSummary {
  id: PublicId;
  universityId: PublicId;
  name: string;
  sortOrder: number;
}

export interface Course {
  id: PublicId;
  code: string;
  name: string;
  description: string;
  university: UniversitySummary;
  semester: SemesterSummary;
}

export interface CourseFilters {
  universityId?: PublicId;
  semesterId?: PublicId;
  query?: string;
}

export interface Subtopic {
  id: PublicId;
  slug: string;
  title: string;
  sequenceOrder: number;
}

export interface Topic {
  id: PublicId;
  courseId: PublicId;
  slug: string;
  name: string;
  description: string;
  sequenceOrder: number;
  subtopics: Subtopic[];
}

export interface ApprovedResource {
  id: PublicId;
  topicId: PublicId;
  courseId: PublicId;
  type: ResourceType;
  title: string;
  description: string;
  addedBy: Contributor;
  year: number | null;
  topicsCovered: string[];
  fileSizeBytes: number | null;
  views: number;
  downloads: number;
  uploadedAt: Date;
}

export interface Submission {
  id: PublicId;
  teacher: Contributor;
  resourceType: ResourceType;
  title: string;
  description: string;
  courseId: PublicId;
  courseCode: string;
  topicId: PublicId;
  topicName: string;
  status: SubmissionStatus;
  submittedAt: Date;
  reviewedBy: Contributor | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
}

export interface Enrollment {
  id: PublicId;
  userId: PublicId;
  courseId: PublicId;
  status: EnrollmentStatus;
  enrolledAt: Date;
}
