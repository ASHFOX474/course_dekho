-- course-dekho:seed 0001
-- Canonical development/demo data. The seed runner blocks production by
-- default and wraps this file in a transaction. This file is idempotent.

INSERT INTO coursedekho.app_user (
    public_id, name, email, username, password_hash, role
)
VALUES
    (
        '00000000-0000-4000-8000-000000000101',
        'Rafiul Islam',
        'rafiul@student.coursedekho.local',
        'rafiul',
        'scrypt$32768$8$1$emSGGtummQCAlc7T79X8rA$ArNFeEsmFXbwh6nAZHiA-Medhm7s8esEdZbf_MUvNV46nKO750sdWpP08jHMmqcsbKIWVkIzSQsNj36ybAkDcA',
        'student'::coursedekho.user_role
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        'Dr. Sharif Ahmed',
        'sharif@teacher.coursedekho.local',
        'sharif',
        'scrypt$32768$8$1$pUh__Z2LVd1bGjv1k8KyNw$V418rmZoAazqK_1TbAtX43AlzWXG9B7Ou_jFGW6ZJCVqULUo_rizkIQ0L_HoWtxB8COjRhcrSrjLwZxk3s1Puw',
        'teacher'::coursedekho.user_role
    ),
    (
        '00000000-0000-4000-8000-000000000103',
        'Nusrat Jahan',
        'nusrat@admin.coursedekho.local',
        'nusrat',
        'scrypt$32768$8$1$AKLjKw1ez-SAo4TDPgxMnA$TLBWbbtQobShHK0IZ9GSEg8S4dpF_97i7J-gYX40AE7KUR4KVDpjIbyCuWynBaXJC2nrNG-B7j0E7NoapMTNhQ',
        'admin'::coursedekho.user_role
    )
ON CONFLICT (public_id) DO UPDATE
SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = TRUE,
    deactivated_at = NULL;

INSERT INTO coursedekho.university (
    public_id, slug, name, short_name
)
VALUES (
    '00000000-0000-4000-8000-000000000201',
    'buet',
    'Bangladesh University of Engineering and Technology',
    'BUET'
)
ON CONFLICT (public_id) DO UPDATE
SET
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    short_name = EXCLUDED.short_name,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.student_profile (
    user_id, university_id, department, year_of_study
)
SELECT student.id, university.id, 'Computer Science and Engineering', 2
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.university AS university
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND university.public_id = '00000000-0000-4000-8000-000000000201'
ON CONFLICT (user_id) DO UPDATE
SET
    university_id = EXCLUDED.university_id,
    department = EXCLUDED.department,
    year_of_study = EXCLUDED.year_of_study;

INSERT INTO coursedekho.teacher_profile (
    user_id, university_id, department, designation
)
SELECT teacher.id, university.id, 'Computer Science and Engineering', 'Associate Professor'
FROM coursedekho.app_user AS teacher
CROSS JOIN coursedekho.university AS university
WHERE teacher.public_id = '00000000-0000-4000-8000-000000000102'
  AND university.public_id = '00000000-0000-4000-8000-000000000201'
ON CONFLICT (user_id) DO UPDATE
SET
    university_id = EXCLUDED.university_id,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation;

INSERT INTO coursedekho.admin_profile (user_id, level)
SELECT admin.id, 'platform'
FROM coursedekho.app_user AS admin
WHERE admin.public_id = '00000000-0000-4000-8000-000000000103'
ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level;

INSERT INTO coursedekho.semester (
    public_id, university_id, slug, name, sequence_order
)
SELECT
    '00000000-0000-4000-8000-000000000301',
    university.id,
    'level-2-term-1',
    'Level 2, Term 1',
    3
FROM coursedekho.university AS university
WHERE university.public_id = '00000000-0000-4000-8000-000000000201'
ON CONFLICT (public_id) DO UPDATE
SET
    university_id = EXCLUDED.university_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    sequence_order = EXCLUDED.sequence_order,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.course (
    public_id, university_id, semester_id, slug, code, name, description
)
SELECT
    '00000000-0000-4000-8000-000000000401',
    university.id,
    semester.id,
    'data-structures-and-algorithms',
    'CSE-211',
    'Data Structures and Algorithms',
    'Core data structures, algorithms, and problem-solving techniques.'
FROM coursedekho.university AS university
JOIN coursedekho.semester AS semester ON semester.university_id = university.id
WHERE university.public_id = '00000000-0000-4000-8000-000000000201'
  AND semester.public_id = '00000000-0000-4000-8000-000000000301'
ON CONFLICT (public_id) DO UPDATE
SET
    university_id = EXCLUDED.university_id,
    semester_id = EXCLUDED.semester_id,
    slug = EXCLUDED.slug,
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.topic (
    public_id, course_id, slug, name, description, sequence_order
)
SELECT seed.public_id, course.id, seed.slug, seed.name, seed.description, seed.sequence_order
FROM coursedekho.course AS course
CROSS JOIN (
    VALUES
        ('00000000-0000-4000-8000-000000000501'::UUID, 'array', 'Array', 'Contiguous collections and common operations.', 1),
        ('00000000-0000-4000-8000-000000000502'::UUID, 'linked-list', 'Linked List', 'Singly, doubly, and circular linked lists.', 2),
        ('00000000-0000-4000-8000-000000000503'::UUID, 'stack-and-queue', 'Stack and Queue', 'LIFO and FIFO structures and applications.', 3),
        ('00000000-0000-4000-8000-000000000504'::UUID, 'tree', 'Tree', 'Tree traversals, search trees, and heaps.', 4),
        ('00000000-0000-4000-8000-000000000505'::UUID, 'graph', 'Graph', 'Graph representations, traversal, and shortest paths.', 5),
        ('00000000-0000-4000-8000-000000000506'::UUID, 'greedy', 'Greedy Algorithms', 'Locally optimal choices and correctness.', 6),
        ('00000000-0000-4000-8000-000000000507'::UUID, 'dynamic-programming', 'Dynamic Programming', 'Overlapping subproblems and optimal substructure.', 7)
) AS seed(public_id, slug, name, description, sequence_order)
WHERE course.public_id = '00000000-0000-4000-8000-000000000401'
ON CONFLICT (public_id) DO UPDATE
SET
    course_id = EXCLUDED.course_id,
    slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sequence_order = EXCLUDED.sequence_order,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.topic_subtopic (public_id, topic_id, slug, title, sequence_order)
SELECT seed.public_id, topic.id, seed.slug, seed.title, seed.sequence_order
FROM coursedekho.topic AS topic
CROSS JOIN (
    VALUES
        ('00000000-0000-4000-8000-000000000901'::UUID, 'representations', 'Graph representations', 1),
        ('00000000-0000-4000-8000-000000000902'::UUID, 'traversal', 'Breadth-first and depth-first traversal', 2),
        ('00000000-0000-4000-8000-000000000903'::UUID, 'shortest-paths', 'Shortest-path algorithms', 3)
) AS seed(public_id, slug, title, sequence_order)
WHERE topic.public_id = '00000000-0000-4000-8000-000000000505'
ON CONFLICT (public_id) DO UPDATE
SET
    topic_id = EXCLUDED.topic_id,
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    sequence_order = EXCLUDED.sequence_order,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.topic_subtopic (public_id, topic_id, slug, title, sequence_order)
SELECT seed.public_id, topic.id, seed.slug, seed.title, seed.sequence_order
FROM coursedekho.topic AS topic
CROSS JOIN (
    VALUES
        ('00000000-0000-4000-8000-000000000904'::UUID, 'memoization-and-tabulation', 'Memoization and tabulation', 1),
        ('00000000-0000-4000-8000-000000000905'::UUID, 'knapsack-patterns', 'Knapsack patterns', 2),
        ('00000000-0000-4000-8000-000000000906'::UUID, 'longest-common-subsequence', 'Longest common subsequence', 3)
) AS seed(public_id, slug, title, sequence_order)
WHERE topic.public_id = '00000000-0000-4000-8000-000000000507'
ON CONFLICT (public_id) DO UPDATE
SET
    topic_id = EXCLUDED.topic_id,
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    sequence_order = EXCLUDED.sequence_order,
    is_active = TRUE,
    archived_at = NULL;

INSERT INTO coursedekho.course_teacher (course_id, teacher_user_id)
SELECT course.id, teacher.id
FROM coursedekho.course AS course
CROSS JOIN coursedekho.app_user AS teacher
WHERE course.public_id = '00000000-0000-4000-8000-000000000401'
  AND teacher.public_id = '00000000-0000-4000-8000-000000000102'
ON CONFLICT DO NOTHING;

INSERT INTO coursedekho.enrollment (
    public_id, user_id, course_id, status, enrolled_at, status_changed_at
)
SELECT
    '00000000-0000-4000-8000-000000001001',
    student.id,
    course.id,
    'active'::coursedekho.enrollment_status,
    '2026-08-01T08:00:00Z'::TIMESTAMPTZ,
    '2026-08-01T08:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.course AS course
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND course.public_id = '00000000-0000-4000-8000-000000000401'
ON CONFLICT (public_id) DO UPDATE
SET
    status = EXCLUDED.status,
    status_changed_at = EXCLUDED.status_changed_at;

INSERT INTO coursedekho.topic_progress (
    public_id, user_id, topic_id, progress_percent, is_completed, completed_at, last_accessed_at
)
SELECT
    '00000000-0000-4000-8000-000000001101',
    student.id,
    topic.id,
    60,
    FALSE,
    NULL,
    '2026-08-30T12:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.topic AS topic
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND topic.public_id = '00000000-0000-4000-8000-000000000505'
ON CONFLICT (public_id) DO UPDATE
SET
    progress_percent = EXCLUDED.progress_percent,
    is_completed = EXCLUDED.is_completed,
    completed_at = EXCLUDED.completed_at,
    last_accessed_at = EXCLUDED.last_accessed_at;

INSERT INTO coursedekho.content_submission (
    public_id,
    submitted_by_user_id,
    topic_id,
    resource_type,
    title,
    description,
    publication_year,
    topics_covered,
    external_url,
    metadata,
    status,
    submitted_at
)
SELECT
    '00000000-0000-4000-8000-000000000701',
    teacher.id,
    topic.id,
    'question'::coursedekho.resource_type,
    'BUET Graph Final 2024',
    'A curated final-exam question set covering graph algorithms.',
    2024,
    ARRAY['Graph Traversal', 'Shortest Paths'],
    'https://example.edu/coursedekho/buet-graph-final-2024',
    '{"difficulty":"medium","points":100}'::jsonb,
    'pending'::coursedekho.submission_status,
    '2026-08-20T09:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS teacher
CROSS JOIN coursedekho.topic AS topic
WHERE teacher.public_id = '00000000-0000-4000-8000-000000000102'
  AND topic.public_id = '00000000-0000-4000-8000-000000000505'
ON CONFLICT (public_id) DO NOTHING;

INSERT INTO coursedekho.content_submission (
    public_id, submitted_by_user_id, topic_id, resource_type, title, description, status, submitted_at
)
SELECT
    '00000000-0000-4000-8000-000000000702',
    teacher.id,
    topic.id,
    'study_material'::coursedekho.resource_type,
    'Dynamic Programming Notes',
    'Memoization, tabulation, and common dynamic-programming patterns.',
    'pending'::coursedekho.submission_status,
    '2026-08-29T09:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS teacher
CROSS JOIN coursedekho.topic AS topic
WHERE teacher.public_id = '00000000-0000-4000-8000-000000000102'
  AND topic.public_id = '00000000-0000-4000-8000-000000000507'
ON CONFLICT (public_id) DO NOTHING;

INSERT INTO coursedekho.content_submission (
    public_id,
    submitted_by_user_id,
    topic_id,
    resource_type,
    title,
    description,
    status,
    submitted_at
)
SELECT
    '00000000-0000-4000-8000-000000000703',
    teacher.id,
    topic.id,
    'tutorial'::coursedekho.resource_type,
    'Graph Traversal Video',
    'An external traversal tutorial submitted for review.',
    'pending'::coursedekho.submission_status,
    '2026-08-18T09:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS teacher
CROSS JOIN coursedekho.topic AS topic
WHERE teacher.public_id = '00000000-0000-4000-8000-000000000102'
  AND topic.public_id = '00000000-0000-4000-8000-000000000505'
ON CONFLICT (public_id) DO NOTHING;

UPDATE coursedekho.content_submission AS submission
SET
    status = 'approved'::coursedekho.submission_status,
    reviewed_by_user_id = admin.id,
    reviewed_at = '2026-08-21T10:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS admin
WHERE submission.public_id = '00000000-0000-4000-8000-000000000701'
  AND submission.status = 'pending'
  AND admin.public_id = '00000000-0000-4000-8000-000000000103';

UPDATE coursedekho.content_submission AS submission
SET
    status = 'rejected'::coursedekho.submission_status,
    reviewed_by_user_id = admin.id,
    reviewed_at = '2026-08-19T10:00:00Z'::TIMESTAMPTZ,
    rejection_reason = 'The external link is unavailable.'
FROM coursedekho.app_user AS admin
WHERE submission.public_id = '00000000-0000-4000-8000-000000000703'
  AND submission.status = 'pending'
  AND admin.public_id = '00000000-0000-4000-8000-000000000103';

INSERT INTO coursedekho.content (
    public_id, topic_id, resource_type, created_by_user_id, is_active
)
SELECT
    '00000000-0000-4000-8000-000000000601',
    topic.id,
    'question'::coursedekho.resource_type,
    teacher.id,
    FALSE
FROM coursedekho.topic AS topic
CROSS JOIN coursedekho.app_user AS teacher
WHERE topic.public_id = '00000000-0000-4000-8000-000000000505'
  AND teacher.public_id = '00000000-0000-4000-8000-000000000102'
ON CONFLICT (public_id) DO NOTHING;

INSERT INTO coursedekho.content_revision (
    public_id,
    content_id,
    submission_id,
    version_number,
    topic_id,
    contributed_by_user_id,
    approved_by_user_id,
    resource_type,
    title,
    description,
    publication_year,
    topics_covered,
    external_url,
    metadata,
    approved_at
)
SELECT
    '00000000-0000-4000-8000-000000000801',
    content.id,
    submission.id,
    1,
    submission.topic_id,
    submission.submitted_by_user_id,
    submission.reviewed_by_user_id,
    submission.resource_type,
    submission.title,
    submission.description,
    submission.publication_year,
    submission.topics_covered,
    submission.external_url,
    submission.metadata,
    submission.reviewed_at
FROM coursedekho.content AS content
CROSS JOIN coursedekho.content_submission AS submission
WHERE content.public_id = '00000000-0000-4000-8000-000000000601'
  AND submission.public_id = '00000000-0000-4000-8000-000000000701'
ON CONFLICT (public_id) DO NOTHING;

UPDATE coursedekho.content AS content
SET
    current_revision_id = revision.id,
    topic_id = revision.topic_id,
    resource_type = revision.resource_type,
    is_active = TRUE,
    published_at = revision.approved_at,
    archived_at = NULL
FROM coursedekho.content_revision AS revision
WHERE content.public_id = '00000000-0000-4000-8000-000000000601'
  AND revision.public_id = '00000000-0000-4000-8000-000000000801'
  AND revision.content_id = content.id;


INSERT INTO coursedekho.question_detail (content_id, question_text, difficulty, points)
SELECT content.id,
       COALESCE(NULLIF(submission.metadata ->> 'question_text', ''), submission.title),
       NULLIF(submission.metadata ->> 'difficulty', ''),
       CASE WHEN COALESCE(submission.metadata ->> 'points', '') ~ '^[0-9]+$'
         THEN (submission.metadata ->> 'points')::integer ELSE NULL END
FROM coursedekho.content AS content
JOIN coursedekho.content_revision AS revision ON revision.content_id = content.id
JOIN coursedekho.content_submission AS submission ON submission.id = revision.submission_id
WHERE content.public_id = '00000000-0000-4000-8000-000000000601'
  AND submission.public_id = '00000000-0000-4000-8000-000000000701'
ON CONFLICT (content_id) DO UPDATE SET question_text = EXCLUDED.question_text, difficulty = EXCLUDED.difficulty, points = EXCLUDED.points;

INSERT INTO coursedekho.bookmark (public_id, user_id, course_id)
SELECT '00000000-0000-4000-8000-000000001201', student.id, course.id
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.course AS course
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND course.public_id = '00000000-0000-4000-8000-000000000401'
ON CONFLICT DO NOTHING;

INSERT INTO coursedekho.bookmark (public_id, user_id, topic_id)
SELECT '00000000-0000-4000-8000-000000001202', student.id, topic.id
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.topic AS topic
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND topic.public_id = '00000000-0000-4000-8000-000000000505'
ON CONFLICT DO NOTHING;

INSERT INTO coursedekho.bookmark (public_id, user_id, content_id)
SELECT '00000000-0000-4000-8000-000000001203', student.id, content.id
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.content AS content
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND content.public_id = '00000000-0000-4000-8000-000000000601'
ON CONFLICT DO NOTHING;

INSERT INTO coursedekho.content_access (public_id, user_id, content_id, accessed_at)
SELECT
    '00000000-0000-4000-8000-000000001301',
    student.id,
    content.id,
    '2026-08-30T13:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.content AS content
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND content.public_id = '00000000-0000-4000-8000-000000000601'
ON CONFLICT (public_id) DO NOTHING;

INSERT INTO coursedekho.solved_question (public_id, user_id, content_id, solved_at)
SELECT
    '00000000-0000-4000-8000-000000001401',
    student.id,
    content.id,
    '2026-08-30T14:00:00Z'::TIMESTAMPTZ
FROM coursedekho.app_user AS student
CROSS JOIN coursedekho.content AS content
WHERE student.public_id = '00000000-0000-4000-8000-000000000101'
  AND content.public_id = '00000000-0000-4000-8000-000000000601'
ON CONFLICT DO NOTHING;

INSERT INTO coursedekho.audit_event (
    public_id, actor_user_id, event_type, entity_type, entity_public_id, details, occurred_at
)
SELECT
    '00000000-0000-4000-8000-000000001501',
    admin.id,
    'submission.approved',
    'content_submission',
    submission.public_id,
    jsonb_build_object('contentPublicId', content.public_id),
    submission.reviewed_at
FROM coursedekho.app_user AS admin
CROSS JOIN coursedekho.content_submission AS submission
CROSS JOIN coursedekho.content AS content
WHERE admin.public_id = '00000000-0000-4000-8000-000000000103'
  AND submission.public_id = '00000000-0000-4000-8000-000000000701'
  AND content.public_id = '00000000-0000-4000-8000-000000000601'
ON CONFLICT (public_id) DO NOTHING;
