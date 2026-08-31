-- course-dekho:migration 0004
-- Cross-table lifecycle enforcement, soft-delete guards, and initial indexes.
-- This migration is forward-only. The ordinary indexes are safe here because
-- this is an empty-schema baseline; indexes added to populated tables later
-- must use a separately reviewed concurrent migration.

CREATE FUNCTION coursedekho.assert_user_role(
    target_user_id BIGINT,
    allowed_roles coursedekho.user_role[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    actual_role coursedekho.user_role;
    active BOOLEAN;
BEGIN
    SELECT role, is_active
    INTO actual_role, active
    FROM coursedekho.app_user
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown user id %', target_user_id USING ERRCODE = '23503';
    END IF;

    IF NOT active THEN
        RAISE EXCEPTION 'Inactive user % cannot perform this operation', target_user_id USING ERRCODE = '23514';
    END IF;

    IF NOT (actual_role = ANY (allowed_roles)) THEN
        RAISE EXCEPTION 'User % has role %, expected one of %', target_user_id, actual_role, allowed_roles
            USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE FUNCTION coursedekho.enforce_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY[TG_ARGV[0]::coursedekho.user_role]
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_learner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['student', 'teacher']::coursedekho.user_role[]
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_course_teacher_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.teacher_user_id,
        ARRAY['teacher']::coursedekho.user_role[]
    );
    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_user_role_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'User roles cannot be changed in place; migrate role profiles explicitly'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_content_actor_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM coursedekho.assert_user_role(
            NEW.created_by_user_id,
            ARRAY['teacher', 'admin']::coursedekho.user_role[]
        );
    ELSIF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
        RAISE EXCEPTION 'Published-content creator attribution is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_content_submission_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_type coursedekho.resource_type;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' THEN
            RAISE EXCEPTION 'New submissions must start pending'
                USING ERRCODE = '23514';
        END IF;

        PERFORM coursedekho.assert_user_role(
            NEW.submitted_by_user_id,
            ARRAY['teacher']::coursedekho.user_role[]
        );
    ELSE
        IF OLD.status <> 'pending' THEN
            RAISE EXCEPTION 'Reviewed submissions are immutable'
                USING ERRCODE = '23514';
        END IF;

        IF NEW.public_id IS DISTINCT FROM OLD.public_id
           OR NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id
           OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
           OR NEW.target_content_id IS DISTINCT FROM OLD.target_content_id
           OR NEW.resource_type IS DISTINCT FROM OLD.resource_type THEN
            RAISE EXCEPTION 'Submission identity, author, target, and resource type are immutable'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    IF NEW.reviewed_by_user_id IS NOT NULL THEN
        PERFORM coursedekho.assert_user_role(
            NEW.reviewed_by_user_id,
            ARRAY['admin']::coursedekho.user_role[]
        );
    END IF;

    IF NEW.target_content_id IS NOT NULL THEN
        SELECT resource_type
        INTO target_type
        FROM coursedekho.content
        WHERE id = NEW.target_content_id;

        IF NOT FOUND OR target_type IS DISTINCT FROM NEW.resource_type THEN
            RAISE EXCEPTION 'A content revision cannot change resource type'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_content_revision_source()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_content BIGINT;
    expected_version INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM coursedekho.content_submission AS submission
        WHERE submission.id = NEW.submission_id
          AND submission.status = 'approved'
          AND submission.submitted_by_user_id = NEW.contributed_by_user_id
          AND submission.reviewed_by_user_id = NEW.approved_by_user_id
          AND submission.reviewed_at = NEW.approved_at
          AND submission.topic_id = NEW.topic_id
          AND submission.resource_type = NEW.resource_type
          AND submission.title = NEW.title
          AND submission.description = NEW.description
          AND submission.publication_year IS NOT DISTINCT FROM NEW.publication_year
          AND submission.topics_covered IS NOT DISTINCT FROM NEW.topics_covered
          AND submission.storage_key IS NOT DISTINCT FROM NEW.storage_key
          AND submission.original_file_name IS NOT DISTINCT FROM NEW.original_file_name
          AND submission.mime_type IS NOT DISTINCT FROM NEW.mime_type
          AND submission.file_size_bytes IS NOT DISTINCT FROM NEW.file_size_bytes
          AND submission.checksum_sha256 IS NOT DISTINCT FROM NEW.checksum_sha256
          AND submission.external_url IS NOT DISTINCT FROM NEW.external_url
          AND submission.metadata IS NOT DISTINCT FROM NEW.metadata
    ) THEN
        RAISE EXCEPTION 'Content revisions must exactly snapshot an approved submission'
            USING ERRCODE = '23514';
    END IF;

    SELECT target_content_id
    INTO target_content
    FROM coursedekho.content_submission
    WHERE id = NEW.submission_id;

    IF target_content IS NULL THEN
        IF NEW.version_number <> 1 THEN
            RAISE EXCEPTION 'New content must start at revision 1'
                USING ERRCODE = '23514';
        END IF;
    ELSE
        IF NEW.content_id <> target_content THEN
            RAISE EXCEPTION 'Revision content does not match the submission target'
                USING ERRCODE = '23514';
        END IF;

        SELECT COALESCE(MAX(version_number), 0) + 1
        INTO expected_version
        FROM coursedekho.content_revision
        WHERE content_id = NEW.content_id;

        IF NEW.version_number <> expected_version THEN
            RAISE EXCEPTION 'Expected content revision %, received %', expected_version, NEW.version_number
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_content_current_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    revision_content_id BIGINT;
    revision_topic_id BIGINT;
    revision_type coursedekho.resource_type;
BEGIN
    IF NEW.current_revision_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT content_id, topic_id, resource_type
    INTO revision_content_id, revision_topic_id, revision_type
    FROM coursedekho.content_revision
    WHERE id = NEW.current_revision_id;

    IF NOT FOUND
       OR revision_content_id <> NEW.id
       OR revision_topic_id <> NEW.topic_id
       OR revision_type <> NEW.resource_type THEN
        RAISE EXCEPTION 'Current revision must belong to and match its content identity'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_topic_progress_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_course_id BIGINT;
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['student', 'teacher']::coursedekho.user_role[]
    );

    SELECT course_id INTO target_course_id
    FROM coursedekho.topic
    WHERE id = NEW.topic_id;

    IF NOT EXISTS (
        SELECT 1
        FROM coursedekho.enrollment
        WHERE user_id = NEW.user_id
          AND course_id = target_course_id
          AND status IN ('active', 'completed')
    ) THEN
        RAISE EXCEPTION 'Progress requires an explicit active or completed enrollment'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_active_content_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['student', 'teacher']::coursedekho.user_role[]
    );

    IF NOT EXISTS (
        SELECT 1 FROM coursedekho.content
        WHERE id = NEW.content_id AND is_active
    ) THEN
        RAISE EXCEPTION 'Only active published content can be accessed'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.enforce_solved_question_content_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['student', 'teacher']::coursedekho.user_role[]
    );

    IF NOT EXISTS (
        SELECT 1 FROM coursedekho.content
        WHERE id = NEW.content_id
          AND resource_type = 'question'
          AND is_active
    ) THEN
        RAISE EXCEPTION 'Solved-question rows require active question content'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE FUNCTION coursedekho.prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Hard deletes are disabled for %.%; use the lifecycle fields instead', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION coursedekho.prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Rows in %.% are immutable', TG_TABLE_SCHEMA, TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER trg_student_profile_role
BEFORE INSERT OR UPDATE ON coursedekho.student_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_profile_role('student');

CREATE TRIGGER trg_teacher_profile_role
BEFORE INSERT OR UPDATE ON coursedekho.teacher_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_profile_role('teacher');

CREATE TRIGGER trg_admin_profile_role
BEFORE INSERT OR UPDATE ON coursedekho.admin_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_profile_role('admin');

CREATE TRIGGER trg_course_teacher_role
BEFORE INSERT OR UPDATE ON coursedekho.course_teacher
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_course_teacher_role();

CREATE TRIGGER trg_app_user_role_immutable
BEFORE UPDATE OF role ON coursedekho.app_user
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_user_role_immutable();

CREATE TRIGGER trg_content_actor_role
BEFORE INSERT OR UPDATE ON coursedekho.content
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_content_actor_role();

CREATE TRIGGER trg_content_submission_transition
BEFORE INSERT OR UPDATE ON coursedekho.content_submission
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_content_submission_rules();

CREATE TRIGGER trg_content_revision_source
BEFORE INSERT ON coursedekho.content_revision
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_content_revision_source();

CREATE TRIGGER trg_content_current_revision
BEFORE INSERT OR UPDATE ON coursedekho.content
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_content_current_revision();

CREATE TRIGGER trg_enrollment_learner_role
BEFORE INSERT OR UPDATE ON coursedekho.enrollment
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learner_role();

CREATE TRIGGER trg_topic_progress_enrollment
BEFORE INSERT OR UPDATE ON coursedekho.topic_progress
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_topic_progress_enrollment();

CREATE TRIGGER trg_bookmark_learner_role
BEFORE INSERT OR UPDATE ON coursedekho.bookmark
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learner_role();

CREATE TRIGGER trg_content_access_active
BEFORE INSERT OR UPDATE ON coursedekho.content_access
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_active_content_access();

CREATE TRIGGER trg_solved_question_content_type
BEFORE INSERT OR UPDATE ON coursedekho.solved_question
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_solved_question_content_type();

CREATE TRIGGER trg_app_user_updated_at
BEFORE UPDATE ON coursedekho.app_user
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_university_updated_at
BEFORE UPDATE ON coursedekho.university
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_student_profile_updated_at
BEFORE UPDATE ON coursedekho.student_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_teacher_profile_updated_at
BEFORE UPDATE ON coursedekho.teacher_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_admin_profile_updated_at
BEFORE UPDATE ON coursedekho.admin_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_semester_updated_at
BEFORE UPDATE ON coursedekho.semester
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_course_updated_at
BEFORE UPDATE ON coursedekho.course
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_topic_updated_at
BEFORE UPDATE ON coursedekho.topic
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_topic_subtopic_updated_at
BEFORE UPDATE ON coursedekho.topic_subtopic
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_content_updated_at
BEFORE UPDATE ON coursedekho.content
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_content_submission_updated_at
BEFORE UPDATE ON coursedekho.content_submission
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_enrollment_updated_at
BEFORE UPDATE ON coursedekho.enrollment
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_topic_progress_updated_at
BEFORE UPDATE ON coursedekho.topic_progress
FOR EACH ROW EXECUTE FUNCTION coursedekho.set_updated_at();

CREATE TRIGGER trg_app_user_prevent_delete
BEFORE DELETE ON coursedekho.app_user
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_student_profile_prevent_delete
BEFORE DELETE ON coursedekho.student_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_teacher_profile_prevent_delete
BEFORE DELETE ON coursedekho.teacher_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_admin_profile_prevent_delete
BEFORE DELETE ON coursedekho.admin_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_university_prevent_delete
BEFORE DELETE ON coursedekho.university
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_semester_prevent_delete
BEFORE DELETE ON coursedekho.semester
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_course_prevent_delete
BEFORE DELETE ON coursedekho.course
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_topic_prevent_delete
BEFORE DELETE ON coursedekho.topic
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_topic_subtopic_prevent_delete
BEFORE DELETE ON coursedekho.topic_subtopic
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_content_submission_prevent_delete
BEFORE DELETE ON coursedekho.content_submission
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_content_prevent_delete
BEFORE DELETE ON coursedekho.content
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_content_revision_immutable
BEFORE UPDATE OR DELETE ON coursedekho.content_revision
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_mutation();

CREATE TRIGGER trg_enrollment_prevent_delete
BEFORE DELETE ON coursedekho.enrollment
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_topic_progress_prevent_delete
BEFORE DELETE ON coursedekho.topic_progress
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_content_access_immutable
BEFORE UPDATE OR DELETE ON coursedekho.content_access
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_mutation();

CREATE TRIGGER trg_solved_question_prevent_delete
BEFORE DELETE ON coursedekho.solved_question
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();

CREATE TRIGGER trg_audit_event_immutable
BEFORE UPDATE OR DELETE ON coursedekho.audit_event
FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_mutation();

CREATE INDEX idx_student_profile_university ON coursedekho.student_profile (university_id);
CREATE INDEX idx_teacher_profile_university ON coursedekho.teacher_profile (university_id);
CREATE INDEX idx_semester_university_active_order ON coursedekho.semester (university_id, is_active, sequence_order);
CREATE INDEX idx_course_university_semester ON coursedekho.course (semester_id, university_id, is_active);
CREATE INDEX idx_topic_course_active_order ON coursedekho.topic (course_id, is_active, sequence_order);
CREATE INDEX idx_topic_subtopic_topic_order ON coursedekho.topic_subtopic (topic_id, sequence_order);
CREATE INDEX idx_course_teacher_teacher ON coursedekho.course_teacher (teacher_user_id, course_id);

CREATE INDEX idx_submission_pending_queue
    ON coursedekho.content_submission (submitted_at, id)
    WHERE status = 'pending';
CREATE INDEX idx_submission_teacher_recent
    ON coursedekho.content_submission (submitted_by_user_id, submitted_at DESC, id DESC);
CREATE INDEX idx_submission_topic ON coursedekho.content_submission (topic_id);
CREATE INDEX idx_submission_reviewer ON coursedekho.content_submission (reviewed_by_user_id) WHERE reviewed_by_user_id IS NOT NULL;
CREATE INDEX idx_submission_target_content ON coursedekho.content_submission (target_content_id) WHERE target_content_id IS NOT NULL;

CREATE INDEX idx_content_topic_published
    ON coursedekho.content (topic_id, published_at DESC, id DESC)
    WHERE is_active;
CREATE INDEX idx_content_current_revision ON coursedekho.content (current_revision_id) WHERE current_revision_id IS NOT NULL;
CREATE INDEX idx_content_creator ON coursedekho.content (created_by_user_id);
CREATE INDEX idx_content_revision_content_recent ON coursedekho.content_revision (content_id, version_number DESC);
CREATE INDEX idx_content_revision_topic ON coursedekho.content_revision (topic_id);
CREATE INDEX idx_content_revision_contributor ON coursedekho.content_revision (contributed_by_user_id);
CREATE INDEX idx_content_revision_approver ON coursedekho.content_revision (approved_by_user_id);
CREATE INDEX idx_content_revision_metadata_gin ON coursedekho.content_revision USING GIN (metadata);

CREATE INDEX idx_enrollment_user_status ON coursedekho.enrollment (user_id, status, course_id);
CREATE INDEX idx_enrollment_course_status ON coursedekho.enrollment (course_id, status, user_id);
CREATE INDEX idx_topic_progress_user_recent ON coursedekho.topic_progress (user_id, last_accessed_at DESC, topic_id);
CREATE INDEX idx_topic_progress_topic ON coursedekho.topic_progress (topic_id, user_id);

CREATE UNIQUE INDEX uq_bookmark_user_course
    ON coursedekho.bookmark (user_id, course_id)
    WHERE course_id IS NOT NULL;
CREATE UNIQUE INDEX uq_bookmark_user_topic
    ON coursedekho.bookmark (user_id, topic_id)
    WHERE topic_id IS NOT NULL;
CREATE UNIQUE INDEX uq_bookmark_user_content
    ON coursedekho.bookmark (user_id, content_id)
    WHERE content_id IS NOT NULL;
CREATE INDEX idx_bookmark_user_recent ON coursedekho.bookmark (user_id, created_at DESC, id DESC);
CREATE INDEX idx_bookmark_course ON coursedekho.bookmark (course_id) WHERE course_id IS NOT NULL;
CREATE INDEX idx_bookmark_topic ON coursedekho.bookmark (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX idx_bookmark_content ON coursedekho.bookmark (content_id) WHERE content_id IS NOT NULL;

CREATE INDEX idx_content_access_user_recent ON coursedekho.content_access (user_id, accessed_at DESC, id DESC);
CREATE INDEX idx_content_access_content_recent ON coursedekho.content_access (content_id, accessed_at DESC);
CREATE INDEX idx_content_access_time_brin ON coursedekho.content_access USING BRIN (accessed_at);
CREATE INDEX idx_solved_question_user_recent ON coursedekho.solved_question (user_id, solved_at DESC, id DESC);
CREATE INDEX idx_solved_question_content ON coursedekho.solved_question (content_id);
CREATE INDEX idx_audit_event_entity_recent ON coursedekho.audit_event (entity_type, entity_public_id, occurred_at DESC);
CREATE INDEX idx_audit_event_actor_recent ON coursedekho.audit_event (actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_event_time_brin ON coursedekho.audit_event USING BRIN (occurred_at);

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
