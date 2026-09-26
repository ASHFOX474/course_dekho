-- course-dekho:migration 0013
-- Forward-only checklist routines for computed progress and account deactivation.

CREATE FUNCTION coursedekho.calculate_course_progress(
    p_user_id BIGINT,
    p_course_id BIGINT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(
        round(
            sum(COALESCE(progress.progress_percent, 0))::numeric
            / NULLIF(count(topic.id), 0)
        ),
        0
    )::integer
    FROM coursedekho.topic AS topic
    LEFT JOIN coursedekho.topic_progress AS progress
      ON progress.topic_id = topic.id
     AND progress.user_id = p_user_id
    WHERE topic.course_id = p_course_id
      AND topic.is_active;
$$;

CREATE PROCEDURE coursedekho.deactivate_user_and_revoke_sessions(
    IN p_actor_public_id UUID,
    IN p_target_public_id UUID,
    IN p_at TIMESTAMPTZ,
    INOUT p_changed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_target_id BIGINT;
BEGIN
    p_changed := FALSE;

    IF NOT EXISTS (
        SELECT 1
        FROM coursedekho.app_user
        WHERE public_id = p_actor_public_id
          AND role = 'admin'
          AND is_active
          AND registration_status = 'approved'
    ) THEN
        RAISE EXCEPTION 'An active approved admin is required'
            USING ERRCODE = '42501';
    END IF;

    IF p_actor_public_id = p_target_public_id THEN
        RAISE EXCEPTION 'Self-deactivation is not allowed'
            USING ERRCODE = '42501';
    END IF;

    UPDATE coursedekho.app_user
    SET is_active = FALSE,
        deactivated_at = p_at
    WHERE public_id = p_target_public_id
      AND is_active
    RETURNING id INTO v_target_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE coursedekho.auth_session
    SET revoked_at = GREATEST(p_at, created_at)
    WHERE user_id = v_target_id
      AND revoked_at IS NULL;

    p_changed := TRUE;
END;
$$;
