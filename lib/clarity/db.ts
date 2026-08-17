import { pool } from "@/lib/postgres";
import type {
  ClarityFramework,
  ClarityTab,
  ClaritySection,
  ClarityCard,
  ClarityScript,
  ClarityAuditLog,
  FullFramework,
} from "./types";

// ─── FRAMEWORKS ──────────────────────────────────────────────────────────────

export async function getFramework(
  orgId: string,
  version?: string
): Promise<ClarityFramework | null> {
  const result = await pool.query(
    version
      ? "SELECT * FROM clarity_frameworks WHERE org_id = $1 AND version = $2 LIMIT 1"
      : "SELECT * FROM clarity_frameworks WHERE org_id = $1 AND is_active = true LIMIT 1",
    version ? [orgId, version] : [orgId]
  );
  return result.rows[0] || null;
}

export async function getAllFrameworkVersions(
  orgId: string
): Promise<ClarityFramework[]> {
  const result = await pool.query(
    "SELECT * FROM clarity_frameworks WHERE org_id = $1 ORDER BY created_at DESC",
    [orgId]
  );
  return result.rows;
}

export async function createFramework(
  data: Omit<ClarityFramework, "id" | "created_at" | "updated_at">
): Promise<ClarityFramework> {
  const result = await pool.query(
    `INSERT INTO clarity_frameworks
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
  return result.rows[0];
}

export async function updateFramework(
  id: string,
  data: Partial<ClarityFramework>
): Promise<ClarityFramework> {
  const updates: string[] = [];
  const values: any[] = [id];
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
    `UPDATE clarity_frameworks SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

// ─── FULL FRAMEWORK QUERY (HOTPATH) ──────────────────────────────────────────

export async function getFullFramework(orgId: string): Promise<FullFramework | null> {
  const framework = await getFramework(orgId);
  if (!framework) return null;

  const tabs = await pool.query(
    "SELECT * FROM clarity_tabs WHERE framework_id = $1 AND is_active = true ORDER BY display_order",
    [framework.id]
  );

  const fullTabs = await Promise.all(
    tabs.rows.map(async (tab) => {
      const sections = await pool.query(
        "SELECT * FROM clarity_sections WHERE tab_id = $1 AND is_active = true ORDER BY display_order",
        [tab.id]
      );

      const fullSections = await Promise.all(
        sections.rows.map(async (section) => {
          const cards = await pool.query(
            "SELECT * FROM clarity_cards WHERE section_id = $1 AND is_active = true ORDER BY display_order",
            [section.id]
          );

          const fullCards = await Promise.all(
            cards.rows.map(async (card) => {
              const scripts = await pool.query(
                "SELECT * FROM clarity_scripts WHERE card_id = $1 ORDER BY created_at DESC LIMIT 1",
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
  data: Omit<ClarityTab, "id" | "created_at" | "updated_at">
): Promise<ClarityTab> {
  const result = await pool.query(
    `INSERT INTO clarity_tabs
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
  return result.rows[0];
}

export async function updateTab(
  id: string,
  data: Partial<ClarityTab>
): Promise<ClarityTab> {
  const updates: string[] = [];
  const values: any[] = [id];
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
    `UPDATE clarity_tabs SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteTab(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM clarity_tabs WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

export async function createSection(
  tabId: string,
  data: Omit<ClaritySection, "id" | "created_at" | "updated_at">
): Promise<ClaritySection> {
  const result = await pool.query(
    `INSERT INTO clarity_sections
    (tab_id, label, description, display_order, is_active)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [tabId, data.label, data.description, data.display_order, data.is_active]
  );
  return result.rows[0];
}

export async function updateSection(
  id: string,
  data: Partial<ClaritySection>
): Promise<ClaritySection> {
  const updates: string[] = [];
  const values: any[] = [id];
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
    `UPDATE clarity_sections SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteSection(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM clarity_sections WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

// ─── CARDS ──────────────────────────────────────────────────────────────────

export async function createCard(
  sectionId: string,
  data: Omit<ClarityCard, "id" | "created_at" | "updated_at">
): Promise<ClarityCard> {
  const result = await pool.query(
    `INSERT INTO clarity_cards
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
  return result.rows[0];
}

export async function updateCard(
  id: string,
  data: Partial<ClarityCard>
): Promise<ClarityCard> {
  const updates: string[] = [];
  const values: any[] = [id];
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
    `UPDATE clarity_cards SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteCard(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM clarity_cards WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

// ─── SCRIPTS ────────────────────────────────────────────────────────────────

export async function createScript(
  cardId: string,
  data: Omit<ClarityScript, "id" | "created_at" | "updated_at">
): Promise<ClarityScript> {
  const result = await pool.query(
    `INSERT INTO clarity_scripts
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
  return result.rows[0];
}

export async function updateScript(
  id: string,
  data: Partial<ClarityScript>
): Promise<ClarityScript> {
  const updates: string[] = [];
  const values: any[] = [id];
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
    `UPDATE clarity_scripts SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
}

export async function deleteScript(id: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM clarity_scripts WHERE id = $1",
    [id]
  );
  return result.rowCount > 0;
}

export async function getScript(id: string): Promise<ClarityScript | null> {
  const result = await pool.query(
    "SELECT * FROM clarity_scripts WHERE id = $1 LIMIT 1",
    [id]
  );
  return result.rows[0] || null;
}

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────

export async function logChange(
  orgId: string,
  tableName: string,
  recordId: string,
  action: "create" | "update" | "delete",
  changes: Record<string, { old: any; new: any }>,
  changedBy: string,
  adminNote?: string,
  parentChangeId?: string
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO clarity_audit_log
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
): Promise<ClarityAuditLog[]> {
  const result = await pool.query(
    `SELECT * FROM clarity_audit_log
    WHERE org_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );
  return result.rows.map((row) => ({
    ...row,
    changes: typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes,
  }));
}

export async function getAuditEntry(id: string): Promise<ClarityAuditLog | null> {
  const result = await pool.query(
    "SELECT * FROM clarity_audit_log WHERE id = $1 LIMIT 1",
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
      "SELECT * FROM clarity_audit_log WHERE id = $1",
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
    const values: any[] = [entry.record_id];
    let paramCount = 2;

    for (const [field, fieldChange] of Object.entries(changes)) {
      updates.push(`${field} = $${paramCount++}`);
      values.push((fieldChange as any).old);
    }
    updates.push("updated_at = NOW()");

    const table = entry.table_name;
    await client.query(
      `UPDATE ${table} SET ${updates.join(", ")} WHERE id = $1`,
      values
    );

    // Log the revert
    await client.query(
      `INSERT INTO clarity_audit_log
      (org_id, table_name, record_id, action, changes, changed_by, admin_note, parent_change_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.org_id,
        table,
        entry.record_id,
        "update",
        JSON.stringify(changes),
        changedBy,
        `Reverted change ${auditId}`,
        auditId,
      ]
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
