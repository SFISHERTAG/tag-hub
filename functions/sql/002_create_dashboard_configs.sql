-- Create dashboard_configs table for per-user, per-role dashboard customization
CREATE TABLE IF NOT EXISTS dashboard_configs (
  uid VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  pages JSONB NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (uid, role)
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_dashboard_configs_uid ON dashboard_configs(uid);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON dashboard_configs TO tag_app_user;
