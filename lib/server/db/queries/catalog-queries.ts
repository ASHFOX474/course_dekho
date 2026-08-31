import type { CourseFilters } from "../../domain/models.ts";
import type { DatabaseExecutor } from "../executor.ts";
import type {
  ApprovedResourceRow,
  CourseRow,
  SemesterRow,
  TopicRow,
  UniversityRow,
} from "../rows.ts";

const listUniversitiesSql = `
  SELECT
    university.public_id::text AS university_public_id,
    university.name AS university_name,
    university.short_name AS university_short_name
  FROM coursedekho.university AS university
  WHERE university.is_active
  ORDER BY university.short_name, university.name, university.id
`;

const findUniversitySql = `
  SELECT
    university.public_id::text AS university_public_id,
    university.name AS university_name,
    university.short_name AS university_short_name
  FROM coursedekho.university AS university
  WHERE university.public_id = $1::uuid
    AND university.is_active
`;

const listSemestersSql = `
  SELECT
    semester.public_id::text AS semester_public_id,
    university.public_id::text AS university_public_id,
    semester.name AS semester_name,
    semester.sequence_order AS semester_sequence_order
  FROM coursedekho.university AS university
  JOIN coursedekho.semester AS semester
    ON semester.university_id = university.id
  WHERE university.public_id = $1::uuid
    AND university.is_active
    AND semester.is_active
  ORDER BY semester.sequence_order, semester.id
`;

const courseSelectSql = `
  SELECT
    course.public_id::text AS course_public_id,
    course.code AS course_code,
    course.name AS course_name,
    course.description AS course_description,
    university.public_id::text AS university_public_id,
    university.name AS university_name,
    university.short_name AS university_short_name,
    semester.public_id::text AS semester_public_id,
    semester.name AS semester_name,
    semester.sequence_order AS semester_sequence_order
  FROM coursedekho.course AS course
  JOIN coursedekho.university AS university
    ON university.id = course.university_id
  JOIN coursedekho.semester AS semester
    ON semester.id = course.semester_id
   AND semester.university_id = course.university_id
  WHERE course.is_active
    AND university.is_active
    AND semester.is_active
`;

const listCoursesSql = `${courseSelectSql}
    AND ($1::uuid IS NULL OR university.public_id = $1::uuid)
    AND ($2::uuid IS NULL OR semester.public_id = $2::uuid)
    AND (
      $3::text IS NULL
      OR strpos(lower(course.code), lower($3::text)) > 0
      OR strpos(lower(course.name), lower($3::text)) > 0
      OR strpos(lower(course.description), lower($3::text)) > 0
    )
  ORDER BY university.short_name, semester.sequence_order, course.code, course.id
`;

const findCourseSql = `${courseSelectSql}
    AND course.public_id = $1::uuid
`;

const topicSelectSql = `
  SELECT
    topic.public_id::text AS topic_public_id,
    course.public_id::text AS course_public_id,
    topic.slug AS topic_slug,
    topic.name AS topic_name,
    topic.description AS topic_description,
    topic.sequence_order AS topic_sequence_order,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'public_id', subtopic.public_id::text,
          'slug', subtopic.slug,
          'title', subtopic.title,
          'sequence_order', subtopic.sequence_order
        ) ORDER BY subtopic.sequence_order
      ) FILTER (WHERE subtopic.id IS NOT NULL),
      '[]'::jsonb
    ) AS subtopics
  FROM coursedekho.course AS course
  JOIN coursedekho.university AS university
    ON university.id = course.university_id
  JOIN coursedekho.semester AS semester
    ON semester.id = course.semester_id
   AND semester.university_id = course.university_id
  JOIN coursedekho.topic AS topic
    ON topic.course_id = course.id
  LEFT JOIN coursedekho.topic_subtopic AS subtopic
    ON subtopic.topic_id = topic.id
   AND subtopic.is_active
  WHERE course.is_active
    AND university.is_active
    AND semester.is_active
    AND topic.is_active
`;

const listTopicsSql = `${topicSelectSql}
    AND course.public_id = $1::uuid
  GROUP BY topic.id, course.id
  ORDER BY topic.sequence_order, topic.id
`;

const findTopicSql = `${topicSelectSql}
    AND topic.public_id = $1::uuid
  GROUP BY topic.id, course.id
`;

// Every learner-facing resource read uses this visibility boundary so
// list/detail queries cannot drift to include moderation-queue records.
const approvedResourceSelectSql = `
  SELECT
    content.public_id::text AS content_public_id,
    topic.public_id::text AS topic_public_id,
    course.public_id::text AS course_public_id,
    revision.resource_type,
    revision.title,
    revision.description,
    contributor.public_id::text AS contributor_public_id,
    contributor.name AS contributor_name,
    revision.publication_year,
    revision.topics_covered,
    revision.file_size_bytes,
    content.view_count,
    content.download_count,
    content.published_at
  FROM coursedekho.content AS content
  JOIN coursedekho.content_revision AS revision
    ON revision.id = content.current_revision_id
   AND revision.content_id = content.id
  JOIN coursedekho.content_submission AS submission
    ON submission.id = revision.submission_id
  JOIN coursedekho.topic AS topic
    ON topic.id = content.topic_id
  JOIN coursedekho.course AS course
    ON course.id = topic.course_id
  JOIN coursedekho.university AS university
    ON university.id = course.university_id
  JOIN coursedekho.semester AS semester
    ON semester.id = course.semester_id
   AND semester.university_id = course.university_id
  JOIN coursedekho.app_user AS contributor
    ON contributor.id = revision.contributed_by_user_id
  WHERE submission.status = 'approved'
    AND content.is_active
    AND content.published_at IS NOT NULL
    AND topic.is_active
    AND course.is_active
    AND university.is_active
    AND semester.is_active
`;

const listApprovedResourcesByCourseSql = `${approvedResourceSelectSql}
    AND course.public_id = $1::uuid
  ORDER BY topic.sequence_order, content.published_at DESC, content.id DESC
`;

const listApprovedResourcesByTopicSql = `${approvedResourceSelectSql}
    AND topic.public_id = $1::uuid
  ORDER BY content.published_at DESC, content.id DESC
`;

const findApprovedResourceSql = `${approvedResourceSelectSql}
    AND content.public_id = $1::uuid
`;

export async function queryActiveUniversities(
  executor: DatabaseExecutor
): Promise<UniversityRow[]> {
  const result = await executor.query<UniversityRow, []>({
    name: "catalog-list-active-universities-v1",
    text: listUniversitiesSql,
    values: [],
  });
  return result.rows;
}

export async function queryActiveUniversity(
  executor: DatabaseExecutor,
  universityPublicId: string
): Promise<UniversityRow | null> {
  const result = await executor.query<UniversityRow, [string]>({
    name: "catalog-find-active-university-v1",
    text: findUniversitySql,
    values: [universityPublicId],
  });
  return result.rows[0] ?? null;
}

export async function queryActiveSemesters(
  executor: DatabaseExecutor,
  universityPublicId: string
): Promise<SemesterRow[]> {
  const result = await executor.query<SemesterRow, [string]>({
    name: "catalog-list-active-semesters-v1",
    text: listSemestersSql,
    values: [universityPublicId],
  });
  return result.rows;
}

export async function queryActiveCourses(
  executor: DatabaseExecutor,
  filters: CourseFilters = {}
): Promise<CourseRow[]> {
  const result = await executor.query<
    CourseRow,
    [string | null, string | null, string | null]
  >({
    name: "catalog-list-active-courses-v2",
    text: listCoursesSql,
    values: [filters.universityId ?? null, filters.semesterId ?? null, filters.query ?? null],
  });
  return result.rows;
}

export async function queryActiveCourse(
  executor: DatabaseExecutor,
  coursePublicId: string
): Promise<CourseRow | null> {
  const result = await executor.query<CourseRow, [string]>({
    name: "catalog-find-active-course-v1",
    text: findCourseSql,
    values: [coursePublicId],
  });
  return result.rows[0] ?? null;
}

export async function queryActiveTopics(
  executor: DatabaseExecutor,
  coursePublicId: string
): Promise<TopicRow[]> {
  const result = await executor.query<TopicRow, [string]>({
    name: "catalog-list-active-topics-v1",
    text: listTopicsSql,
    values: [coursePublicId],
  });
  return result.rows;
}

export async function queryActiveTopic(
  executor: DatabaseExecutor,
  topicPublicId: string
): Promise<TopicRow | null> {
  const result = await executor.query<TopicRow, [string]>({
    name: "catalog-find-active-topic-v1",
    text: findTopicSql,
    values: [topicPublicId],
  });
  return result.rows[0] ?? null;
}

export async function queryApprovedResourcesByCourse(
  executor: DatabaseExecutor,
  coursePublicId: string
): Promise<ApprovedResourceRow[]> {
  const result = await executor.query<ApprovedResourceRow, [string]>({
    name: "catalog-list-approved-course-resources-v1",
    text: listApprovedResourcesByCourseSql,
    values: [coursePublicId],
  });
  return result.rows;
}

export async function queryApprovedResources(
  executor: DatabaseExecutor,
  topicPublicId: string
): Promise<ApprovedResourceRow[]> {
  const result = await executor.query<ApprovedResourceRow, [string]>({
    name: "catalog-list-approved-topic-resources-v2",
    text: listApprovedResourcesByTopicSql,
    values: [topicPublicId],
  });
  return result.rows;
}

export async function queryApprovedResource(
  executor: DatabaseExecutor,
  resourcePublicId: string
): Promise<ApprovedResourceRow | null> {
  const result = await executor.query<ApprovedResourceRow, [string]>({
    name: "catalog-find-approved-resource-v1",
    text: findApprovedResourceSql,
    values: [resourcePublicId],
  });
  return result.rows[0] ?? null;
}
