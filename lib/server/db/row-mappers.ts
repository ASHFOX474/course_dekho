import type {
  ApprovedResource,
  Course,
  SemesterSummary,
  Submission,
  Topic,
  UniversitySummary,
} from "../domain/models.ts";
import type {
  ApprovedResourceRow,
  CourseRow,
  SemesterRow,
  SubmissionRow,
  TopicRow,
  UniversityRow,
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
