import type { DatabaseExecutor } from "../executor.ts";
import type {
  AccessHistoryViewRow,
  AdminStatsRow,
  BookmarkViewRow,
  InternalIdRow,
  LearningCourseRow,
  SolvedQuestionViewRow,
  SubmissionRow,
  TopicProgressViewRow,
  UserProfileRow,
} from "../rows.ts";
import type { BookmarkTargetType, ResourceType } from "../../domain/models.ts";

export async function queryUserProfile(
  executor: DatabaseExecutor,
  userId: string
): Promise<UserProfileRow | null> {
  const result = await executor.query<UserProfileRow, [string]>({
    name: "workspace-profile-v1",
    text: `
      SELECT
        app_user.public_id::text AS user_public_id,
        app_user.name AS user_name,
        app_user.email AS user_email,
        app_user.username AS user_username,
        app_user.role AS user_role,
        university.public_id::text AS university_public_id,
        university.name AS university_name,
        university.short_name AS university_short_name,
        COALESCE(student.department, teacher.department) AS department,
        student.year_of_study,
        teacher.designation
      FROM coursedekho.app_user AS app_user
      LEFT JOIN coursedekho.student_profile AS student ON student.user_id = app_user.id
      LEFT JOIN coursedekho.teacher_profile AS teacher ON teacher.user_id = app_user.id
      LEFT JOIN coursedekho.university AS university
        ON university.id = COALESCE(student.university_id, teacher.university_id)
      WHERE app_user.public_id = $1::uuid
        AND app_user.is_active
      LIMIT 1
    `,
    values: [userId],
  });
  return result.rows[0] ?? null;
}

export async function queryLearningCourses(
  executor: DatabaseExecutor,
  userId: string
): Promise<LearningCourseRow[]> {
  const result = await executor.query<LearningCourseRow, [string]>({
    name: "workspace-learning-courses-v1",
    text: `
      SELECT
        enrollment.public_id::text AS enrollment_public_id,
        course.public_id::text AS course_public_id,
        course.code AS course_code,
        course.name AS course_name,
        enrollment.status AS enrollment_status,
        enrollment.enrolled_at,
        COALESCE(
          round(sum(COALESCE(progress.progress_percent, 0))::numeric /
            NULLIF(count(topic.id), 0)),
          0
        )::integer AS progress_percent
      FROM coursedekho.enrollment AS enrollment
      JOIN coursedekho.app_user AS app_user ON app_user.id = enrollment.user_id
      JOIN coursedekho.course AS course ON course.id = enrollment.course_id
      JOIN coursedekho.university AS university ON university.id = course.university_id
      JOIN coursedekho.semester AS semester
        ON semester.id = course.semester_id
       AND semester.university_id = course.university_id
      LEFT JOIN coursedekho.topic AS topic
        ON topic.course_id = course.id
       AND topic.is_active
      LEFT JOIN coursedekho.topic_progress AS progress
        ON progress.topic_id = topic.id
       AND progress.user_id = app_user.id
      WHERE app_user.public_id = $1::uuid
        AND course.is_active
        AND university.is_active
        AND semester.is_active
      GROUP BY enrollment.id, course.id
      ORDER BY enrollment.enrolled_at DESC, enrollment.id DESC
    `,
    values: [userId],
  });
  return result.rows;
}

export async function queryTopicProgress(
  executor: DatabaseExecutor,
  userId: string
): Promise<TopicProgressViewRow[]> {
  const result = await executor.query<TopicProgressViewRow, [string]>({
    name: "workspace-topic-progress-v1",
    text: `
      SELECT
        progress.public_id::text AS progress_public_id,
        topic.public_id::text AS topic_public_id,
        topic.name AS topic_name,
        course.public_id::text AS course_public_id,
        course.code AS course_code,
        course.name AS course_name,
        progress.progress_percent,
        progress.is_completed,
        progress.last_accessed_at
      FROM coursedekho.topic_progress AS progress
      JOIN coursedekho.app_user AS app_user ON app_user.id = progress.user_id
      JOIN coursedekho.topic AS topic ON topic.id = progress.topic_id
      JOIN coursedekho.course AS course ON course.id = topic.course_id
      JOIN coursedekho.university AS university ON university.id = course.university_id
      JOIN coursedekho.semester AS semester
        ON semester.id = course.semester_id
       AND semester.university_id = course.university_id
      WHERE app_user.public_id = $1::uuid
        AND topic.is_active
        AND course.is_active
        AND university.is_active
        AND semester.is_active
      ORDER BY progress.last_accessed_at DESC, progress.id DESC
    `,
    values: [userId],
  });
  return result.rows;
}

const bookmarkProjectionSql = `
  SELECT
    bookmark.public_id::text AS bookmark_public_id,
    target.target_type,
    target.target_public_id,
    target.title,
    target.subtitle,
    target.resource_type,
    target.course_public_id,
    bookmark.created_at
  FROM coursedekho.bookmark AS bookmark
  JOIN coursedekho.app_user AS app_user ON app_user.id = bookmark.user_id
  JOIN LATERAL (
    SELECT
      'course'::text AS target_type,
      course.public_id::text AS target_public_id,
      course.name AS title,
      course.code AS subtitle,
      NULL::coursedekho.resource_type AS resource_type,
      course.public_id::text AS course_public_id
    FROM coursedekho.course AS course
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester
      ON semester.id = course.semester_id
     AND semester.university_id = course.university_id
    WHERE course.id = bookmark.course_id
      AND course.is_active AND university.is_active AND semester.is_active
    UNION ALL
    SELECT
      'topic'::text,
      topic.public_id::text,
      topic.name,
      course.code || ' > ' || topic.name,
      NULL::coursedekho.resource_type,
      course.public_id::text
    FROM coursedekho.topic AS topic
    JOIN coursedekho.course AS course ON course.id = topic.course_id
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester
      ON semester.id = course.semester_id
     AND semester.university_id = course.university_id
    WHERE topic.id = bookmark.topic_id
      AND topic.is_active AND course.is_active
      AND university.is_active AND semester.is_active
    UNION ALL
    SELECT
      'resource'::text,
      content.public_id::text,
      revision.title,
      course.code || ' > ' || topic.name,
      content.resource_type,
      course.public_id::text
    FROM coursedekho.content AS content
    JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
    JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
    JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
    JOIN coursedekho.course AS course ON course.id = topic.course_id
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester
      ON semester.id = course.semester_id
     AND semester.university_id = course.university_id
    WHERE content.id = bookmark.content_id
      AND submission.status = 'approved'
      AND content.is_active
      AND topic.is_active
      AND course.is_active
      AND university.is_active
      AND semester.is_active
  ) AS target ON TRUE
`;

export async function queryBookmarks(
  executor: DatabaseExecutor,
  userId: string
): Promise<BookmarkViewRow[]> {
  const result = await executor.query<BookmarkViewRow, [string]>({
    name: "workspace-bookmarks-v1",
    text: `${bookmarkProjectionSql}
      WHERE app_user.public_id = $1::uuid
      ORDER BY bookmark.created_at DESC, bookmark.id DESC
    `,
    values: [userId],
  });
  return result.rows;
}

const bookmarkTargetSql: Record<BookmarkTargetType, string> = {
  course: `
    SELECT course.id
    FROM coursedekho.course AS course
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester ON semester.id = course.semester_id
    WHERE course.public_id = $2::uuid
      AND course.is_active AND university.is_active AND semester.is_active
  `,
  topic: `
    SELECT topic.id
    FROM coursedekho.topic AS topic
    JOIN coursedekho.course AS course ON course.id = topic.course_id
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester
      ON semester.id = course.semester_id
     AND semester.university_id = course.university_id
    WHERE topic.public_id = $2::uuid
      AND topic.is_active AND course.is_active
      AND university.is_active AND semester.is_active
  `,
  resource: `
    SELECT content.id
    FROM coursedekho.content AS content
    JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
    JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
    JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
    JOIN coursedekho.course AS course ON course.id = topic.course_id
    JOIN coursedekho.university AS university ON university.id = course.university_id
    JOIN coursedekho.semester AS semester
      ON semester.id = course.semester_id
     AND semester.university_id = course.university_id
    WHERE content.public_id = $2::uuid
      AND submission.status = 'approved'
      AND content.is_active
      AND topic.is_active AND course.is_active
      AND university.is_active AND semester.is_active
  `,
};

export async function queryCreateBookmark(
  executor: DatabaseExecutor,
  userId: string,
  targetType: BookmarkTargetType,
  targetId: string
): Promise<string | null> {
  const targetColumn = targetType === "resource" ? "content_id" : `${targetType}_id`;
  const result = await executor.query<{ bookmark_public_id: string }, [string, string]>({
    name: `workspace-create-${targetType}-bookmark-v1`,
    text: `
      INSERT INTO coursedekho.bookmark AS existing (user_id, ${targetColumn})
      SELECT app_user.id, target.id
      FROM coursedekho.app_user AS app_user
      CROSS JOIN (${bookmarkTargetSql[targetType]}) AS target
      WHERE app_user.public_id = $1::uuid AND app_user.is_active
      ON CONFLICT (user_id, ${targetColumn}) WHERE ${targetColumn} IS NOT NULL
      DO UPDATE SET notes = existing.notes
      RETURNING public_id::text AS bookmark_public_id
    `,
    values: [userId, targetId],
  });
  return result.rows[0]?.bookmark_public_id ?? null;
}

export async function queryDeleteBookmark(
  executor: DatabaseExecutor,
  userId: string,
  bookmarkId: string
): Promise<boolean> {
  const result = await executor.query<InternalIdRow, [string, string]>({
    name: "workspace-delete-bookmark-v1",
    text: `
      DELETE FROM coursedekho.bookmark AS bookmark
      USING coursedekho.app_user AS app_user
      WHERE bookmark.public_id = $2::uuid
        AND bookmark.user_id = app_user.id
        AND app_user.public_id = $1::uuid
      RETURNING bookmark.id::text AS internal_id
    `,
    values: [userId, bookmarkId],
  });
  return result.rowCount === 1;
}

export async function queryCreateEnrollment(
  executor: DatabaseExecutor,
  userId: string,
  courseId: string
): Promise<string | null> {
  const result = await executor.query<{ enrollment_public_id: string }, [string, string]>({
    name: "workspace-create-enrollment-v1",
    text: `
      INSERT INTO coursedekho.enrollment (user_id, course_id)
      SELECT app_user.id, course.id
      FROM coursedekho.app_user AS app_user
      CROSS JOIN coursedekho.course AS course
      WHERE app_user.public_id = $1::uuid
        AND app_user.is_active
        AND course.public_id = $2::uuid
        AND course.is_active
        AND EXISTS (
          SELECT 1
          FROM coursedekho.university AS university
          JOIN coursedekho.semester AS semester
            ON semester.id = course.semester_id
           AND semester.university_id = university.id
          WHERE university.id = course.university_id
            AND university.is_active
            AND semester.is_active
        )
      ON CONFLICT (user_id, course_id) DO UPDATE
      SET status = 'active', status_changed_at = now(), updated_at = now()
      RETURNING public_id::text AS enrollment_public_id
    `,
    values: [userId, courseId],
  });
  return result.rows[0]?.enrollment_public_id ?? null;
}

export async function queryUpdateProgress(
  executor: DatabaseExecutor,
  userId: string,
  topicId: string,
  progressPercent: number,
  now: Date
): Promise<boolean> {
  const result = await executor.query<InternalIdRow, [string, string, number, Date]>({
    name: "workspace-upsert-topic-progress-v1",
    text: `
      INSERT INTO coursedekho.topic_progress (
        user_id, topic_id, progress_percent, is_completed, completed_at, last_accessed_at
      )
      SELECT
        app_user.id,
        topic.id,
        $3::smallint,
        $3::smallint = 100,
        CASE WHEN $3::smallint = 100 THEN $4::timestamptz ELSE NULL END,
        $4::timestamptz
      FROM coursedekho.app_user AS app_user
      CROSS JOIN coursedekho.topic AS topic
      WHERE app_user.public_id = $1::uuid
        AND topic.public_id = $2::uuid
        AND topic.is_active
        AND EXISTS (
          SELECT 1
          FROM coursedekho.course AS course
          JOIN coursedekho.university AS university ON university.id = course.university_id
          JOIN coursedekho.semester AS semester
            ON semester.id = course.semester_id
           AND semester.university_id = course.university_id
          WHERE course.id = topic.course_id
            AND course.is_active
            AND university.is_active
            AND semester.is_active
        )
      ON CONFLICT (user_id, topic_id) DO UPDATE
      SET progress_percent = EXCLUDED.progress_percent,
          is_completed = EXCLUDED.is_completed,
          completed_at = EXCLUDED.completed_at,
          last_accessed_at = EXCLUDED.last_accessed_at,
          updated_at = $4::timestamptz
      RETURNING id::text AS internal_id
    `,
    values: [userId, topicId, progressPercent, now],
  });
  return result.rowCount === 1;
}

export async function queryAccessHistory(
  executor: DatabaseExecutor,
  userId: string
): Promise<AccessHistoryViewRow[]> {
  const result = await executor.query<AccessHistoryViewRow, [string]>({
    name: "workspace-access-history-v1",
    text: `
      SELECT
        access.public_id::text AS access_public_id,
        content.public_id::text AS content_public_id,
        revision.title,
        content.resource_type,
        course.public_id::text AS course_public_id,
        course.code AS course_code,
        topic.public_id::text AS topic_public_id,
        topic.name AS topic_name,
        access.accessed_at
      FROM coursedekho.content_access AS access
      JOIN coursedekho.app_user AS app_user ON app_user.id = access.user_id
      JOIN coursedekho.content AS content ON content.id = access.content_id
      JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
      JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
      JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
      JOIN coursedekho.course AS course ON course.id = topic.course_id
      JOIN coursedekho.university AS university ON university.id = course.university_id
      JOIN coursedekho.semester AS semester
        ON semester.id = course.semester_id
       AND semester.university_id = course.university_id
      WHERE app_user.public_id = $1::uuid
        AND submission.status = 'approved'
        AND content.is_active
        AND topic.is_active
        AND course.is_active
        AND university.is_active
        AND semester.is_active
      ORDER BY access.accessed_at DESC, access.id DESC
      LIMIT 200
    `,
    values: [userId],
  });
  return result.rows;
}

export async function queryRecordAccess(
  executor: DatabaseExecutor,
  userId: string,
  resourceId: string
): Promise<boolean> {
  const result = await executor.query<InternalIdRow, [string, string]>({
    name: "workspace-record-access-v1",
    text: `
      WITH target AS (
        SELECT content.id
        FROM coursedekho.content AS content
        JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
        JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
        JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
        JOIN coursedekho.course AS course ON course.id = topic.course_id
        JOIN coursedekho.university AS university ON university.id = course.university_id
        JOIN coursedekho.semester AS semester
          ON semester.id = course.semester_id
         AND semester.university_id = course.university_id
        WHERE content.public_id = $2::uuid
          AND submission.status = 'approved'
          AND content.is_active
          AND topic.is_active AND course.is_active
          AND university.is_active AND semester.is_active
      ), updated AS (
        UPDATE coursedekho.content AS content
        SET view_count = content.view_count + 1, updated_at = now()
        FROM target
        WHERE content.id = target.id
        RETURNING content.id
      )
      INSERT INTO coursedekho.content_access (user_id, content_id)
      SELECT app_user.id, updated.id
      FROM coursedekho.app_user AS app_user
      CROSS JOIN updated
      WHERE app_user.public_id = $1::uuid AND app_user.is_active
      RETURNING id::text AS internal_id
    `,
    values: [userId, resourceId],
  });
  return result.rowCount === 1;
}

export async function querySolvedQuestions(
  executor: DatabaseExecutor,
  userId: string
): Promise<SolvedQuestionViewRow[]> {
  const result = await executor.query<SolvedQuestionViewRow, [string]>({
    name: "workspace-solved-questions-v1",
    text: `
      SELECT
        solved.public_id::text AS solved_public_id,
        content.public_id::text AS content_public_id,
        revision.title,
        course.public_id::text AS course_public_id,
        course.code AS course_code,
        topic.public_id::text AS topic_public_id,
        topic.name AS topic_name,
        solved.solved_at
      FROM coursedekho.solved_question AS solved
      JOIN coursedekho.app_user AS app_user ON app_user.id = solved.user_id
      JOIN coursedekho.content AS content ON content.id = solved.content_id
      JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
      JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
      JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
      JOIN coursedekho.course AS course ON course.id = topic.course_id
      JOIN coursedekho.university AS university ON university.id = course.university_id
      JOIN coursedekho.semester AS semester
        ON semester.id = course.semester_id
       AND semester.university_id = course.university_id
      WHERE app_user.public_id = $1::uuid
        AND submission.status = 'approved'
        AND content.resource_type = 'question'
        AND content.is_active
        AND topic.is_active AND course.is_active
        AND university.is_active AND semester.is_active
      ORDER BY solved.solved_at DESC, solved.id DESC
    `,
    values: [userId],
  });
  return result.rows;
}

export async function queryMarkSolved(
  executor: DatabaseExecutor,
  userId: string,
  resourceId: string
): Promise<boolean> {
  const result = await executor.query<InternalIdRow, [string, string]>({
    name: "workspace-mark-solved-v1",
    text: `
      INSERT INTO coursedekho.solved_question AS existing (user_id, content_id)
      SELECT app_user.id, content.id
      FROM coursedekho.app_user AS app_user
      CROSS JOIN coursedekho.content AS content
      JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
      JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
      JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
      JOIN coursedekho.course AS course ON course.id = topic.course_id
      JOIN coursedekho.university AS university ON university.id = course.university_id
      JOIN coursedekho.semester AS semester
        ON semester.id = course.semester_id
       AND semester.university_id = course.university_id
      WHERE app_user.public_id = $1::uuid
        AND content.public_id = $2::uuid
        AND content.resource_type = 'question'
        AND submission.status = 'approved'
        AND content.is_active
        AND topic.is_active AND course.is_active
        AND university.is_active AND semester.is_active
      ON CONFLICT (user_id, content_id) DO UPDATE SET solved_at = existing.solved_at
      RETURNING id::text AS internal_id
    `,
    values: [userId, resourceId],
  });
  return result.rowCount === 1;
}

const submissionProjectionSql = `
  SELECT
    submission.public_id::text AS submission_public_id,
    teacher.public_id::text AS teacher_public_id,
    teacher.name AS teacher_name,
    submission.resource_type,
    submission.title,
    submission.description,
    course.public_id::text AS course_public_id,
    course.code AS course_code,
    topic.public_id::text AS topic_public_id,
    topic.name AS topic_name,
    submission.status,
    submission.submitted_at,
    reviewer.public_id::text AS reviewer_public_id,
    reviewer.name AS reviewer_name,
    submission.reviewed_at,
    submission.rejection_reason
  FROM coursedekho.content_submission AS submission
  JOIN coursedekho.app_user AS teacher ON teacher.id = submission.submitted_by_user_id
  JOIN coursedekho.topic AS topic ON topic.id = submission.topic_id
  JOIN coursedekho.course AS course ON course.id = topic.course_id
  LEFT JOIN coursedekho.app_user AS reviewer ON reviewer.id = submission.reviewed_by_user_id
`;

export async function queryAllSubmissions(executor: DatabaseExecutor): Promise<SubmissionRow[]> {
  const result = await executor.query<SubmissionRow>({
    name: "workspace-list-all-submissions-v1",
    text: `${submissionProjectionSql}
      ORDER BY CASE submission.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END,
        submission.submitted_at DESC, submission.id DESC
    `,
    values: [],
  });
  return result.rows;
}

export async function queryCreateSubmission(
  executor: DatabaseExecutor,
  input: {
    teacherId: string;
    resourceType: ResourceType;
    title: string;
    description: string;
    courseId: string;
    topicId: string;
  }
): Promise<string | null> {
  const result = await executor.query<
    { submission_public_id: string },
    [string, ResourceType, string, string, string, string]
  >({
    name: "workspace-create-submission-v1",
    text: `
      INSERT INTO coursedekho.content_submission (
        submitted_by_user_id, topic_id, resource_type, title, description
      )
      SELECT teacher.id, topic.id, $2, $3, $4
      FROM coursedekho.app_user AS teacher
      CROSS JOIN coursedekho.topic AS topic
      JOIN coursedekho.course AS course ON course.id = topic.course_id
      WHERE teacher.public_id = $1::uuid
        AND teacher.role = 'teacher'
        AND teacher.is_active
        AND course.public_id = $5::uuid
        AND topic.public_id = $6::uuid
        AND course.is_active
        AND topic.is_active
      RETURNING public_id::text AS submission_public_id
    `,
    values: [
      input.teacherId,
      input.resourceType,
      input.title,
      input.description,
      input.courseId,
      input.topicId,
    ],
  });
  return result.rows[0]?.submission_public_id ?? null;
}

export async function queryApproveSubmission(
  executor: DatabaseExecutor,
  input: { submissionId: string; reviewerId: string; reviewedAt: Date }
): Promise<boolean> {
  const locked = await executor.query<
    { submission_internal_id: string; target_content_internal_id: string | null; resource_type: ResourceType },
    [string]
  >({
    name: "workspace-lock-pending-submission-v1",
    text: `
      SELECT
        id::text AS submission_internal_id,
        target_content_id::text AS target_content_internal_id,
        resource_type
      FROM coursedekho.content_submission
      WHERE public_id = $1::uuid AND status = 'pending'
      FOR UPDATE
    `,
    values: [input.submissionId],
  });
  const submission = locked.rows[0];
  if (!submission) return false;

  const reviewed = await executor.query<InternalIdRow, [string, string, Date]>({
    name: "workspace-mark-submission-approved-v1",
    text: `
      UPDATE coursedekho.content_submission AS submission
      SET status = 'approved',
          reviewed_by_user_id = reviewer.id,
          reviewed_at = $3::timestamptz,
          updated_at = $3::timestamptz
      FROM coursedekho.app_user AS reviewer
      WHERE submission.public_id = $1::uuid
        AND submission.status = 'pending'
        AND reviewer.public_id = $2::uuid
        AND reviewer.role = 'admin'
      RETURNING submission.id::text AS internal_id
    `,
    values: [input.submissionId, input.reviewerId, input.reviewedAt],
  });
  if (reviewed.rowCount !== 1) return false;

  let contentInternalId = submission.target_content_internal_id;
  if (!contentInternalId) {
    const created = await executor.query<InternalIdRow, [string]>({
      name: "workspace-create-content-for-approved-submission-v1",
      text: `
        INSERT INTO coursedekho.content (
          topic_id, resource_type, created_by_user_id, is_active
        )
        SELECT topic_id, resource_type, submitted_by_user_id, FALSE
        FROM coursedekho.content_submission
        WHERE public_id = $1::uuid AND status = 'approved'
        RETURNING id::text AS internal_id
      `,
      values: [input.submissionId],
    });
    contentInternalId = created.rows[0]?.internal_id ?? null;
  }
  if (!contentInternalId) return false;

  const revision = await executor.query<InternalIdRow, [string, string]>({
    name: "workspace-create-approved-content-revision-v1",
    text: `
      INSERT INTO coursedekho.content_revision (
        content_id, submission_id, version_number, topic_id,
        contributed_by_user_id, approved_by_user_id, resource_type,
        title, description, publication_year, topics_covered, storage_key,
        original_file_name, mime_type, file_size_bytes, checksum_sha256,
        external_url, metadata, approved_at
      )
      SELECT
        $2::bigint,
        submission.id,
        COALESCE((SELECT max(existing.version_number) + 1
                  FROM coursedekho.content_revision AS existing
                  WHERE existing.content_id = $2::bigint), 1),
        submission.topic_id,
        submission.submitted_by_user_id,
        submission.reviewed_by_user_id,
        submission.resource_type,
        submission.title,
        submission.description,
        submission.publication_year,
        submission.topics_covered,
        submission.storage_key,
        submission.original_file_name,
        submission.mime_type,
        submission.file_size_bytes,
        submission.checksum_sha256,
        submission.external_url,
        submission.metadata,
        submission.reviewed_at
      FROM coursedekho.content_submission AS submission
      WHERE submission.public_id = $1::uuid AND submission.status = 'approved'
      RETURNING id::text AS internal_id
    `,
    values: [input.submissionId, contentInternalId],
  });
  const revisionInternalId = revision.rows[0]?.internal_id;
  if (!revisionInternalId) return false;

  const detailed = await executor.query<InternalIdRow, [string, string, ResourceType]>({
    name: "workspace-replace-approved-content-detail-v1",
    text: `
      WITH
      cleared_study AS (
        DELETE FROM coursedekho.study_material_detail WHERE content_id = $2::bigint
      ),
      cleared_practice AS (
        DELETE FROM coursedekho.practice_material_detail WHERE content_id = $2::bigint
      ),
      cleared_book AS (
        DELETE FROM coursedekho.book_detail WHERE content_id = $2::bigint
      ),
      cleared_tutorial AS (
        DELETE FROM coursedekho.tutorial_detail WHERE content_id = $2::bigint
      ),
      cleared_slide AS (
        DELETE FROM coursedekho.slide_detail WHERE content_id = $2::bigint
      ),
      cleared_question AS (
        DELETE FROM coursedekho.question_detail WHERE content_id = $2::bigint
      ),
      cleared_leetcode AS (
        DELETE FROM coursedekho.leetcode_problem_detail WHERE content_id = $2::bigint
      ),
      approved_submission AS (
        SELECT resource_type, title, description, external_url, file_size_bytes, metadata
        FROM coursedekho.content_submission
        WHERE public_id = $1::uuid AND status = 'approved' AND resource_type = $3
      ),
      created_study AS (
        INSERT INTO coursedekho.study_material_detail (
          content_id, material_type, file_url, file_size_bytes
        )
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'material_type', ''), NULLIF(metadata ->> 'materialType', '')),
          COALESCE(NULLIF(metadata ->> 'file_url', ''), NULLIF(metadata ->> 'fileUrl', ''), external_url),
          file_size_bytes
        FROM approved_submission WHERE resource_type = 'study_material'
        RETURNING content_id
      ),
      created_practice AS (
        INSERT INTO coursedekho.practice_material_detail (
          content_id, material_type, file_url, file_size_bytes
        )
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'material_type', ''), NULLIF(metadata ->> 'materialType', '')),
          COALESCE(NULLIF(metadata ->> 'file_url', ''), NULLIF(metadata ->> 'fileUrl', ''), external_url),
          file_size_bytes
        FROM approved_submission WHERE resource_type = 'practice_material'
        RETURNING content_id
      ),
      created_book AS (
        INSERT INTO coursedekho.book_detail (content_id, book_title, author, publisher, file_url)
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'book_title', ''), NULLIF(metadata ->> 'bookTitle', ''), title),
          NULLIF(metadata ->> 'author', ''),
          NULLIF(metadata ->> 'publisher', ''),
          COALESCE(NULLIF(metadata ->> 'file_url', ''), NULLIF(metadata ->> 'fileUrl', ''), external_url)
        FROM approved_submission WHERE resource_type = 'book'
        RETURNING content_id
      ),
      created_tutorial AS (
        INSERT INTO coursedekho.tutorial_detail (
          content_id, tutorial_title, tutorial_content, file_url
        )
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'tutorial_title', ''), NULLIF(metadata ->> 'tutorialTitle', ''), title),
          COALESCE(NULLIF(metadata ->> 'tutorial_content', ''), NULLIF(metadata ->> 'tutorialContent', ''), description),
          COALESCE(NULLIF(metadata ->> 'file_url', ''), NULLIF(metadata ->> 'fileUrl', ''), external_url)
        FROM approved_submission WHERE resource_type = 'tutorial'
        RETURNING content_id
      ),
      created_slide AS (
        INSERT INTO coursedekho.slide_detail (content_id, slide_title, slide_content, file_url)
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'slide_title', ''), NULLIF(metadata ->> 'slideTitle', ''), title),
          COALESCE(NULLIF(metadata ->> 'slide_content', ''), NULLIF(metadata ->> 'slideContent', ''), description),
          COALESCE(NULLIF(metadata ->> 'file_url', ''), NULLIF(metadata ->> 'fileUrl', ''), external_url)
        FROM approved_submission WHERE resource_type = 'slide'
        RETURNING content_id
      ),
      created_question AS (
        INSERT INTO coursedekho.question_detail (
          content_id, question_text, difficulty, points
        )
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'question_text', ''), NULLIF(metadata ->> 'questionText', ''), title),
          NULLIF(metadata ->> 'difficulty', ''),
          CASE WHEN COALESCE(metadata ->> 'points', '') ~ '^[0-9]+$'
            THEN (metadata ->> 'points')::integer ELSE NULL END
        FROM approved_submission WHERE resource_type = 'question'
        RETURNING content_id
      ),
      created_leetcode AS (
        INSERT INTO coursedekho.leetcode_problem_detail (
          content_id, problem_title, problem_url, difficulty
        )
        SELECT $2::bigint,
          COALESCE(NULLIF(metadata ->> 'problem_title', ''), NULLIF(metadata ->> 'problemTitle', ''), title),
          COALESCE(NULLIF(metadata ->> 'problem_url', ''), NULLIF(metadata ->> 'problemUrl', ''), external_url),
          NULLIF(metadata ->> 'difficulty', '')
        FROM approved_submission WHERE resource_type = 'leetcode_problem'
        RETURNING content_id
      )
      SELECT content_id::text AS internal_id FROM created_study
      UNION ALL SELECT content_id::text FROM created_practice
      UNION ALL SELECT content_id::text FROM created_book
      UNION ALL SELECT content_id::text FROM created_tutorial
      UNION ALL SELECT content_id::text FROM created_slide
      UNION ALL SELECT content_id::text FROM created_question
      UNION ALL SELECT content_id::text FROM created_leetcode
    `,
    values: [input.submissionId, contentInternalId, submission.resource_type],
  });
  if (detailed.rowCount !== 1) return false;

  const published = await executor.query<InternalIdRow, [string, string, Date]>({
    name: "workspace-publish-approved-content-v1",
    text: `
      UPDATE coursedekho.content AS content
      SET current_revision_id = revision.id,
          topic_id = revision.topic_id,
          resource_type = revision.resource_type,
          is_active = TRUE,
          published_at = revision.approved_at,
          archived_at = NULL,
          updated_at = $3::timestamptz
      FROM coursedekho.content_revision AS revision
      WHERE content.id = $1::bigint AND revision.id = $2::bigint
      RETURNING content.id::text AS internal_id
    `,
    values: [contentInternalId, revisionInternalId, input.reviewedAt],
  });
  if (published.rowCount !== 1) return false;

  await executor.query<InternalIdRow, [string, string, string, Date]>({
    name: "workspace-audit-approved-submission-v1",
    text: `
      INSERT INTO coursedekho.audit_event (
        actor_user_id, event_type, entity_type, entity_public_id, details, occurred_at
      )
      SELECT app_user.id, 'submission.approved', 'content_submission', $1::uuid,
        jsonb_build_object('content_internal_id', $3::bigint), $4::timestamptz
      FROM coursedekho.app_user AS app_user
      WHERE app_user.public_id = $2::uuid
      RETURNING id::text AS internal_id
    `,
    values: [input.submissionId, input.reviewerId, contentInternalId, input.reviewedAt],
  });
  return true;
}

export async function queryRejectSubmission(
  executor: DatabaseExecutor,
  input: { submissionId: string; reviewerId: string; reason: string; reviewedAt: Date }
): Promise<boolean> {
  const result = await executor.query<InternalIdRow, [string, string, string, Date]>({
    name: "workspace-reject-submission-v1",
    text: `
      WITH locked AS (
        SELECT id FROM coursedekho.content_submission
        WHERE public_id = $1::uuid AND status = 'pending'
        FOR UPDATE
      ), reviewed AS (
        UPDATE coursedekho.content_submission AS submission
        SET status = 'rejected',
            reviewed_by_user_id = reviewer.id,
            reviewed_at = $4::timestamptz,
            rejection_reason = $3,
            updated_at = $4::timestamptz
        FROM locked, coursedekho.app_user AS reviewer
        WHERE submission.id = locked.id
          AND reviewer.public_id = $2::uuid
          AND reviewer.role = 'admin'
        RETURNING submission.public_id
      )
      INSERT INTO coursedekho.audit_event (
        actor_user_id, event_type, entity_type, entity_public_id, details, occurred_at
      )
      SELECT reviewer.id, 'submission.rejected', 'content_submission', reviewed.public_id,
        jsonb_build_object('reason', $3), $4::timestamptz
      FROM reviewed
      CROSS JOIN coursedekho.app_user AS reviewer
      WHERE reviewer.public_id = $2::uuid
      RETURNING id::text AS internal_id
    `,
    values: [input.submissionId, input.reviewerId, input.reason, input.reviewedAt],
  });
  return result.rowCount === 1;
}

export async function queryAdminStats(executor: DatabaseExecutor): Promise<AdminStatsRow> {
  const result = await executor.query<AdminStatsRow>({
    name: "workspace-admin-stats-v1",
    text: `
      SELECT
        (SELECT count(*)::integer FROM coursedekho.app_user WHERE is_active) AS user_count,
        (
          SELECT count(*)::integer
          FROM coursedekho.course AS course
          JOIN coursedekho.university AS university ON university.id = course.university_id
          JOIN coursedekho.semester AS semester
            ON semester.id = course.semester_id
           AND semester.university_id = course.university_id
          WHERE course.is_active AND university.is_active AND semester.is_active
        ) AS course_count,
        (
          SELECT count(*)::integer
          FROM coursedekho.content AS content
          JOIN coursedekho.content_revision AS revision ON revision.id = content.current_revision_id
          JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
          JOIN coursedekho.topic AS topic ON topic.id = content.topic_id
          JOIN coursedekho.course AS course ON course.id = topic.course_id
          JOIN coursedekho.university AS university ON university.id = course.university_id
          JOIN coursedekho.semester AS semester
            ON semester.id = course.semester_id
           AND semester.university_id = course.university_id
          WHERE content.is_active
            AND submission.status = 'approved'
            AND topic.is_active AND course.is_active
            AND university.is_active AND semester.is_active
        ) AS published_resource_count,
        (SELECT count(*)::integer FROM coursedekho.content_submission) AS submission_count
    `,
    values: [],
  });
  return result.rows[0];
}
