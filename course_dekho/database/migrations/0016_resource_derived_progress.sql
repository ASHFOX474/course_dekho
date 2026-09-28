-- course-dekho:migration 0016
-- Topic and course progress are derived from completed approved topic resources.

CREATE FUNCTION coursedekho.calculate_topic_progress(
    p_user_id BIGINT,
    p_topic_id BIGINT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        round(
            count(completion.id)::numeric * 100
            / NULLIF(count(content.id), 0)
        ),
        0
    )::integer
    FROM coursedekho.content AS content
    JOIN coursedekho.content_revision AS revision
      ON revision.id = content.current_revision_id
    JOIN coursedekho.content_submission AS submission
      ON submission.id = revision.submission_id
     AND submission.status = 'approved'
    LEFT JOIN coursedekho.resource_completion AS completion
      ON completion.content_id = content.id
     AND completion.user_id = p_user_id
    WHERE content.topic_id = p_topic_id
      AND content.is_active
      AND content.resource_type IN ('tutorial', 'question', 'leetcode_problem');
$$;

CREATE OR REPLACE FUNCTION coursedekho.calculate_course_progress(
    p_user_id BIGINT,
    p_course_id BIGINT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(round(avg(topic_progress.progress_percent)), 0)::integer
    FROM (
        SELECT coursedekho.calculate_topic_progress(p_user_id, topic.id) AS progress_percent
        FROM coursedekho.topic AS topic
        WHERE topic.course_id = p_course_id
          AND topic.is_active
          AND EXISTS (
              SELECT 1
              FROM coursedekho.content AS content
              JOIN coursedekho.content_revision AS revision
                ON revision.id = content.current_revision_id
              JOIN coursedekho.content_submission AS submission
                ON submission.id = revision.submission_id
               AND submission.status = 'approved'
              WHERE content.topic_id = topic.id
                AND content.is_active
                AND content.resource_type IN ('tutorial', 'question', 'leetcode_problem')
          )
    ) AS topic_progress;
$$;

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
