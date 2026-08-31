import type {
  ApprovedResource,
  AuthenticatedUser,
  Course,
  Enrollment,
  SemesterSummary,
  Submission,
  Topic,
  UniversitySummary,
} from "../domain/models.ts";
import type {
  ApprovedResourceDto,
  CourseSummaryDto,
  EnrollmentDto,
  SemesterSummaryDto,
  SubmissionDto,
  TopicSummaryDto,
  UniversitySummaryDto,
  UserSummaryDto,
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
    teacher: { ...submission.teacher },
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
