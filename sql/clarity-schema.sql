-- Clarity Framework Schema
-- Flexible, configurable sales coaching scaffold

-- Framework metadata and versioning
CREATE TABLE IF NOT EXISTS clarity_frameworks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, version)
);

-- Framework tabs (e.g., Triage, Diagnostic, Sales, Follow-Up)
CREATE TABLE IF NOT EXISTS clarity_tabs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id VARCHAR NOT NULL REFERENCES clarity_frameworks(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(20),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(framework_id, label)
);

-- Sections within each tab (e.g., Opening, Discovery, Goals)
CREATE TABLE IF NOT EXISTS clarity_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id VARCHAR NOT NULL REFERENCES clarity_tabs(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tab_id, label)
);

-- Script cards within sections
CREATE TABLE IF NOT EXISTS clarity_cards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id VARCHAR NOT NULL REFERENCES clarity_sections(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  sub_label VARCHAR(255),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(section_id, key)
);

-- Script content (versioned)
CREATE TABLE IF NOT EXISTS clarity_scripts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id VARCHAR NOT NULL REFERENCES clarity_cards(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  why TEXT,
  notes TEXT,
  version_tag VARCHAR(20),
  tags TEXT[] DEFAULT '{}',
  created_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log for all changes (revert-capable)
CREATE TABLE IF NOT EXISTS clarity_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  table_name VARCHAR(50) NOT NULL,
  record_id VARCHAR NOT NULL,
  action VARCHAR(20) NOT NULL,
  changes JSONB NOT NULL,
  changed_by VARCHAR NOT NULL,
  admin_note TEXT,
  parent_change_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_clarity_frameworks_org_active ON clarity_frameworks(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_clarity_tabs_framework ON clarity_tabs(framework_id, display_order);
CREATE INDEX IF NOT EXISTS idx_clarity_sections_tab ON clarity_sections(tab_id, display_order);
CREATE INDEX IF NOT EXISTS idx_clarity_cards_section ON clarity_cards(section_id, display_order);
CREATE INDEX IF NOT EXISTS idx_clarity_scripts_card ON clarity_scripts(card_id);
CREATE INDEX IF NOT EXISTS idx_clarity_scripts_tag ON clarity_scripts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_clarity_audit_org_time ON clarity_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clarity_audit_record ON clarity_audit_log(table_name, record_id);
