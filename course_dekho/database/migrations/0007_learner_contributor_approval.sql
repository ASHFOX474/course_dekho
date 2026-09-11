-- course-dekho:migration 0007
-- Renames self-registered roles to Learner/Contributor terminology and adds a
-- mandatory admin-approval gate for new learner/contributor self-registrations.
-- Forward-only; never edit after applied. Pre-existing rows (seed accounts,
-- anyone created before this migration) are grandfathered in as approved, so
-- this does not lock anyone out retroactively.
--
-- Physical table/column names (student_profile, teacher_profile,
-- teacher_user_id, course_teacher) are deliberately left unchanged -- they
-- are internal implementation detail, never exposed through the API. Only
-- the coursedekho.user_role enum VALUES and everything user-facing rename.

-- 1. Rename enum labels. This only changes label metadata -- it does not
--    rewrite any row data. Every column typed coursedekho.user_role now
--    accepts 'learner'/'contributor' instead of 'student'/'teacher'.
ALTER TYPE coursedekho.user_role RENAME VALUE 'student' TO 'learner';
ALTER TYPE coursedekho.user_role RENAME VALUE 'teacher' TO 'contributor';

-- 2. Registration approval state.
CREATE TYPE coursedekho.registration_status AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE coursedekho.app_user
    ADD COLUMN registration_status coursedekho.registration_status NOT NULL DEFAULT 'pending',
    ADD COLUMN reviewed_by_user_id BIGINT REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    ADD COLUMN reviewed_at TIMESTAMPTZ,
    ADD COLUMN rejection_reason TEXT;

ALTER TABLE coursedekho.app_user
    ADD CONSTRAINT app_user_registration_review_state CHECK (
        (registration_status = 'pending' AND reviewed_at IS NULL AND rejection_reason IS NULL)
        OR (registration_status = 'approved' AND reviewed_at IS NOT NULL AND rejection_reason IS NULL)
        OR (
            registration_status = 'rejected'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND btrim(rejection_reason) <> ''
        )
    );

-- Grandfather in every account that already existed before this gate: none of
-- them went through the new approval flow, and none of them should be
-- retroactively locked out. reviewed_by_user_id is left NULL for these rows
-- -- "approved by migration", not by a specific admin.
UPDATE coursedekho.app_user
SET registration_status = 'approved',
    reviewed_at = created_at
WHERE registration_status = 'pending';

-- 3. Re-point every trigger function that hardcoded the old role literals, and
--    make the shared role-assertion helper also enforce the new approval gate.
--    CREATE OR REPLACE does not edit migrations 0004/0005 -- it redefines the
--    function's current implementation, the supported way to correct an
--    already-applied migration going forward.

CREATE OR REPLACE FUNCTION coursedekho.assert_user_role(
    target_user_id BIGINT,
    allowed_roles coursedekho.user_role[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    actual_role coursedekho.user_role;
    active BOOLEAN;
    review_state coursedekho.registration_status;
BEGIN
    SELECT role, is_active, registration_status
    INTO actual_role, active, review_state
    FROM coursedekho.app_user
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown user id %', target_user_id USING ERRCODE = '23503';
    END IF;

    IF NOT active THEN
        RAISE EXCEPTION 'Inactive user % cannot perform this operation', target_user_id USING ERRCODE = '23514';
    END IF;

    IF review_state <> 'approved' THEN
        RAISE EXCEPTION 'User % has not been approved (status %)', target_user_id, review_state
            USING ERRCODE = '23514';
    END IF;

    IF NOT (actual_role = ANY (allowed_roles)) THEN
        RAISE EXCEPTION 'User % has role %, expected one of %', target_user_id, actual_role, allowed_roles
            USING ERRCODE = '23514';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION coursedekho.enforce_learner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['learner', 'contributor']::coursedekho.user_role[]
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION coursedekho.enforce_course_teacher_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.teacher_user_id,
        ARRAY['contributor']::coursedekho.user_role[]
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION coursedekho.enforce_content_actor_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM coursedekho.assert_user_role(
            NEW.created_by_user_id,
            ARRAY['contributor', 'admin']::coursedekho.user_role[]
        );
    ELSIF NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id THEN
        RAISE EXCEPTION 'Published-content creator attribution is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION coursedekho.enforce_content_submission_rules()
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
            ARRAY['contributor']::coursedekho.user_role[]
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

CREATE OR REPLACE FUNCTION coursedekho.enforce_topic_progress_enrollment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_course_id BIGINT;
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['learner', 'contributor']::coursedekho.user_role[]
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

CREATE OR REPLACE FUNCTION coursedekho.enforce_active_content_access()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['learner', 'contributor']::coursedekho.user_role[]
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

CREATE OR REPLACE FUNCTION coursedekho.enforce_solved_question_content_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['learner', 'contributor']::coursedekho.user_role[]
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

CREATE OR REPLACE FUNCTION coursedekho.enforce_auth_session_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM coursedekho.assert_user_role(
            NEW.user_id,
            ARRAY['learner', 'contributor', 'admin']::coursedekho.user_role[]
        );
        RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'Session identity and lifetime are immutable'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.last_seen_at < OLD.last_seen_at THEN
        RAISE EXCEPTION 'Session last-seen time cannot move backwards'
            USING ERRCODE = '23514';
    END IF;

    IF OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at THEN
        RAISE EXCEPTION 'Session revocation is immutable'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

-- 4. The two per-role profile triggers pass their expected role as a literal
--    trigger argument (TG_ARGV[0]), so the trigger itself -- not just the
--    function -- has to be dropped and recreated with the renamed literal.
DROP TRIGGER trg_student_profile_role ON coursedekho.student_profile;
CREATE TRIGGER trg_learner_profile_role
BEFORE INSERT OR UPDATE ON coursedekho.student_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_profile_role('learner');

DROP TRIGGER trg_teacher_profile_role ON coursedekho.teacher_profile;
CREATE TRIGGER trg_contributor_profile_role
BEFORE INSERT OR UPDATE ON coursedekho.teacher_profile
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_profile_role('contributor');

-- 5. Index to keep the admin "pending user approvals" queue fast as the table grows.
CREATE INDEX idx_app_user_pending_review
    ON coursedekho.app_user (created_at)
    WHERE registration_status = 'pending';
