-- Add session_id to agent_runs so chat turns can be grouped into sessions.
-- Existing rows are left NULL (treated as individual legacy sessions in the UI).
ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE INDEX IF NOT EXISTS agent_runs_session_id_idx ON agent_runs (session_id)
  WHERE session_id IS NOT NULL;
