export interface FlowFramework {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  version: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

export interface FlowTab {
  id: string;
  framework_id: string;
  label: string;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FlowSection {
  id: string;
  tab_id: string;
  label: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FlowCard {
  id: string;
  section_id: string;
  key: string;
  label: string;
  sub_label: string | null;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface FlowScript {
  id: string;
  card_id: string;
  content: string;
  why: string | null;
  notes: string | null;
  version_tag: string | null;
  tags: string[];
  created_by: string;
  created_at: Date;
  updated_by: string;
  updated_at: Date;
}

export interface FlowAuditLog {
  id: string;
  org_id: string;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  changes: Record<string, { old: any; new: any }>;
  changed_by: string;
  admin_note: string | null;
  parent_change_id: string | null;
  created_at: Date;
}

export interface FullFramework {
  id: string;
  version: string;
  tabs: Array<{
    id: string;
    label: string;
    icon: string | null;
    color: string | null;
    sections: Array<{
      id: string;
      label: string;
      description: string | null;
      cards: Array<{
        id: string;
        key: string;
        label: string;
        sub_label: string | null;
        script: FlowScript | null;
      }>;
    }>;
  }>;
}
