-- course-dekho:migration 0006
-- Restores year/semester tracking, a generic user activity log, and typed
-- content subtype tables that mirror the approved ERD's specialization
-- (ISA) design.
--
-- This migration is PURELY ADDITIVE: it does not ALTER, RENAME, or DROP
-- anything from 0001-0005. No existing backend query, repository, or route
-- is affected by applying this file. It is forward-only, matching the
-- convention of every prior migration in this project.

-- ------------------------------------------------------------------
-- 1. Year + Semester_Year
--    Matches the approved ERD. Not yet read by any backend code -- this
--    is schema-only until/unless you wire a feature to it.
-- ------------------------------------------------------------------
CREATE TABLE coursedekho.year (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    year_value INTEGER NOT NULL UNIQUE CHECK (year_value BETWEEN 2000 AND 2100)
);

CREATE TABLE coursedekho.semester_year (
    semester_id BIGINT NOT NULL REFERENCES coursedekho.semester (id) ON DELETE CASCADE,
    year_id BIGINT NOT NULL REFERENCES coursedekho.year (id) ON DELETE CASCADE,
    PRIMARY KEY (semester_id, year_id)
);

-- ------------------------------------------------------------------
-- 2. Activity
--    A generic, user-facing activity log matching the approved ERD.
--    This is intentionally separate from coursedekho.audit_event, which
--    is a security/system audit trail already written to by
--    lib/server/db/queries/workspace-queries.ts -- do not remove that
--    table or repurpose it into this one.
-- ------------------------------------------------------------------
CREATE TABLE coursedekho.activity (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (btrim(activity_type) <> ''),
    description TEXT,
    activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_user ON coursedekho.activity (user_id, activity_at DESC);

-- ------------------------------------------------------------------
-- 3. Typed content subtype tables (restores the ISA/specialization
--    design from the approved ERD).
--
--    These are ADDITIVE companions to coursedekho.content -- they do
--    NOT replace resource_type or content_revision, and no existing
--    backend query breaks by adding them. Each row is meant to be 1:1
--    with a coursedekho.content row whose resource_type matches.
--
--    IMPORTANT: your backend does not populate these yet. Approving a
--    submission today only writes to content/content_revision. Treat
--    these as "schema is ready, wiring is a follow-up task" -- say so
--    if asked in a viva, rather than implying they're already live.
-- ------------------------------------------------------------------
CREATE TABLE coursedekho.study_material_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    material_type TEXT,
    file_url TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0)
);

CREATE TABLE coursedekho.practice_material_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    material_type TEXT,
    file_url TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes >= 0)
);

CREATE TABLE coursedekho.book_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    book_title TEXT NOT NULL,
    author TEXT,
    publisher TEXT,
    file_url TEXT
);

CREATE TABLE coursedekho.tutorial_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    tutorial_title TEXT NOT NULL,
    tutorial_content TEXT,
    file_url TEXT
);

CREATE TABLE coursedekho.slide_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    slide_title TEXT NOT NULL,
    slide_content TEXT,
    file_url TEXT
);

CREATE TABLE coursedekho.question_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    difficulty TEXT,
    points INTEGER
);

CREATE TABLE coursedekho.leetcode_problem_detail (
    content_id BIGINT PRIMARY KEY REFERENCES coursedekho.content (id) ON DELETE CASCADE,
    problem_title TEXT NOT NULL,
    problem_url TEXT,
    difficulty TEXT
);

-- Rollback: intentionally forward-only, matching 0001-0005's convention.
