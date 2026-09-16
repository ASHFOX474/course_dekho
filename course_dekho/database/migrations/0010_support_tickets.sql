-- course-dekho:migration 0010
-- Additive, forward-only support conversations; no changes to account permissions.
CREATE TABLE coursedekho.support_ticket (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id BIGINT REFERENCES coursedekho.app_user(id) ON DELETE RESTRICT,
    guest_token_hash TEXT UNIQUE,
    category TEXT NOT NULL CHECK (category IN ('recovery', 'problem', 'suggestion')),
    subject TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 200),
    contact_name TEXT NOT NULL CHECK (length(btrim(contact_name)) BETWEEN 1 AND 200),
    contact_email TEXT NOT NULL CHECK (length(contact_email) BETWEEN 3 AND 254),
    account_identifier TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((user_id IS NOT NULL AND guest_token_hash IS NULL AND category <> 'recovery') OR
           (user_id IS NULL AND guest_token_hash IS NOT NULL AND guest_token_hash ~ '^[0-9a-f]{64}$' AND category = 'recovery' AND account_identifier IS NOT NULL AND length(btrim(account_identifier)) BETWEEN 1 AND 254))
);
CREATE TABLE coursedekho.support_message (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id BIGINT NOT NULL REFERENCES coursedekho.support_ticket(id) ON DELETE RESTRICT,
    author_user_id BIGINT REFERENCES coursedekho.app_user(id) ON DELETE RESTRICT,
    sender TEXT NOT NULL CHECK (sender IN ('requester', 'admin')),
    body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (sender <> 'admin' OR author_user_id IS NOT NULL)
);
CREATE INDEX support_ticket_owner ON coursedekho.support_ticket(user_id, updated_at DESC);
CREATE INDEX support_ticket_inbox ON coursedekho.support_ticket(status, updated_at DESC);
CREATE INDEX support_ticket_contact_rate ON coursedekho.support_ticket(lower(contact_email), created_at DESC);
CREATE INDEX support_ticket_guest_rate ON coursedekho.support_ticket(created_at DESC) WHERE user_id IS NULL;
CREATE INDEX support_message_thread ON coursedekho.support_message(ticket_id, created_at, id);
CREATE TRIGGER support_ticket_no_delete BEFORE DELETE ON coursedekho.support_ticket FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_hard_delete();
CREATE TRIGGER support_message_no_change BEFORE UPDATE OR DELETE ON coursedekho.support_message FOR EACH ROW EXECUTE FUNCTION coursedekho.prevent_mutation();
-- Rollback: forward compensating migration only; preserve conversation history.
