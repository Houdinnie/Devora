-- Durable workflow cancellation and per-step checkpoints.
ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS workflow_run_steps (
  workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id VARCHAR(255) NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 0,
  output_text TEXT,
  error_message TEXT,
  worktree_path TEXT,
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (workflow_run_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_status
  ON workflow_run_steps(workflow_run_id, status);
