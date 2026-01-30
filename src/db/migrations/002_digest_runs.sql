-- Track digest runs per user for smart time window
CREATE TABLE IF NOT EXISTS digest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slack_user_id TEXT NOT NULL,
    newest_message_ts TEXT NOT NULL,
    message_count INT NOT NULL,
    insight_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_runs_user ON digest_runs(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_digest_runs_created ON digest_runs(created_at DESC);
