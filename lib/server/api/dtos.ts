import type {
  EnrollmentStatus,
  ResourceType,
  SubmissionStatus,
  UserRole,
} from "../domain/models.ts";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR";

export interface ApiErrorDto {
  error: {
    code: ApiErrorCode;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export interface DataResponseDto<T> {
  data: T;
}

export interface UserSummaryDto {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
}

export type SelfRegistrationRole = Exclude<UserRole, "admin">;

export interface RegisterRequestDto {
  name: string;
  email: string;
  username: string;
  password: string;
  role: SelfRegistrationRole;
  universityId: string;
  department?: string;
  yearOfStudy?: number;
  designation?: string;
}

export interface LoginRequestDto {
  identifier: string;
  password: string;
}

export interface ContributorSummaryDto {
  id: string;
  name: string;
}

export interface UniversitySummaryDto {
  id: string;
  name: string;
  shortName: string;
}

export interface SemesterSummaryDto {
  id: string;
  universityId: string;
  name: string;
  sortOrder: number;
}

export interface CourseSummaryDto {
  id: string;
  code: string;
  name: string;
  description: string;
  university: UniversitySummaryDto;
  semester: SemesterSummaryDto;
}

export interface TopicSummaryDto {
  id: string;
  courseId: string;
  name: string;
  description: string;
  sequenceOrder: number;
  subtopics: string[];
}

export interface ApprovedResourceDto {
  id: string;
  topicId: string;
  courseId: string;
  type: ResourceType;
  title: string;
  description: string;
  addedBy: ContributorSummaryDto;
  year: number | null;
  topicsCovered: string[];
  fileSizeBytes: number | null;
  views: number;
  downloads: number;
  uploadedAt: string;
  publicationStatus: "published";
  isActive: true;
}

export interface EnrollmentDto {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  enrolledAt: string;
}

export interface SubmissionDto {
  id: string;
  teacher: ContributorSummaryDto;
  resourceType: ResourceType;
  title: string;
  description: string;
  courseId: string;
  courseCode: string;
  topicId: string;
  topicName: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedBy: ContributorSummaryDto | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface CreateEnrollmentRequestDto {
  courseId: string;
}

export interface CreateSubmissionRequestDto {
  resourceType: ResourceType;
  title: string;
  description: string;
  courseId: string;
  topicId: string;
}

export interface RejectSubmissionRequestDto {
  reason: string;
}
