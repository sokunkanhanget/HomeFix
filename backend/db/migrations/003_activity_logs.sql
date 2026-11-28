-- Audit trail of important platform activity (registrations, shop reviews,
-- bookings, emergency requests). Rows are append-only: the trigger below
-- rejects every UPDATE and DELETE, so no application user (ordinary or admin)
-- can alter or erase the history.
--
-- actor_user_id is deliberately not a foreign key: deleting a user must not
-- rewrite (or be blocked by) the records of what that user did. The actor's
-- name and role are snapshotted at the time of the action.

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT,
  actor_role TEXT,
  actor_name TEXT,
  action TEXT NOT NULL CHECK (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_idx ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_logs_action_idx ON activity_logs (action);
CREATE INDEX IF NOT EXISTS activity_logs_actor_idx ON activity_logs (actor_user_id);

CREATE OR REPLACE FUNCTION activity_logs_reject_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs is append-only; % is not allowed', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_logs_append_only ON activity_logs;
CREATE TRIGGER activity_logs_append_only
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION activity_logs_reject_changes();
