-- course-dekho:migration 0005
-- Opaque, revocable application sessions.
-- This migration is forward-only. Never edit it after deployment; use a
-- reviewed compensating migration for corrections.

CREATE TABLE coursedekho.auth_session (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT auth_session_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT auth_session_lifetime CHECK (
        expires_at > created_at
        AND expires_at <= created_at + INTERVAL '30 days'
    ),
    CONSTRAINT auth_session_last_seen_order CHECK (
        last_seen_at >= created_at
        AND last_seen_at <= expires_at
    ),
    CONSTRAINT auth_session_revocation_order CHECK (
        revoked_at IS NULL OR revoked_at >= created_at
    )
);

CREATE FUNCTION coursedekho.enforce_auth_session_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM coursedekho.assert_user_role(
            NEW.user_id,
            ARRAY['student', 'teacher', 'admin']::coursedekho.user_role[]
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

CREATE TRIGGER trg_auth_session_state
BEFORE INSERT OR UPDATE ON coursedekho.auth_session
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_auth_session_state();

-- This table is created empty, so ordinary transactional index creation is
-- safe. Future indexes on a populated auth_session table require a separately
-- reviewed non-transactional CONCURRENTLY migration.
CREATE INDEX idx_auth_session_user_active
    ON coursedekho.auth_session (user_id, expires_at DESC)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_session_expiry_active
    ON coursedekho.auth_session (expires_at)
    WHERE revoked_at IS NULL;

-- Revoked/expired sessions are transient security records and may later be
-- purged by an explicit retention job. User deletion remains restricted.
-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
