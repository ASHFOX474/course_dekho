DROP TABLE IF EXISTS semester_year CASCADE;
DROP TABLE IF EXISTS course_teacher CASCADE;
DROP TABLE IF EXISTS bookmark CASCADE;
DROP TABLE IF EXISTS access_history CASCADE;
DROP TABLE IF EXISTS activity CASCADE;
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS enrollment CASCADE;
DROP TABLE IF EXISTS leetcode_problem CASCADE;
DROP TABLE IF EXISTS question CASCADE;
DROP TABLE IF EXISTS slide CASCADE;
DROP TABLE IF EXISTS tutorial CASCADE;
DROP TABLE IF EXISTS book CASCADE;
DROP TABLE IF EXISTS practice_material CASCADE;
DROP TABLE IF EXISTS study_material CASCADE;
DROP TABLE IF EXISTS approved_content CASCADE;
DROP TABLE IF EXISTS submission CASCADE;
DROP TABLE IF EXISTS topic CASCADE;
DROP TABLE IF EXISTS course CASCADE;
DROP TABLE IF EXISTS semester CASCADE;
DROP TABLE IF EXISTS year CASCADE;
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS teacher CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role CASCADE;
DROP TABLE IF EXISTS university CASCADE;

CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    role_id INT NOT NULL REFERENCES role(role_id)
);

CREATE TABLE university (
    university_id SERIAL PRIMARY KEY,
    university_name VARCHAR(150) UNIQUE NOT NULL
);

CREATE TABLE student (
    student_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    university_id INT NOT NULL REFERENCES university(university_id),
    department VARCHAR(100),
    year_of_study INT CHECK (year_of_study BETWEEN 1 AND 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE teacher (
    teacher_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    university_id INT NOT NULL REFERENCES university(university_id),
    department VARCHAR(100),
    designation VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin (
    admin_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    level VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE semester (
    semester_id SERIAL PRIMARY KEY,
    semester_name VARCHAR(100) NOT NULL,
    semester_number INT,
    start_date DATE,
    end_date DATE
);

CREATE TABLE year (
    year_id SERIAL PRIMARY KEY,
    year_value INT NOT NULL UNIQUE 
);

CREATE TABLE course (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(50) NOT NULL, 
    course_name VARCHAR(150) NOT NULL,
    description TEXT,
    university_id INT NOT NULL REFERENCES university(university_id),
    semester_id INT NOT NULL REFERENCES semester(semester_id), 
    UNIQUE (course_code, university_id) 
);

CREATE TABLE topic (
    topic_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    topic_name VARCHAR(150) NOT NULL,
    description TEXT,
    topic_order INT NOT NULL
);

CREATE TABLE enrollment (
    enrollment_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    course_id INT NOT NULL REFERENCES course(course_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','DROPPED')),
    UNIQUE (student_id, course_id)
);

CREATE TABLE progress (
    progress_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topic(topic_id) ON DELETE CASCADE,
    progress_percent INT DEFAULT 0 CHECK(progress_percent BETWEEN 0 AND 100),
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    last_accessed_at TIMESTAMP,
    UNIQUE(student_id, topic_id)
);

CREATE TABLE submission (
    submission_id SERIAL PRIMARY KEY,
    teacher_id INT NOT NULL REFERENCES teacher(teacher_id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topic(topic_id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
        'STUDY_MATERIAL','PRACTICE_MATERIAL','BOOK','TUTORIAL','SLIDE','QUESTION','LEETCODE_PROBLEM'
    )),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
    reviewed_by INT REFERENCES admin(admin_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT
);

CREATE TABLE approved_content (
    content_id SERIAL PRIMARY KEY,
    submission_id INT NOT NULL UNIQUE REFERENCES submission(submission_id) ON DELETE CASCADE,
    topic_id INT NOT NULL REFERENCES topic(topic_id) ON DELETE CASCADE,
    uploaded_by INT NOT NULL REFERENCES teacher(teacher_id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
        'STUDY_MATERIAL','PRACTICE_MATERIAL','BOOK','TUTORIAL','SLIDE','QUESTION','LEETCODE_PROBLEM'
    )),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE study_material (
    study_material_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    material_type VARCHAR(50),
    file_url TEXT,
    file_size INT
);

CREATE TABLE practice_material (
    practice_material_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    material_type VARCHAR(50),
    file_url TEXT,
    file_size INT
);

CREATE TABLE book (
    book_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    book_title VARCHAR(200) NOT NULL,
    author VARCHAR(150),
    publisher VARCHAR(150),
    file_url TEXT
);

CREATE TABLE tutorial (
    tutorial_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    tutorial_title VARCHAR(200) NOT NULL,
    tutorial_content TEXT,
    file_url TEXT
);

CREATE TABLE slide (
    slide_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    slide_title VARCHAR(200) NOT NULL,
    slide_content TEXT,
    file_url TEXT
);

CREATE TABLE question (
    question_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    difficulty VARCHAR(50),
    points INT
);

CREATE TABLE leetcode_problem (
    problem_id SERIAL PRIMARY KEY,
    content_id INT NOT NULL UNIQUE REFERENCES approved_content(content_id) ON DELETE CASCADE,
    problem_title VARCHAR(200) NOT NULL,
    problem_url TEXT,
    difficulty VARCHAR(50)
);

CREATE TABLE access_history (
    access_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content_id INT NOT NULL REFERENCES approved_content(content_id) ON DELETE CASCADE,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_percent INT CHECK (progress_percent BETWEEN 0 AND 100)
);

CREATE TABLE bookmark (
    bookmark_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content_id INT NOT NULL REFERENCES approved_content(content_id) ON DELETE CASCADE,
    bookmarked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (user_id, content_id)
);

CREATE TABLE activity (
    activity_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT,
    activity_date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE course_teacher (
    course_id INT REFERENCES course(course_id) ON DELETE CASCADE,
    teacher_id INT REFERENCES teacher(teacher_id) ON DELETE CASCADE,
    PRIMARY KEY(course_id, teacher_id)
);

CREATE TABLE semester_year (
    semester_id INT REFERENCES semester(semester_id) ON DELETE CASCADE,
    year_id INT REFERENCES year(year_id) ON DELETE CASCADE,
    PRIMARY KEY(semester_id, year_id)
);

CREATE INDEX idx_student_university      ON student(university_id);
CREATE INDEX idx_teacher_university      ON teacher(university_id);
CREATE INDEX idx_course_university       ON course(university_id);
CREATE INDEX idx_course_semester         ON course(semester_id);
CREATE INDEX idx_topic_course            ON topic(course_id);
CREATE INDEX idx_enrollment_student      ON enrollment(student_id);
CREATE INDEX idx_enrollment_course       ON enrollment(course_id);
CREATE INDEX idx_progress_student        ON progress(student_id);
CREATE INDEX idx_progress_topic          ON progress(topic_id);
CREATE INDEX idx_submission_teacher      ON submission(teacher_id);
CREATE INDEX idx_submission_topic        ON submission(topic_id);
CREATE INDEX idx_approved_content_topic  ON approved_content(topic_id);
CREATE INDEX idx_access_history_user     ON access_history(user_id);
CREATE INDEX idx_access_history_content  ON access_history(content_id);
CREATE INDEX idx_bookmark_user           ON bookmark(user_id);
CREATE INDEX idx_activity_user           ON activity(user_id);