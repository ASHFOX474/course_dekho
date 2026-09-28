-- course-dekho:migration 0015
-- Reverse lookup indexes for learner-activity foreign keys and admin reviewers.

CREATE INDEX idx_enrollment_reviewed_by_user
    ON coursedekho.enrollment (reviewed_by_user_id)
    WHERE reviewed_by_user_id IS NOT NULL;

CREATE INDEX idx_resource_completion_content
    ON coursedekho.resource_completion (content_id, user_id);

CREATE INDEX idx_learning_folder_activity_course
    ON coursedekho.learning_folder_activity (course_id, user_id);

CREATE INDEX idx_learning_folder_activity_topic
    ON coursedekho.learning_folder_activity (topic_id, user_id)
    WHERE topic_id IS NOT NULL;

-- Rollback: intentionally forward-only. Add a reviewed compensating migration.
