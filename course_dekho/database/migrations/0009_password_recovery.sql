-- course-dekho:migration 0009
-- Additive, forward-only account recovery. Raw tokens are never persisted.
CREATE TABLE coursedekho.password_reset_token (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user(id) ON DELETE RESTRICT,
    issued_by_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user(id) ON DELETE RESTRICT,
    token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 minutes',
    consumed_at TIMESTAMPTZ,
    CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '30 minutes'),
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
CREATE INDEX password_reset_user_active ON coursedekho.password_reset_token(user_id) WHERE consumed_at IS NULL;
-- Rollback uses a forward compensating migration; existing data is untouched.
