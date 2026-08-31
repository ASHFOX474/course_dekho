import type { QueryResultRow } from "pg";
import type {
  ResourceType,
  SubmissionStatus,
  UserRole,
} from "../domain/models.ts";

export interface AuthUserRow extends QueryResultRow {
  user_internal_id: string;
  user_public_id: string;
  user_name: string;
  user_email: string;
  user_username: string;
  user_role: UserRole;
}

export interface AuthCredentialRow extends AuthUserRow {
  password_hash: string;
}

export interface InternalIdRow extends QueryResultRow {
  internal_id: string;
}

export interface UniversityRow extends QueryResultRow {
  university_public_id: string;
  university_name: string;
  university_short_name: string;
}

export interface SemesterRow extends QueryResultRow {
  semester_public_id: string;
  university_public_id: string;
  semester_name: string;
  semester_sequence_order: number;
}

export interface CourseRow extends QueryResultRow {
  course_public_id: string;
  course_code: string;
  course_name: string;
  course_description: string;
  university_public_id: string;
  university_name: string;
  university_short_name: string;
  semester_public_id: string;
  semester_name: string;
  semester_sequence_order: number;
}

export interface SubtopicJsonRow {
  public_id: string;
  slug: string;
  title: string;
  sequence_order: number;
}

export interface TopicRow extends QueryResultRow {
  topic_public_id: string;
  course_public_id: string;
  topic_slug: string;
  topic_name: string;
  topic_description: string;
  topic_sequence_order: number;
  subtopics: SubtopicJsonRow[];
}

export interface ApprovedResourceRow extends QueryResultRow {
  content_public_id: string;
  topic_public_id: string;
  course_public_id: string;
  resource_type: ResourceType;
  title: string;
  description: string;
  contributor_public_id: string;
  contributor_name: string;
  publication_year: number | null;
  topics_covered: string[];
  file_size_bytes: string | null;
  view_count: string;
  download_count: string;
  published_at: Date;
}

export interface SubmissionRow extends QueryResultRow {
  submission_public_id: string;
  teacher_public_id: string;
  teacher_name: string;
  resource_type: ResourceType;
  title: string;
  description: string;
  course_public_id: string;
  course_code: string;
  topic_public_id: string;
  topic_name: string;
  status: SubmissionStatus;
  submitted_at: Date;
  reviewer_public_id: string | null;
  reviewer_name: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
}
