-- course-dekho:migration 0014
-- Forward-only learner enrollment review, continuation, completion, and theme state.

CREATE TYPE coursedekho.enrollment_review_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

ALTER TABLE coursedekho.enrollment
    ADD COLUMN review_status coursedekho.enrollment_review_status NOT NULL DEFAULT 'approved',
    ADD COLUMN requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN reviewed_by_user_id BIGINT REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    ADD COLUMN reviewed_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN rejection_reason TEXT;

-- Every enrollment that predates the review workflow was already usable, so it
-- remains approved. A nullable reviewer distinguishes this legacy backfill from
-- new admin-reviewed requests without inventing an actor. Defaults backfill the
-- existing rows without firing current business-rule triggers against legacy
-- users; future rows start pending and do not receive a review timestamp.
ALTER TABLE coursedekho.enrollment
    ALTER COLUMN review_status SET DEFAULT 'pending',
    ALTER COLUMN reviewed_at DROP DEFAULT;

ALTER TABLE coursedekho.enrollment
    ADD CONSTRAINT enrollment_review_state CHECK (
        (
            review_status = 'pending'
            AND reviewed_by_user_id IS NULL
            AND reviewed_at IS NULL
            AND rejection_reason IS NULL
        )
        OR (
            review_status = 'approved'
            AND reviewed_at IS NOT NULL
            AND rejection_reason IS NULL
        )
        OR (
            review_status = 'rejected'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND rejection_reason IS NOT NULL
            AND btrim(rejection_reason) <> ''
        )
    );

CREATE TABLE coursedekho.resource_completion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    content_id BIGINT NOT NULL REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, content_id)
);

CREATE TABLE coursedekho.learning_folder_activity (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT UNIQUE,
    course_id BIGINT NOT NULL REFERENCES coursedekho.course (id) ON DELETE RESTRICT,
    topic_id BIGINT REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursedekho.user_display_preference (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT UNIQUE,
    theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enrollment_review_queue
    ON coursedekho.enrollment (review_status, requested_at, id)
    WHERE review_status = 'pending';

CREATE INDEX idx_enrollment_user_review
    ON coursedekho.enrollment (user_id, review_status, status);

CREATE INDEX idx_resource_completion_user_recent
    ON coursedekho.resource_completion (user_id, completed_at DESC, id DESC);

CREATE INDEX idx_learning_folder_activity_user_recent
    ON coursedekho.learning_folder_activity (user_id, opened_at DESC);

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
