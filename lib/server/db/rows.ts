import type { QueryResultRow } from "pg";
import type {
  BookmarkTargetType,
  EnrollmentStatus,
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
  material_type: string | null;
  material_file_url: string | null;
  material_file_size_bytes: string | null;
  book_title: string | null;
  book_author: string | null;
  book_publisher: string | null;
  book_file_url: string | null;
  tutorial_title: string | null;
  tutorial_content: string | null;
  tutorial_file_url: string | null;
  slide_title: string | null;
  slide_content: string | null;
  slide_file_url: string | null;
  question_text: string | null;
  question_difficulty: string | null;
  question_points: number | null;
  problem_title: string | null;
  problem_url: string | null;
  problem_difficulty: string | null;
  detail_content_id: string | null;
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

export interface UserProfileRow extends QueryResultRow {
  user_public_id: string;
  user_name: string;
  user_email: string;
  user_username: string;
  user_role: UserRole;
  university_public_id: string | null;
  university_name: string | null;
  university_short_name: string | null;
  department: string | null;
  year_of_study: number | null;
  designation: string | null;
}

export interface LearningCourseRow extends QueryResultRow {
  enrollment_public_id: string;
  course_public_id: string;
  course_code: string;
  course_name: string;
  enrollment_status: EnrollmentStatus;
  enrolled_at: Date;
  progress_percent: number;
}

export interface TopicProgressViewRow extends QueryResultRow {
  progress_public_id: string;
  topic_public_id: string;
  topic_name: string;
  course_public_id: string;
  course_code: string;
  course_name: string;
  progress_percent: number;
  is_completed: boolean;
  last_accessed_at: Date;
}

export interface BookmarkViewRow extends QueryResultRow {
  bookmark_public_id: string;
  target_type: BookmarkTargetType;
  target_public_id: string;
  title: string;
  subtitle: string;
  resource_type: ResourceType | null;
  course_public_id: string | null;
  created_at: Date;
}

export interface AccessHistoryViewRow extends QueryResultRow {
  access_public_id: string;
  content_public_id: string;
  title: string;
  resource_type: ResourceType;
  course_public_id: string;
  course_code: string;
  topic_public_id: string;
  topic_name: string;
  accessed_at: Date;
}

export interface SolvedQuestionViewRow extends QueryResultRow {
  solved_public_id: string;
  content_public_id: string;
  title: string;
  course_public_id: string;
  course_code: string;
  topic_public_id: string;
  topic_name: string;
  solved_at: Date;
}

export interface AdminStatsRow extends QueryResultRow {
  user_count: number;
  course_count: number;
  published_resource_count: number;
  submission_count: number;
}
