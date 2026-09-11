import type {
  AccessHistoryView,
  AdminStats,
  ApprovedResource,
  AuthenticatedUser,
  BookmarkView,
  Course,
  Enrollment,
  LearningOverview,
  SemesterSummary,
  SolvedQuestionView,
  Submission,
  Topic,
  TopicProgressView,
  UniversitySummary,
  UserProfile,
  PendingUser,
  DirectoryUser,
} from "../domain/models.ts";
import type {
  AccessHistoryDto,
  AdminStatsDto,
  ApprovedResourceDto,
  BookmarkDto,
  CourseSummaryDto,
  EnrollmentDto,
  LearningOverviewDto,
  SemesterSummaryDto,
  SolvedQuestionDto,
  SubmissionDto,
  TopicProgressDto,
  TopicSummaryDto,
  UniversitySummaryDto,
  UserProfileDto,
  UserSummaryDto,
  PendingUserDto,
  DirectoryUserDto,
} from "./dtos.ts";

export function toUserSummaryDto(user: AuthenticatedUser): UserSummaryDto {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

export function toPendingUserDto(pending: PendingUser): PendingUserDto {
  return {
    id: pending.id,
    name: pending.name,
    email: pending.email,
    username: pending.username,
    role: pending.role as "learner" | "contributor",
    universityName: pending.universityName,
    registeredAt: pending.registeredAt.toISOString(),
  };
}

export function toDirectoryUserDto(user: DirectoryUser): DirectoryUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    role: user.role,
    registrationStatus: user.registrationStatus,
    isActive: user.isActive,
    universityName: user.universityName,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toCourseDto(course: Course): CourseSummaryDto {
  return {
    id: course.id,
    code: course.code,
    name: course.name,
    description: course.description,
    university: { ...course.university },
    semester: { ...course.semester },
  };
}

export function toUniversityDto(university: UniversitySummary): UniversitySummaryDto {
  return { ...university };
}

export function toSemesterDto(semester: SemesterSummary): SemesterSummaryDto {
  return { ...semester };
}

export function toTopicDto(topic: Topic): TopicSummaryDto {
  return {
    id: topic.id,
    courseId: topic.courseId,
    name: topic.name,
    description: topic.description,
    sequenceOrder: topic.sequenceOrder,
    subtopics: topic.subtopics.map((subtopic) => subtopic.title),
  };
}

export function toApprovedResourceDto(resource: ApprovedResource): ApprovedResourceDto {
  return {
    id: resource.id,
    topicId: resource.topicId,
    courseId: resource.courseId,
    type: resource.type,
    title: resource.title,
    description: resource.description,
    addedBy: { ...resource.addedBy },
    year: resource.year,
    topicsCovered: [...resource.topicsCovered],
    fileSizeBytes: resource.fileSizeBytes,
    ...(resource.details ? { details: { ...resource.details } } : {}),
    views: resource.views,
    downloads: resource.downloads,
    uploadedAt: resource.uploadedAt.toISOString(),
    publicationStatus: "published",
    isActive: true,
  };
}

export function toEnrollmentDto(enrollment: Enrollment): EnrollmentDto {
  return {
    id: enrollment.id,
    userId: enrollment.userId,
    courseId: enrollment.courseId,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
  };
}

export function toSubmissionDto(submission: Submission): SubmissionDto {
  return {
    id: submission.id,
    contributor: { ...submission.contributor },
    resourceType: submission.resourceType,
    title: submission.title,
    description: submission.description,
    courseId: submission.courseId,
    courseCode: submission.courseCode,
    topicId: submission.topicId,
    topicName: submission.topicName,
    status: submission.status,
    submittedAt: submission.submittedAt.toISOString(),
    reviewedBy: submission.reviewedBy ? { ...submission.reviewedBy } : null,
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    rejectionReason: submission.rejectionReason,
  };
}

export function toUserProfileDto(profile: UserProfile): UserProfileDto {
  return {
    user: toUserSummaryDto(profile.user),
    university: profile.university ? { ...profile.university } : null,
    department: profile.department,
    yearOfStudy: profile.yearOfStudy,
    designation: profile.designation,
  };
}

function toTopicProgressDto(progress: TopicProgressView): TopicProgressDto {
  return {
    ...progress,
    lastAccessedAt: progress.lastAccessedAt.toISOString(),
  };
}

export function toLearningOverviewDto(overview: LearningOverview): LearningOverviewDto {
  return {
    courses: overview.courses.map((course) => ({
      ...course,
      enrolledAt: course.enrolledAt.toISOString(),
    })),
    topics: overview.topics.map(toTopicProgressDto),
  };
}

export function toBookmarkDto(bookmark: BookmarkView): BookmarkDto {
  return { ...bookmark, createdAt: bookmark.createdAt.toISOString() };
}

export function toAccessHistoryDto(entry: AccessHistoryView): AccessHistoryDto {
  return { ...entry, accessedAt: entry.accessedAt.toISOString() };
}

export function toSolvedQuestionDto(entry: SolvedQuestionView): SolvedQuestionDto {
  return { ...entry, solvedAt: entry.solvedAt.toISOString() };
}

export function toAdminStatsDto(stats: AdminStats): AdminStatsDto {
  return { ...stats };
}
