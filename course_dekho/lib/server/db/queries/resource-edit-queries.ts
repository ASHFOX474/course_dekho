import type { DatabaseExecutor } from '../executor.ts';
import type { ResourceEdit } from '../../../resource-edit.ts';

export async function queryCreateResourceEdit(executor: DatabaseExecutor, resourceId: string, actorId: string, input: ResourceEdit): Promise<string | null> {
  // Serialize revisions of this identity, then snapshot its current attachment.
  const locked = await executor.query({ text: `SELECT id FROM coursedekho.content WHERE public_id = $1::uuid AND is_active AND current_revision_id IS NOT NULL FOR UPDATE`, values: [resourceId] });
  if (!locked.rows.length) return null;
  const result = await executor.query<{ public_id: string }>({
    text: `INSERT INTO coursedekho.content_submission (
      submitted_by_user_id, topic_id, target_content_id, resource_type, title, description,
      publication_year, topics_covered, storage_key, original_file_name, mime_type,
      file_size_bytes, checksum_sha256, external_url, metadata
    )
    SELECT actor.id, topic.id, content.id, $6::coursedekho.resource_type, $3,
      revision.description, revision.publication_year, revision.topics_covered,
      revision.storage_key, revision.original_file_name, revision.mime_type,
      revision.file_size_bytes, revision.checksum_sha256, revision.external_url,
      revision.metadata
    FROM coursedekho.content content
    JOIN coursedekho.content_revision revision ON revision.id = content.current_revision_id
    JOIN coursedekho.content_submission original ON original.id = revision.submission_id AND original.status = 'approved'
    CROSS JOIN coursedekho.app_user actor
    CROSS JOIN coursedekho.topic topic
    JOIN coursedekho.course course ON course.id = topic.course_id
    JOIN coursedekho.semester semester ON semester.id = course.semester_id AND semester.university_id = course.university_id
    JOIN coursedekho.university university ON university.id = course.university_id
    WHERE content.public_id = $1::uuid AND content.is_active
      AND actor.public_id = $2::uuid AND actor.role = 'admin' AND actor.is_active
      AND course.public_id = $4::uuid AND topic.public_id = $5::uuid
      AND topic.is_active AND course.is_active AND semester.is_active AND university.is_active
    RETURNING public_id::text`,
    values: [resourceId, actorId, input.title, input.courseId, input.topicId, input.resourceType],
  });
  return result.rows[0]?.public_id ?? null;
}
