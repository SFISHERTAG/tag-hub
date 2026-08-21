import { pool } from "@/lib/postgres";
import type {
  FlowFramework,
  FlowTab,
  FlowSection,
  FlowCard,
  FlowScript,
  FlowAuditLog,
  FlowScriptSuggestion,
  FullFramework,
} from "./types";

/**
 * In-memory cache for getFullFramework() (Phase 2 item 2.5). The unabridged
 * framework is a 30-100+ query serial waterfall (framework -> tabs -> per-tab
 * sections -> per-section cards -> per-card script) — every closer opening
 * FLOW during a live call pays that cost on every load. The framework is
 * shared, org-wide content (not per-user), so the cache key is just orgId.
 *
 * Invalidation is a full clear rather than a per-org entry removal: every
 * write function below touches one row by its own id (tab/section/card/
 * script id), not by orgId, so resolving "which org's cache entry" would
 * cost an extra query per write. Writes are rare (an admin/manager editing
 * scripts) next to reads (closers loading FLOW constantly), so clearing
 * everything on any write is cheap and correct, just not maximally precise.
 */
const FRAMEWORK_CACHE_TTL_MS = 5 * 60 * 1000;
const frameworkCache = new Map<string, { value: FullFramework | null; expiresAt: number }>();

function clearFrameworkCache(): void {
  frameworkCache.clear();
}

// ─── FRAMEWORKS ──────────────────────────────────────────────────────────────

export async function getFramework(
  orgId: string,
  version?: string
): Promise<FlowFramework | null> {
  const result = await pool.query(
    version
      ? "SELECT * FROM flow_frameworks WHERE org_id = $1 AND version = $2 LIMIT 1"
      : "SELECT * FROM flow_frameworks WHERE org_id = $1 AND is_active = true LIMIT 1",
    version ? [orgId, version] : [orgId]
  );
  return result.rows[0] || null;
}

export async function getAllFrameworkVersions(
  orgId: string
): Promise<FlowFramework[]> {
  const result = await pool.query(
    "SELECT * FROM flow_frameworks WHERE org_id = $1 ORDER BY created_at DESC",
    [orgId]
  );
  return result.rows;
}

export async function createFramework(
  data: Omit<FlowFramework, "id" | "created_at" | "updated_at">
): Promise<FlowFramework> {
  const result = await pool.query(
    `INSERT INTO flow_frameworks
    (org_id, name, description, version, is_active, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.org_id,
      data.name,
      data.description,
      data.version,
      data.is_active,
      data.created_by,
      data.updated_by,
    ]
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function updateFramework(
  id: string,
  data: Partial<FlowFramework>
): Promise<FlowFramework> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramCount = 2;

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  if (data.updated_by !== undefined) {
    updates.push(`updated_by = $${paramCount++}`);
    values.push(data.updated_by);
  }
  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE flow_frameworks SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  clearFrameworkCache();
  return result.rows[0];
}

// ─── FULL FRAMEWORK QUERY (HOTPATH) ──────────────────────────────────────────

export async function getFullFramework(orgId: string): Promise<FullFramework | null> {
  const cached = frameworkCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const result = await getFullFrameworkUncached(orgId);
  frameworkCache.set(orgId, { value: result, expiresAt: Date.now() + FRAMEWORK_CACHE_TTL_MS });
  return result;
}

async function getFullFrameworkUncached(orgId: string): Promise<FullFramework | null> {
  const framework = await getFramework(orgId);
  if (!framework) return null;

  const tabs = await pool.query(
    "SELECT * FROM flow_tabs WHERE framework_id = $1 AND is_active = true ORDER BY display_order",
    [framework.id]
  );

  const fullTabs = await Promise.all(
    tabs.rows.map(async (tab: FlowTab) => {
      const sections = await pool.query(
        "SELECT * FROM flow_sections WHERE tab_id = $1 AND is_active = true ORDER BY display_order",
        [tab.id]
      );

      const fullSections = await Promise.all(
        sections.rows.map(async (section: FlowSection) => {
          const cards = await pool.query(
            "SELECT * FROM flow_cards WHERE section_id = $1 AND is_active = true ORDER BY display_order",
            [section.id]
          );

          const fullCards = await Promise.all(
            cards.rows.map(async (card: FlowCard) => {
              const scripts = await pool.query(
                "SELECT * FROM flow_scripts WHERE card_id = $1 ORDER BY created_at DESC LIMIT 1",
                [card.id]
              );
              return {
                id: card.id,
                key: card.key,
                label: card.label,
                sub_label: card.sub_label,
                script: scripts.rows[0] || null,
              };
            })
          );

          return {
            id: section.id,
            label: section.label,
            description: section.description,
            cards: fullCards,
          };
        })
      );

      return {
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        color: tab.color,
        sections: fullSections,
      };
    })
  );

  return {
    id: framework.id,
    version: framework.version,
    tabs: fullTabs,
  };
}

// ─── TABS ────────────────────────────────────────────────────────────────────

export async function createTab(
  frameworkId: string,
  data: Omit<FlowTab, "id" | "created_at" | "updated_at">
): Promise<FlowTab> {
  const result = await pool.query(
    `INSERT INTO flow_tabs
    (framework_id, label, icon, color, display_order, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      frameworkId,
      data.label,
      data.icon,
      data.color,
      data.display_order,
      data.is_active,
    ]
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function updateTab(
  id: string,
  data: Partial<FlowTab>
): Promise<FlowTab> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramCount = 2;

  if (data.label !== undefined) {
    updates.push(`label = $${paramCount++}`);
    values.push(data.label);
  }
  if (data.icon !== undefined) {
    updates.push(`icon = $${paramCount++}`);
    values.push(data.icon);
  }
  if (data.color !== undefined) {
    updates.push(`color = $${paramCount++}`);
    values.push(data.color);
  }
  if (data.display_order !== undefined) {
    updates.push(`display_order = $${paramCount++}`);
    values.push(data.display_order);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE flow_tabs SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function deleteTab(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM flow_tabs WHERE id = $1",
    [id]
  );
  clearFrameworkCache();
  return (result.rowCount ?? 0) > 0;
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

export async function createSection(
  tabId: string,
  data: Omit<FlowSection, "id" | "created_at" | "updated_at">
): Promise<FlowSection> {
  const result = await pool.query(
    `INSERT INTO flow_sections
    (tab_id, label, description, display_order, is_active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [tabId, data.label, data.description, data.display_order, data.is_active]
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function updateSection(
  id: string,
  data: Partial<FlowSection>
): Promise<FlowSection> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramCount = 2;

  if (data.label !== undefined) {
    updates.push(`label = $${paramCount++}`);
    values.push(data.label);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.display_order !== undefined) {
    updates.push(`display_order = $${paramCount++}`);
    values.push(data.display_order);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE flow_sections SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function deleteSection(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM flow_sections WHERE id = $1",
    [id]
  );
  clearFrameworkCache();
  return (result.rowCount ?? 0) > 0;
}

// ─── CARDS ──────────────────────────────────────────────────────────────────

export async function createCard(
  sectionId: string,
  data: Omit<FlowCard, "id" | "created_at" | "updated_at">
): Promise<FlowCard> {
  const result = await pool.query(
    `INSERT INTO flow_cards
    (section_id, key, label, sub_label, display_order, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      sectionId,
      data.key,
      data.label,
      data.sub_label,
      data.display_order,
      data.is_active,
    ]
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function updateCard(
  id: string,
  data: Partial<FlowCard>
): Promise<FlowCard> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramCount = 2;

  if (data.key !== undefined) {
    updates.push(`key = $${paramCount++}`);
    values.push(data.key);
  }
  if (data.label !== undefined) {
    updates.push(`label = $${paramCount++}`);
    values.push(data.label);
  }
  if (data.sub_label !== undefined) {
    updates.push(`sub_label = $${paramCount++}`);
    values.push(data.sub_label);
  }
  if (data.display_order !== undefined) {
    updates.push(`display_order = $${paramCount++}`);
    values.push(data.display_order);
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE flow_cards SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function deleteCard(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM flow_cards WHERE id = $1",
    [id]
  );
  clearFrameworkCache();
  return (result.rowCount ?? 0) > 0;
}

/**
 * Resolves a card's real org_id via section -> tab -> framework. For routes
 * that receive a client-supplied org_id alongside a cardId (the suggestion
 * flow) and need to verify they actually match before trusting either —
 * without this, a caller could claim their own (valid) org_id while
 * supplying a different org's cardId.
 */
export async function getCardOrgId(cardId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT f.org_id
     FROM flow_cards c
     JOIN flow_sections s ON s.id = c.section_id
     JOIN flow_tabs t ON t.id = s.tab_id
     JOIN flow_frameworks f ON f.id = t.framework_id
     WHERE c.id = $1
     LIMIT 1`,
    [cardId],
  );
  return result.rows[0]?.org_id ?? null;
}

// ─── SCRIPTS ────────────────────────────────────────────────────────────────

export async function createScript(
  cardId: string,
  data: Omit<FlowScript, "id" | "card_id" | "created_at" | "updated_at">
): Promise<FlowScript> {
  const result = await pool.query(
    `INSERT INTO flow_scripts
    (card_id, content, why, notes, version_tag, tags, created_by, updated_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      cardId,
      data.content,
      data.why,
      data.notes,
      data.version_tag,
      data.tags,
      data.created_by,
      data.updated_by,
    ]
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function updateScript(
  id: string,
  data: Partial<FlowScript>
): Promise<FlowScript> {
  const updates: string[] = [];
  const values: unknown[] = [id];
  let paramCount = 2;

  if (data.content !== undefined) {
    updates.push(`content = $${paramCount++}`);
    values.push(data.content);
  }
  if (data.why !== undefined) {
    updates.push(`why = $${paramCount++}`);
    values.push(data.why);
  }
  if (data.notes !== undefined) {
    updates.push(`notes = $${paramCount++}`);
    values.push(data.notes);
  }
  if (data.version_tag !== undefined) {
    updates.push(`version_tag = $${paramCount++}`);
    values.push(data.version_tag);
  }
  if (data.tags !== undefined) {
    updates.push(`tags = $${paramCount++}`);
    values.push(data.tags);
  }
  if (data.updated_by !== undefined) {
    updates.push(`updated_by = $${paramCount++}`);
    values.push(data.updated_by);
  }
  updates.push(`updated_at = NOW()`);

  const result = await pool.query(
    `UPDATE flow_scripts SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  clearFrameworkCache();
  return result.rows[0];
}

export async function deleteScript(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM flow_scripts WHERE id = $1",
    [id]
  );
  clearFrameworkCache();
  return (result.rowCount ?? 0) > 0;
}

export async function getScript(id: string): Promise<FlowScript | null> {
  const result = await pool.query(
    "SELECT * FROM flow_scripts WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

// ─── SCRIPT SUGGESTIONS ─────────────────────────────────────────────────────
// Closers can't edit scripts directly (that's tag_exec/tag_admin only) but can
// propose an edit for a sales manager to review. Approving one creates a new
// script version (scripts are already append-only per card) rather than
// mutating in place, so the audit trail and revert path both keep working
// unmodified.

export async function createSuggestion(
  cardId: string,
  data: {
    org_id: string;
    suggested_content: string;
    suggested_why?: string | null;
    suggested_notes?: string | null;
    suggestion_note?: string | null;
    suggested_by: string;
  },
): Promise<FlowScriptSuggestion> {
  const result = await pool.query(
    `INSERT INTO flow_script_suggestions
    (org_id, card_id, suggested_content, suggested_why, suggested_notes, suggestion_note, suggested_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      data.org_id,
      cardId,
      data.suggested_content,
      data.suggested_why ?? null,
      data.suggested_notes ?? null,
      data.suggestion_note ?? null,
      data.suggested_by,
    ],
  );
  return result.rows[0];
}

export async function getSuggestionsForOrg(
  orgId: string,
  status?: "pending" | "approved" | "rejected",
): Promise<FlowScriptSuggestion[]> {
  const result = await pool.query(
    status
      ? "SELECT * FROM flow_script_suggestions WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC"
      : "SELECT * FROM flow_script_suggestions WHERE org_id = $1 ORDER BY created_at DESC",
    status ? [orgId, status] : [orgId],
  );
  return result.rows;
}

export async function getSuggestion(id: string): Promise<FlowScriptSuggestion | null> {
  const result = await pool.query(
    "SELECT * FROM flow_script_suggestions WHERE id = $1 LIMIT 1",
    [id],
  );
  return result.rows[0] || null;
}

/**
 * Approve or reject a pending suggestion. Approving writes a new
 * flow_scripts row for the card (clearFrameworkCache() runs inside
 * createScript, so the next framework load already sees it) and logs the
 * change the same way a direct admin edit would, with an admin_note
 * attributing it back to the suggestion and its author.
 */
export async function resolveSuggestion(
  id: string,
  action: "approve" | "reject",
  reviewedBy: string,
  reviewNote?: string | null,
): Promise<FlowScriptSuggestion> {
  const suggestion = await getSuggestion(id);
  if (!suggestion) {
    throw new Error("Suggestion not found");
  }
  if (suggestion.status !== "pending") {
    throw new Error(`Suggestion already ${suggestion.status}`);
  }

  let resultingScriptId: string | null = null;

  if (action === "approve") {
    const script = await createScript(suggestion.card_id, {
      content: suggestion.suggested_content,
      why: suggestion.suggested_why,
      notes: suggestion.suggested_notes,
      version_tag: null,
      tags: [],
      created_by: suggestion.suggested_by,
      updated_by: reviewedBy,
    });
    resultingScriptId = script.id;

    await logChange(
      suggestion.org_id,
      "flow_scripts",
      script.id,
      "create",
      {
        content: { old: null, new: suggestion.suggested_content },
        why: { old: null, new: suggestion.suggested_why },
        notes: { old: null, new: suggestion.suggested_notes },
      },
      reviewedBy,
      `Approved suggestion ${id} from ${suggestion.suggested_by}${reviewNote ? `: ${reviewNote}` : ""}`,
    );
  }

  const result = await pool.query(
    `UPDATE flow_script_suggestions
     SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_note = $4, resulting_script_id = $5
     WHERE id = $1
     RETURNING *`,
    [id, action === "approve" ? "approved" : "rejected", reviewedBy, reviewNote ?? null, resultingScriptId],
  );
  return result.rows[0];
}

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────

export async function logChange(
  orgId: string,
  tableName: string,
  recordId: string,
  action: "create" | "update" | "delete",
  changes: Record<string, { old: unknown; new: unknown }>,
  changedBy: string,
  adminNote?: string,
  parentChangeId?: string
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO flow_audit_log
    (org_id, table_name, record_id, action, changes, changed_by, admin_note, parent_change_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      orgId,
      tableName,
      recordId,
      action,
      JSON.stringify(changes),
      changedBy,
      adminNote,
      parentChangeId,
    ]
  );
  return result.rows[0].id;
}

export async function getAuditLog(
  orgId: string,
  limit = 100,
  offset = 0
): Promise<FlowAuditLog[]> {
  const result = await pool.query(
    `SELECT * FROM flow_audit_log
    WHERE org_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );
  return result.rows.map(
    (row: FlowAuditLog): FlowAuditLog => ({
      ...row,
      changes: typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes,
    }) as FlowAuditLog,
  );
}

export async function getAuditEntry(id: string): Promise<FlowAuditLog | null> {
  const result = await pool.query(
    "SELECT * FROM flow_audit_log WHERE id = $1 LIMIT 1",
    [id]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    changes: typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes,
  };
}

export async function revertChange(
  auditId: string,
  changedBy: string
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const audit = await client.query(
      "SELECT * FROM flow_audit_log WHERE id = $1",
      [auditId]
    );

    if (audit.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const entry = audit.rows[0];
    const changes = typeof entry.changes === "string" ? JSON.parse(entry.changes) : entry.changes;

    // Revert each field
    const updates: string[] = [];
    const values: unknown[] = [entry.record_id];
    let paramCount = 2;

    for (const [field, fieldChange] of Object.entries(changes)) {
      updates.push(`${field} = $${paramCount++}`);
      values.push((fieldChange as { old: unknown }).old);
    }
    updates.push("updated_at = NOW()");

    const table = entry.table_name;
    await client.query(
      `UPDATE ${table} SET ${updates.join(", ")} WHERE id = $1`,
      values
    );

    // Log the revert. The field actually moved new -> old (that's what a
    // revert is), so this entry's own changes must record that direction —
    // re-logging the original `changes` object verbatim would claim the
    // revert moved old -> new, backwards from what it actually did.
    const revertedChanges: Record<string, { old: unknown; new: unknown }> = {};
    for (const [field, fieldChange] of Object.entries(changes) as [string, { old: unknown; new: unknown }][]) {
      revertedChanges[field] = {
        old: fieldChange.new,
        new: fieldChange.old,
      };
    }

    await client.query(
      `INSERT INTO flow_audit_log
      (org_id, table_name, record_id, action, changes, changed_by, admin_note, parent_change_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.org_id,
        table,
        entry.record_id,
        "update",
        JSON.stringify(revertedChanges),
        changedBy,
        `Reverted change ${auditId}`,
        auditId,
      ]
    );

    await client.query("COMMIT");
    clearFrameworkCache();
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
