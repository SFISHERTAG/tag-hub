-- Migration: clients.upsell_attempted + composite audit_log index
--
-- clients.upsell_attempted: new field read by csm-clients.ts's escalation
-- computation (computeEscalation reads Boolean(data.upsell_attempted)).
-- Defaults false to match the Firestore read path's Boolean(undefined)
-- fallback.
--
-- audit_log composite index: daysSinceLastAction(locationId, action) in
-- lib/audit/store.ts runs WHERE location_id = ? AND action = ? ORDER BY
-- timestamp DESC LIMIT 1, once per client on every CSM/CSD/exec rollup page
-- load. The existing (location_id, timestamp) and (action, timestamp)
-- indexes from 003 each cover half the predicate; this composite covers
-- the actual query directly instead of relying on a bitmap AND of two
-- indexes.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS upsell_attempted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_audit_log_location_action_ts
  ON audit_log (location_id, action, "timestamp" DESC);
