import type {
  BookmarkTargetType,
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

export type ApprovedResourceDetailsDto =
  | {
      type: "study_material" | "practice_material";
      materialType: string | null;
      fileUrl: string | null;
      fileSizeBytes: number | null;
    }
  | {
      type: "book";
      bookTitle: string;
      author: string | null;
      publisher: string | null;
      fileUrl: string | null;
    }
  | {
      type: "tutorial";
      tutorialTitle: string;
      tutorialContent: string | null;
      fileUrl: string | null;
    }
  | {
      type: "slide";
      slideTitle: string;
      slideContent: string | null;
      fileUrl: string | null;
    }
  | {
      type: "question";
      questionText: string;
      difficulty: string | null;
      points: number | null;
    }
  | {
      type: "leetcode_problem";
      problemTitle: string;
      problemUrl: string | null;
      difficulty: string | null;
    };

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
  details?: ApprovedResourceDetailsDto;
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

export interface UserProfileDto {
  user: UserSummaryDto;
  university: UniversitySummaryDto | null;
  department: string | null;
  yearOfStudy: number | null;
  designation: string | null;
}

export interface LearningCourseDto {
  enrollmentId: string;
  courseId: string;
  code: string;
  name: string;
  status: EnrollmentStatus;
  enrolledAt: string;
  progressPercent: number;
}

export interface TopicProgressDto {
  id: string;
  topicId: string;
  topicName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  progressPercent: number;
  completed: boolean;
  lastAccessedAt: string;
}

export interface LearningOverviewDto {
  courses: LearningCourseDto[];
  topics: TopicProgressDto[];
}

export interface BookmarkDto {
  id: string;
  targetType: BookmarkTargetType;
  targetId: string;
  title: string;
  subtitle: string;
  resourceType: ResourceType | null;
  courseId: string | null;
  createdAt: string;
}

export interface CreateBookmarkRequestDto {
  targetType: BookmarkTargetType;
  targetId: string;
}

export interface ProgressRequestDto {
  progressPercent: number;
}

export interface AccessHistoryDto {
  id: string;
  resourceId: string;
  resourceTitle: string;
  resourceType: ResourceType;
  courseId: string;
  courseCode: string;
  topicId: string;
  topicName: string;
  accessedAt: string;
}

export interface SolvedQuestionDto {
  id: string;
  resourceId: string;
  title: string;
  courseId: string;
  courseCode: string;
  topicId: string;
  topicName: string;
  solvedAt: string;
}

export interface AdminStatsDto {
  userCount: number;
  courseCount: number;
  publishedResourceCount: number;
  submissionCount: number;
}
