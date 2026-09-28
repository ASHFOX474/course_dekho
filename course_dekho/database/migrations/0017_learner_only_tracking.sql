-- course-dekho:migration 0017
-- Teachers contribute and browse; only learners enroll and track completion.
-- The migration runner wraps this cleanup and its guards in one transaction.
-- Retention triggers are suspended only for the explicitly retired teacher data.
ALTER TABLE coursedekho.enrollment DISABLE TRIGGER trg_enrollment_prevent_delete;
ALTER TABLE coursedekho.topic_progress DISABLE TRIGGER trg_topic_progress_prevent_delete;
ALTER TABLE coursedekho.solved_question DISABLE TRIGGER trg_solved_question_prevent_delete;

DELETE FROM coursedekho.resource_completion AS activity
USING coursedekho.app_user AS account
WHERE activity.user_id = account.id AND account.role = 'contributor';
DELETE FROM coursedekho.learning_folder_activity AS activity
USING coursedekho.app_user AS account
WHERE activity.user_id = account.id AND account.role = 'contributor';
DELETE FROM coursedekho.topic_progress AS activity
USING coursedekho.app_user AS account
WHERE activity.user_id = account.id AND account.role = 'contributor';
DELETE FROM coursedekho.solved_question AS activity
USING coursedekho.app_user AS account
WHERE activity.user_id = account.id AND account.role = 'contributor';
DELETE FROM coursedekho.enrollment AS activity
USING coursedekho.app_user AS account
WHERE activity.user_id = account.id AND account.role = 'contributor';

ALTER TABLE coursedekho.enrollment ENABLE TRIGGER trg_enrollment_prevent_delete;
ALTER TABLE coursedekho.topic_progress ENABLE TRIGGER trg_topic_progress_prevent_delete;
ALTER TABLE coursedekho.solved_question ENABLE TRIGGER trg_solved_question_prevent_delete;

-- Keep the shared reader guard unchanged: teachers can still bookmark and browse.
CREATE FUNCTION coursedekho.enforce_learning_actor_role()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM coursedekho.assert_user_role(
        NEW.user_id,
        ARRAY['learner']::coursedekho.user_role[]
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollment_learning_actor
BEFORE INSERT OR UPDATE ON coursedekho.enrollment
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learning_actor_role();
CREATE TRIGGER trg_topic_progress_learning_actor
BEFORE INSERT OR UPDATE ON coursedekho.topic_progress
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learning_actor_role();
CREATE TRIGGER trg_solved_question_learning_actor
BEFORE INSERT OR UPDATE ON coursedekho.solved_question
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learning_actor_role();
CREATE TRIGGER trg_resource_completion_learning_actor
BEFORE INSERT OR UPDATE ON coursedekho.resource_completion
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learning_actor_role();
CREATE TRIGGER trg_learning_folder_activity_learning_actor
BEFORE INSERT OR UPDATE ON coursedekho.learning_folder_activity
FOR EACH ROW EXECUTE FUNCTION coursedekho.enforce_learning_actor_role();

-- Rollback: forward-only. Removed teacher tracking data cannot be reconstructed.
