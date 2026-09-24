-- Permit admin-authored resources while preserving pending-first review and immutable history.
-- No rows are rewritten or removed. Admin publication uses one transaction.

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
            ARRAY['contributor', 'admin']::coursedekho.user_role[]
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
