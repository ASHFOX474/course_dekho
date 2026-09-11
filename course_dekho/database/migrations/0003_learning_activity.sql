-- course-dekho:migration 0003
-- Explicit learner state, polymorphic bookmarks, solved questions, and audit.
-- This migration is forward-only. Never edit it after deployment.

CREATE TABLE coursedekho.enrollment (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    course_id BIGINT NOT NULL REFERENCES coursedekho.course (id) ON DELETE RESTRICT,
    status coursedekho.enrollment_status NOT NULL DEFAULT 'active',
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, course_id)
);

CREATE TABLE coursedekho.topic_progress (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    topic_id BIGINT NOT NULL REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, topic_id),
    CONSTRAINT topic_progress_completion_state CHECK (
        (
            progress_percent = 100
            AND is_completed
            AND completed_at IS NOT NULL
        )
        OR (
            progress_percent < 100
            AND NOT is_completed
            AND completed_at IS NULL
        )
    )
);

CREATE TABLE coursedekho.bookmark (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    course_id BIGINT REFERENCES coursedekho.course (id) ON DELETE RESTRICT,
    topic_id BIGINT REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    content_id BIGINT REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(course_id, topic_id, content_id) = 1)
);

CREATE TABLE coursedekho.content_access (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    content_id BIGINT NOT NULL REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursedekho.solved_question (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    content_id BIGINT NOT NULL REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    solved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, content_id)
);

CREATE TABLE coursedekho.audit_event (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    actor_user_id BIGINT REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
    entity_type TEXT NOT NULL CHECK (btrim(entity_type) <> ''),
    entity_public_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
