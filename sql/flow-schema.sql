-- Flow Framework Schema
-- Flexible, configurable sales coaching scaffold

-- Framework metadata and versioning
CREATE TABLE IF NOT EXISTS flow_frameworks (
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
CREATE TABLE IF NOT EXISTS flow_tabs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id VARCHAR NOT NULL REFERENCES flow_frameworks(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS flow_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id VARCHAR NOT NULL REFERENCES flow_tabs(id) ON DELETE CASCADE,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tab_id, label)
);

-- Script cards within sections
CREATE TABLE IF NOT EXISTS flow_cards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id VARCHAR NOT NULL REFERENCES flow_sections(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS flow_scripts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id VARCHAR NOT NULL REFERENCES flow_cards(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS flow_audit_log (
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

-- Closer-submitted suggestions to edit a card's script, pending sales-manager
-- review. Approving one creates a new flow_scripts version for the card
-- (scripts are already append-only/versioned — see "latest per card" in
-- getFullFramework) and logs it to flow_audit_log like any other edit;
-- rejecting just marks this row, no framework change.
CREATE TABLE IF NOT EXISTS flow_script_suggestions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR NOT NULL,
  card_id VARCHAR NOT NULL REFERENCES flow_cards(id) ON DELETE CASCADE,
  suggested_content TEXT NOT NULL,
  suggested_why TEXT,
  suggested_notes TEXT,
  suggestion_note TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  suggested_by VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR,
  reviewed_at TIMESTAMP,
  review_note TEXT,
  resulting_script_id VARCHAR REFERENCES flow_scripts(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flow_frameworks_org_active ON flow_frameworks(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_flow_tabs_framework ON flow_tabs(framework_id, display_order);
CREATE INDEX IF NOT EXISTS idx_flow_sections_tab ON flow_sections(tab_id, display_order);
CREATE INDEX IF NOT EXISTS idx_flow_cards_section ON flow_cards(section_id, display_order);
CREATE INDEX IF NOT EXISTS idx_flow_scripts_card ON flow_scripts(card_id);
CREATE INDEX IF NOT EXISTS idx_flow_scripts_tag ON flow_scripts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_flow_audit_org_time ON flow_audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_audit_record ON flow_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_flow_suggestions_org_status ON flow_script_suggestions(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_suggestions_card ON flow_script_suggestions(card_id);
