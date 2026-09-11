-- course-dekho:migration 0001
-- Identity and academic structure baseline.
-- This migration is forward-only. Production rollback requires a compensating
-- migration; never edit this file after it has been applied.

CREATE SCHEMA IF NOT EXISTS coursedekho;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE coursedekho.user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE coursedekho.resource_type AS ENUM (
    'study_material',
    'practice_material',
    'book',
    'tutorial',
    'slide',
    'question',
    'leetcode_problem'
);
CREATE TYPE coursedekho.submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE coursedekho.enrollment_status AS ENUM ('active', 'completed', 'dropped');

CREATE FUNCTION coursedekho.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TABLE coursedekho.app_user (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    email TEXT NOT NULL CHECK (btrim(email) <> ''),
    username TEXT NOT NULL CHECK (btrim(username) <> ''),
    password_hash TEXT NOT NULL CHECK (btrim(password_hash) <> ''),
    role coursedekho.user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deactivated_at TIMESTAMPTZ,
    CONSTRAINT app_user_deactivation_state CHECK (
        (is_active AND deactivated_at IS NULL)
        OR (NOT is_active AND deactivated_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_app_user_email_ci ON coursedekho.app_user (lower(email));
CREATE UNIQUE INDEX uq_app_user_username_ci ON coursedekho.app_user (lower(username));

CREATE TABLE coursedekho.university (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    short_name TEXT NOT NULL CHECK (btrim(short_name) <> ''),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    UNIQUE (slug),
    UNIQUE (short_name),
    CONSTRAINT university_archive_state CHECK (
        (is_active AND archived_at IS NULL)
        OR (NOT is_active AND archived_at IS NOT NULL)
    )
);

CREATE TABLE coursedekho.student_profile (
    user_id BIGINT PRIMARY KEY REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    university_id BIGINT NOT NULL REFERENCES coursedekho.university (id) ON DELETE RESTRICT,
    department TEXT,
    year_of_study SMALLINT CHECK (year_of_study BETWEEN 1 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursedekho.teacher_profile (
    user_id BIGINT PRIMARY KEY REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    university_id BIGINT NOT NULL REFERENCES coursedekho.university (id) ON DELETE RESTRICT,
    department TEXT,
    designation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursedekho.admin_profile (
    user_id BIGINT PRIMARY KEY REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    level TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE coursedekho.semester (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    university_id BIGINT NOT NULL REFERENCES coursedekho.university (id) ON DELETE RESTRICT,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    starts_on DATE,
    ends_on DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    UNIQUE (id, university_id),
    UNIQUE (university_id, slug),
    UNIQUE (university_id, sequence_order),
    CONSTRAINT semester_date_order CHECK (
        starts_on IS NULL OR ends_on IS NULL OR starts_on <= ends_on
    ),
    CONSTRAINT semester_archive_state CHECK (
        (is_active AND archived_at IS NULL)
        OR (NOT is_active AND archived_at IS NOT NULL)
    )
);

CREATE TABLE coursedekho.course (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    university_id BIGINT NOT NULL REFERENCES coursedekho.university (id) ON DELETE RESTRICT,
    semester_id BIGINT NOT NULL,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    code TEXT NOT NULL CHECK (btrim(code) <> '' AND code = upper(code)),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    UNIQUE (university_id, slug),
    UNIQUE (university_id, code),
    CONSTRAINT course_semester_ownership
        FOREIGN KEY (semester_id, university_id)
        REFERENCES coursedekho.semester (id, university_id)
        ON DELETE RESTRICT,
    CONSTRAINT course_archive_state CHECK (
        (is_active AND archived_at IS NULL)
        OR (NOT is_active AND archived_at IS NOT NULL)
    )
);

CREATE TABLE coursedekho.topic (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    course_id BIGINT NOT NULL REFERENCES coursedekho.course (id) ON DELETE RESTRICT,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT NOT NULL DEFAULT '',
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    UNIQUE (course_id, slug),
    UNIQUE (course_id, sequence_order),
    CONSTRAINT topic_archive_state CHECK (
        (is_active AND archived_at IS NULL)
        OR (NOT is_active AND archived_at IS NOT NULL)
    )
);

CREATE TABLE coursedekho.topic_subtopic (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    topic_id BIGINT NOT NULL REFERENCES coursedekho.topic (id) ON DELETE RESTRICT,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    title TEXT NOT NULL CHECK (btrim(title) <> ''),
    sequence_order INTEGER NOT NULL CHECK (sequence_order > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_at TIMESTAMPTZ,
    UNIQUE (topic_id, slug),
    UNIQUE (topic_id, sequence_order),
    CONSTRAINT topic_subtopic_archive_state CHECK (
        (is_active AND archived_at IS NULL)
        OR (NOT is_active AND archived_at IS NOT NULL)
    )
);

CREATE TABLE coursedekho.course_teacher (
    course_id BIGINT NOT NULL REFERENCES coursedekho.course (id) ON DELETE RESTRICT,
    teacher_user_id BIGINT NOT NULL REFERENCES coursedekho.app_user (id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (course_id, teacher_user_id)
);

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
