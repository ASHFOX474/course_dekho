-- course-dekho:migration 0008
-- Fixes a bug introduced in 0007: assert_user_role() was made to require
-- registration_status = 'approved' for EVERY caller. That helper is also
-- called by enforce_profile_role(), which fires while creating the brand
-- new student_profile/teacher_profile row DURING REGISTRATION ITSELF --
-- at which point the user is, by definition, still 'pending'. Every single
-- registration was therefore failing its own approval check before the
-- account could ever become approved (visible as a generic 409 CONFLICT
-- from the check_violation, regardless of how unique the email/username
-- was -- the row never got far enough to hit the unique index).
--
-- Fix: assert_user_role() goes back to NOT checking registration_status
-- (matching its pre-0007 behavior) -- it's shared by profile creation,
-- content creation, submissions, enrollment, progress, bookmarks, and
-- solved questions, none of which should gate on approval state here.
-- The approval gate belongs specifically on session creation (i.e. actually
-- logging in), so it moves to a standalone check inside
-- enforce_auth_session_state() instead of going through the shared helper.

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

CREATE OR REPLACE FUNCTION coursedekho.enforce_auth_session_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    review_state coursedekho.registration_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM coursedekho.assert_user_role(
            NEW.user_id,
            ARRAY['learner', 'contributor', 'admin']::coursedekho.user_role[]
        );

        SELECT registration_status INTO review_state
        FROM coursedekho.app_user
        WHERE id = NEW.user_id;

        IF review_state <> 'approved' THEN
            RAISE EXCEPTION 'User % has not been approved (status %)', NEW.user_id, review_state
                USING ERRCODE = '23514';
        END IF;

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
