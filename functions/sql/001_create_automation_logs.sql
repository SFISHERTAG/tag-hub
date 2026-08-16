-- Create automation logs table for tracking all Phase 1, 2, 3 events
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  location_id VARCHAR(255) NOT NULL,
  phase VARCHAR(10) NOT NULL CHECK (phase IN ('phase1', 'phase2', 'phase3')),
  event VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'in_progress', 'completed', 'error')),
  details JSONB,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_automation_logs_location_id ON automation_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_phase ON automation_logs(phase);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_location_phase ON automation_logs(location_id, phase);

-- Create view for current status of each client
CREATE OR REPLACE VIEW client_automation_status AS
SELECT DISTINCT ON (location_id, phase)
  location_id,
  phase,
  status,
  event,
  created_at,
  details
FROM automation_logs
ORDER BY location_id, phase, created_at DESC;

-- Create view for recent errors
CREATE OR REPLACE VIEW automation_errors AS
SELECT
  location_id,
  phase,
  event,
  error,
  details,
  created_at
FROM automation_logs
WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 100;

-- Grant permissions (adjust roles as needed)
GRANT SELECT, INSERT ON automation_logs TO tag_app_user;
GRANT USAGE ON SEQUENCE automation_logs_id_seq TO tag_app_user;
