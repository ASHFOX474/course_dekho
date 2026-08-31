import type { DatabaseExecutor } from "../executor.ts";
import type { SubmissionRow } from "../rows.ts";

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
  JOIN coursedekho.app_user AS teacher
    ON teacher.id = submission.submitted_by_user_id
  JOIN coursedekho.topic AS topic
    ON topic.id = submission.topic_id
  JOIN coursedekho.course AS course
    ON course.id = topic.course_id
  LEFT JOIN coursedekho.app_user AS reviewer
    ON reviewer.id = submission.reviewed_by_user_id
`;

export async function querySubmissionsByTeacher(
  executor: DatabaseExecutor,
  teacherPublicId: string
): Promise<SubmissionRow[]> {
  const result = await executor.query<SubmissionRow, [string]>({
    name: "submission-list-by-teacher-v1",
    text: `${submissionProjectionSql}
      WHERE teacher.public_id = $1::uuid
      ORDER BY submission.submitted_at DESC, submission.id DESC
    `,
    values: [teacherPublicId],
  });
  return result.rows;
}

export async function querySubmissionByPublicId(
  executor: DatabaseExecutor,
  submissionPublicId: string
): Promise<SubmissionRow | null> {
  const result = await executor.query<SubmissionRow, [string]>({
    name: "submission-find-by-public-id-v1",
    text: `${submissionProjectionSql}
      WHERE submission.public_id = $1::uuid
      LIMIT 1
    `,
    values: [submissionPublicId],
  });
  return result.rows[0] ?? null;
}
