-- Migration: Firestore -> tag-postgres (Cloud SQL, POSTGRES_16)
--
-- Scope: Firestore DATA only. Firebase Authentication itself is not
-- migrating — role/location claims live on the Firebase Auth custom token
-- and stay there. `users` here is a thin anchor table so uid-keyed foreign
-- keys (audit log actor, bug report author, group membership) have
-- somewhere to point; it is not a mirror of Firebase Auth.
--
-- Two "locations" concepts existed in Firestore and must not be conflated:
--   - locations/{locationId}      -> tenants (this file)
--   - ghl/agency/locations/{id}   -> ghl_location_tokens (this file)

-- ---------------------------------------------------------------------
-- users: anchor for Firebase-uid foreign keys. Not an auth mirror.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- auth_codes: was authCodes/{sha256(email)}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_codes (
  email_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------
-- groups: was groups/{autoId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  locations TEXT[] NOT NULL DEFAULT '{}',
  member_uids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Was: where("memberUids","array-contains",uid) -- GIN index for array membership.
CREATE INDEX IF NOT EXISTS idx_groups_member_uids ON groups USING GIN (member_uids);

-- ---------------------------------------------------------------------
-- tenants: was locations/{locationId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  location_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  services JSONB NOT NULL DEFAULT '{}',
  meta_ad_account_id TEXT,
  meta_business_id TEXT,
  meta_pixel_id TEXT,
  owner_model TEXT NOT NULL DEFAULT 'tag' CHECK (owner_model IN ('client', 'tag')),
  slack_channel_id TEXT,
  drive_folder_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- appointment_outcomes: was locations/{locationId}/appointmentOutcomes/{id}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointment_outcomes (
  location_id TEXT NOT NULL REFERENCES tenants(location_id) ON DELETE CASCADE,
  appointment_id TEXT NOT NULL,
  status TEXT NOT NULL,
  timing TEXT NOT NULL CHECK (timing IN ('pre-call', 'on-call', 'post-call')),
  marked_at TIMESTAMPTZ NOT NULL,
  appointment_starts_at TIMESTAMPTZ NOT NULL,
  appointment_ends_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (location_id, appointment_id)
);

-- Was: orderBy("markedAt","desc").limit(1000) scoped per location (via PK prefix).
CREATE INDEX IF NOT EXISTS idx_appt_outcomes_marked_at ON appointment_outcomes (location_id, marked_at DESC);

-- ---------------------------------------------------------------------
-- audit_log: was locations/{locationId}/auditLog/{autoId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL REFERENCES tenants(location_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(uid),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Was: orderBy(timestamp desc).limit(100), optional where(actorId==), where(action==)
CREATE INDEX IF NOT EXISTS idx_audit_log_location_ts ON audit_log (location_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_ts ON audit_log (actor_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_ts ON audit_log (action, "timestamp" DESC);

-- ---------------------------------------------------------------------
-- ghl_agency_token: was ghl/agency (single fixed doc)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ghl_agency_token (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), -- enforces single row
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  company_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ghl_location_tokens: was ghl/agency/locations/{locationId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ghl_location_tokens (
  location_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('agency-mint', 'direct-install')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- webhook_dead_letter: was webhookDeadLetter/{autoId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('invalid_signature', 'duplicate', 'handler_error', 'unrecognized_event')),
  payload JSONB,
  headers JSONB,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  flagged BOOLEAN NOT NULL DEFAULT false,
  flagged_by TEXT,
  flagged_reason TEXT,
  flagged_at TIMESTAMPTZ,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ
);

-- Was: where(flagged==true).where(resolved==false).orderBy(receivedAt desc).limit(200)
CREATE INDEX IF NOT EXISTS idx_dlq_flagged_unresolved ON webhook_dead_letter (flagged, resolved, received_at DESC);
-- Was: where(resolved==false).orderBy(receivedAt desc), optional where(source==)
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved_source ON webhook_dead_letter (resolved, received_at DESC, source);

-- ---------------------------------------------------------------------
-- webhook_events_processed: was webhookEventsProcessed/{source}:{eventId}
-- Race-safe dedup via PK conflict, same as Firestore .create().
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events_processed (
  source TEXT NOT NULL,
  event_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source, event_id)
);

-- ---------------------------------------------------------------------
-- bug_reports: was bugReports/{autoId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(uid),
  user_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  page_area TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in_review', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Was: where(userId==).orderBy(createdAt desc).limit(20)
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_created ON bug_reports (user_id, created_at DESC);

-- ---------------------------------------------------------------------
-- clients: was clients/{clientId}
-- ID scheme unclear in source (no write path found) — kept as free-text
-- primary key so existing external IDs carry over unchanged.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ghl_location_id TEXT NOT NULL,
  csm_assigned TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  meta_ad_account_id TEXT,
  -- Escalation input with no automatic source yet — see computeEscalation
  -- in lib/dashboard/csm-clients.ts. Manual until an activity log exists.
  upsell_attempted BOOLEAN NOT NULL DEFAULT false
);

-- Was: where("csm_assigned","==").where("active","==",true)
CREATE INDEX IF NOT EXISTS idx_clients_csm_active ON clients (csm_assigned, active);

-- ---------------------------------------------------------------------
-- csm: was csm/{email}
-- Reporting line for the CS org (CSM -> CSD -> exec rollup). Keyed by
-- email, matching clients.csm_assigned's existing free-text-email
-- convention rather than a separate uid-based identifier.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS csm (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('csm', 'csd', 'exec')),
  manager_email TEXT REFERENCES csm(email)
);

-- Was: where("managerEmail","==") -- a CSD's team roster.
CREATE INDEX IF NOT EXISTS idx_csm_manager_email ON csm (manager_email);

-- ---------------------------------------------------------------------
-- client_alerts: was clients/{id}/alerts/{autoId}
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('critical', 'warning', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Was: orderBy("created_at","desc").limit(50)
CREATE INDEX IF NOT EXISTS idx_client_alerts_client_created ON client_alerts (client_id, created_at DESC);

-- ---------------------------------------------------------------------
-- client_meta_creatives: was clients/{id}/meta_creatives/{creativeId}
-- ID = Meta creative ID (natural key), matches Firestore doc id.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_meta_creatives (
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  creative_id TEXT NOT NULL,
  name TEXT,
  status TEXT,
  effective_status TEXT,
  created_time TIMESTAMPTZ,
  adset_id TEXT,
  campaigns_using JSONB NOT NULL DEFAULT '[]', -- [{campaignId, campaignName, status}]
  last_synced TIMESTAMPTZ,
  PRIMARY KEY (client_id, creative_id)
);

-- ---------------------------------------------------------------------
-- course_progress: was userProgress/{uid}/courses/{courseId}/sections/{s}
--   /subsections/{ss}/checkboxes/{checkboxId}
-- Flattened to one row per checkbox; the 5-level Firestore path becomes
-- 5 key columns. Source file (lib/course/firestore.ts) is a pre-existing
-- broken import (client SDK calls against a nonexistent `db` export) —
-- this table exists so the shape is ready when that file is fixed, not
-- because working data currently flows through it.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_progress (
  uid TEXT NOT NULL REFERENCES users(uid),
  course_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  subsection_id TEXT NOT NULL,
  checkbox_id TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (uid, course_id, section_id, subsection_id, checkbox_id)
);

-- ---------------------------------------------------------------------
-- dashboard_configs already exists (functions/sql/002) on the local
-- tag_automation Postgres instance. Re-declared here (IF NOT EXISTS) so
-- this file alone stands up the full schema on tag-postgres.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dashboard_configs (
  uid TEXT NOT NULL REFERENCES users(uid),
  role VARCHAR(50) NOT NULL,
  pages JSONB NOT NULL,
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, role)
);

CREATE INDEX IF NOT EXISTS idx_dashboard_configs_uid ON dashboard_configs (uid);

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tag_app_user;
