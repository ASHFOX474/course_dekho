-- course-dekho:migration 0002
-- Submission, publication, metadata, and immutable revision model.
-- This migration is forward-only. Never edit it after deployment.

CREATE TABLE coursedekho.content (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    topic_id BIGINT NOT NULL REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    resource_type coursedekho.resource_type NOT NULL,
    current_revision_id BIGINT,
    created_by_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    download_count BIGINT NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    CONSTRAINT content_publication_state CHECK (
        (is_active AND current_revision_id IS NOT NULL AND published_at IS NOT NULL AND archived_at IS NULL)
        OR (
            NOT is_active
            AND current_revision_id IS NULL
            AND published_at IS NULL
            AND archived_at IS NULL
        )
        OR (
            NOT is_active
            AND current_revision_id IS NOT NULL
            AND published_at IS NOT NULL
            AND archived_at IS NOT NULL
        )
    )
);

CREATE TABLE coursedekho.content_submission (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    submitted_by_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    topic_id BIGINT NOT NULL REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    target_content_id BIGINT REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    resource_type coursedekho.resource_type NOT NULL,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    description TEXT NOT NULL DEFAULT '',
    publication_year INTEGER CHECK (publication_year BETWEEN 1900 AND 2200),
    topics_covered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    storage_key TEXT,
    original_file_name TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0),
    checksum_sha256 TEXT CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
    external_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    status coursedekho.submission_status NOT NULL DEFAULT 'pending',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by_user_id BIGINT REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT content_submission_review_state CHECK (
        (
            status = 'pending'
            AND reviewed_by_user_id IS NULL
            AND reviewed_at IS NULL
            AND rejection_reason IS NULL
        )
        OR (
            status = 'approved'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND rejection_reason IS NULL
        )
        OR (
            status = 'rejected'
            AND reviewed_by_user_id IS NOT NULL
            AND reviewed_at IS NOT NULL
            AND rejection_reason IS NOT NULL
            AND btrim(rejection_reason) <> ''
        )
    ),
    CONSTRAINT content_submission_asset_shape CHECK (
        (storage_key IS NULL AND original_file_name IS NULL AND mime_type IS NULL AND file_size_bytes IS NULL AND checksum_sha256 IS NULL)
        OR (storage_key IS NOT NULL AND original_file_name IS NOT NULL AND mime_type IS NOT NULL AND file_size_bytes IS NOT NULL)
    )
);

CREATE TABLE coursedekho.content_revision (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    content_id BIGINT NOT NULL REFERENCES coursedekho.content (id) ON DELETE RESTRICT,
    submission_id BIGINT NOT NULL REFERENCES coursedekho.content_submission (id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    topic_id BIGINT NOT NULL REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    contributed_by_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    approved_by_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    resource_type coursedekho.resource_type NOT NULL,
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    description TEXT NOT NULL DEFAULT '',
    publication_year INTEGER CHECK (publication_year BETWEEN 1900 AND 2200),
    topics_covered TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    storage_key TEXT,
    original_file_name TEXT,
    mime_type TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0),
    checksum_sha256 TEXT CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
    external_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (submission_id),
    UNIQUE (content_id, version_number),
    UNIQUE (id, content_id),
    CONSTRAINT content_revision_asset_shape CHECK (
        (storage_key IS NULL AND original_file_name IS NULL AND mime_type IS NULL AND file_size_bytes IS NULL AND checksum_sha256 IS NULL)
        OR (storage_key IS NOT NULL AND original_file_name IS NOT NULL AND mime_type IS NOT NULL AND file_size_bytes IS NOT NULL)
    )
);

ALTER TABLE coursedekho.content
    ADD CONSTRAINT content_current_revision_ownership
    FOREIGN KEY (current_revision_id, id)
    REFERENCES coursedekho.content_revision (id, content_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
