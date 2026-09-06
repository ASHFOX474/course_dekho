import type {
  AccessHistoryView,
  AdminStats,
  ApprovedResource,
  BookmarkView,
  Course,
  LearningCourse,
  SemesterSummary,
  SolvedQuestionView,
  Submission,
  Topic,
  TopicProgressView,
  UniversitySummary,
  UserProfile,
} from "../domain/models.ts";
import type {
  AccessHistoryViewRow,
  AdminStatsRow,
  ApprovedResourceRow,
  BookmarkViewRow,
  CourseRow,
  LearningCourseRow,
  SemesterRow,
  SolvedQuestionViewRow,
  SubmissionRow,
  TopicRow,
  TopicProgressViewRow,
  UniversityRow,
  UserProfileRow,
} from "./rows.ts";

export class DataIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DataIntegrityError";
  }
}

function toSafeNonNegativeInteger(value: string | number, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new DataIntegrityError(`${field} is outside the safe non-negative integer range.`);
  }
  return parsed;
}

function toValidDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DataIntegrityError(`${field} is not a valid timestamp.`);
  }
  return value;
}

function nullableNonNegativeInteger(
  value: string | number | null,
  field: string
): number | null {
  return value == null ? null : toSafeNonNegativeInteger(value, field);
}

function requiredDetail(value: string | null, field: string): string {
  if (value === null) {
    throw new DataIntegrityError(`Approved resource is missing ${field}.`);
  }
  return value;
}

function approvedResourceDetails(row: ApprovedResourceRow): ApprovedResource["details"] {
  if (row.detail_content_id == null) {
    return undefined as never;
  }

  switch (row.resource_type) {
    case "study_material":
    case "practice_material":
      return {
        type: row.resource_type,
        materialType: row.material_type,
        fileUrl: row.material_file_url,
        fileSizeBytes: nullableNonNegativeInteger(
          row.material_file_size_bytes,
          "material_file_size_bytes"
        ),
      };
    case "book":
      return {
        type: "book",
        bookTitle: requiredDetail(row.book_title, "book_title"),
        author: row.book_author,
        publisher: row.book_publisher,
        fileUrl: row.book_file_url,
      };
    case "tutorial":
      return {
        type: "tutorial",
        tutorialTitle: requiredDetail(row.tutorial_title, "tutorial_title"),
        tutorialContent: row.tutorial_content,
        fileUrl: row.tutorial_file_url,
      };
    case "slide":
      return {
        type: "slide",
        slideTitle: requiredDetail(row.slide_title, "slide_title"),
        slideContent: row.slide_content,
        fileUrl: row.slide_file_url,
      };
    case "question":
      return {
        type: "question",
        questionText: requiredDetail(row.question_text, "question_text"),
        difficulty: row.question_difficulty,
        points: nullableNonNegativeInteger(row.question_points, "question_points"),
      };
    case "leetcode_problem":
      return {
        type: "leetcode_problem",
        problemTitle: requiredDetail(row.problem_title, "problem_title"),
        problemUrl: row.problem_url,
        difficulty: row.problem_difficulty,
      };
  }
}

export function courseRowToDomain(row: CourseRow): Course {
  return {
    id: row.course_public_id,
    code: row.course_code,
    name: row.course_name,
    description: row.course_description,
    university: {
      id: row.university_public_id,
      name: row.university_name,
      shortName: row.university_short_name,
    },
    semester: {
      id: row.semester_public_id,
      universityId: row.university_public_id,
      name: row.semester_name,
      sortOrder: row.semester_sequence_order,
    },
  };
}

export function universityRowToDomain(row: UniversityRow): UniversitySummary {
  return {
    id: row.university_public_id,
    name: row.university_name,
    shortName: row.university_short_name,
  };
}

export function semesterRowToDomain(row: SemesterRow): SemesterSummary {
  return {
    id: row.semester_public_id,
    universityId: row.university_public_id,
    name: row.semester_name,
    sortOrder: row.semester_sequence_order,
  };
}

export function topicRowToDomain(row: TopicRow): Topic {
  return {
    id: row.topic_public_id,
    courseId: row.course_public_id,
    slug: row.topic_slug,
    name: row.topic_name,
    description: row.topic_description,
    sequenceOrder: row.topic_sequence_order,
    subtopics: row.subtopics.map((subtopic) => ({
      id: subtopic.public_id,
      slug: subtopic.slug,
      title: subtopic.title,
      sequenceOrder: subtopic.sequence_order,
    })),
  };
}

export function approvedResourceRowToDomain(row: ApprovedResourceRow): ApprovedResource {
  return {
    id: row.content_public_id,
    topicId: row.topic_public_id,
    courseId: row.course_public_id,
    type: row.resource_type,
    title: row.title,
    description: row.description,
    addedBy: {
      id: row.contributor_public_id,
      name: row.contributor_name,
    },
    year: row.publication_year,
    topicsCovered: [...row.topics_covered],
    fileSizeBytes:
      row.file_size_bytes === null
        ? null
        : toSafeNonNegativeInteger(row.file_size_bytes, "file_size_bytes"),
    details: approvedResourceDetails(row),
    views: toSafeNonNegativeInteger(row.view_count, "view_count"),
    downloads: toSafeNonNegativeInteger(row.download_count, "download_count"),
    uploadedAt: toValidDate(row.published_at, "published_at"),
  };
}

export function submissionRowToDomain(row: SubmissionRow): Submission {
  const hasReviewerId = row.reviewer_public_id !== null;
  const hasReviewerName = row.reviewer_name !== null;
  if (hasReviewerId !== hasReviewerName) {
    throw new DataIntegrityError("Reviewer identity is only partially populated.");
  }

  return {
    id: row.submission_public_id,
    teacher: {
      id: row.teacher_public_id,
      name: row.teacher_name,
    },
    resourceType: row.resource_type,
    title: row.title,
    description: row.description,
    courseId: row.course_public_id,
    courseCode: row.course_code,
    topicId: row.topic_public_id,
    topicName: row.topic_name,
    status: row.status,
    submittedAt: toValidDate(row.submitted_at, "submitted_at"),
    reviewedBy:
      row.reviewer_public_id && row.reviewer_name
        ? { id: row.reviewer_public_id, name: row.reviewer_name }
        : null,
    reviewedAt: row.reviewed_at ? toValidDate(row.reviewed_at, "reviewed_at") : null,
    rejectionReason: row.rejection_reason,
  };
}

export function userProfileRowToDomain(row: UserProfileRow): UserProfile {
  const hasUniversity = row.university_public_id !== null;
  if (
    hasUniversity !== (row.university_name !== null) ||
    hasUniversity !== (row.university_short_name !== null)
  ) {
    throw new DataIntegrityError("Profile university is only partially populated.");
  }
  return {
    user: {
      id: row.user_public_id,
      name: row.user_name,
      email: row.user_email,
      username: row.user_username,
      role: row.user_role,
    },
    university: hasUniversity
      ? {
          id: row.university_public_id as string,
          name: row.university_name as string,
          shortName: row.university_short_name as string,
        }
      : null,
    department: row.department,
    yearOfStudy: row.year_of_study,
    designation: row.designation,
  };
}

export function learningCourseRowToDomain(row: LearningCourseRow): LearningCourse {
  return {
    enrollmentId: row.enrollment_public_id,
    courseId: row.course_public_id,
    code: row.course_code,
    name: row.course_name,
    status: row.enrollment_status,
    enrolledAt: toValidDate(row.enrolled_at, "enrolled_at"),
    progressPercent: toSafeNonNegativeInteger(row.progress_percent, "progress_percent"),
  };
}

export function topicProgressRowToDomain(row: TopicProgressViewRow): TopicProgressView {
  return {
    id: row.progress_public_id,
    topicId: row.topic_public_id,
    topicName: row.topic_name,
    courseId: row.course_public_id,
    courseCode: row.course_code,
    courseName: row.course_name,
    progressPercent: toSafeNonNegativeInteger(row.progress_percent, "progress_percent"),
    completed: row.is_completed,
    lastAccessedAt: toValidDate(row.last_accessed_at, "last_accessed_at"),
  };
}

export function bookmarkRowToDomain(row: BookmarkViewRow): BookmarkView {
  return {
    id: row.bookmark_public_id,
    targetType: row.target_type,
    targetId: row.target_public_id,
    title: row.title,
    subtitle: row.subtitle,
    resourceType: row.resource_type,
    courseId: row.course_public_id,
    createdAt: toValidDate(row.created_at, "created_at"),
  };
}

export function accessHistoryRowToDomain(row: AccessHistoryViewRow): AccessHistoryView {
  return {
    id: row.access_public_id,
    resourceId: row.content_public_id,
    resourceTitle: row.title,
    resourceType: row.resource_type,
    courseId: row.course_public_id,
    courseCode: row.course_code,
    topicId: row.topic_public_id,
    topicName: row.topic_name,
    accessedAt: toValidDate(row.accessed_at, "accessed_at"),
  };
}

export function solvedQuestionRowToDomain(row: SolvedQuestionViewRow): SolvedQuestionView {
  return {
    id: row.solved_public_id,
    resourceId: row.content_public_id,
    title: row.title,
    courseId: row.course_public_id,
    courseCode: row.course_code,
    topicId: row.topic_public_id,
    topicName: row.topic_name,
    solvedAt: toValidDate(row.solved_at, "solved_at"),
  };
}

export function adminStatsRowToDomain(row: AdminStatsRow): AdminStats {
  return {
    userCount: toSafeNonNegativeInteger(row.user_count, "user_count"),
    courseCount: toSafeNonNegativeInteger(row.course_count, "course_count"),
    publishedResourceCount: toSafeNonNegativeInteger(
      row.published_resource_count,
      "published_resource_count"
    ),
    submissionCount: toSafeNonNegativeInteger(row.submission_count, "submission_count"),
  };
}
