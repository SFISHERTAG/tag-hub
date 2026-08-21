import { writeFileSync } from "node:fs";
import { parseFieldCatalog, ROLE_BY_COLUMN } from "./parse-field-catalog.mjs";

const fields = parseFieldCatalog();
const roles = Object.values(ROLE_BY_COLUMN);

const header = `// GENERATED FILE — do not edit by hand.
// Source: docs/client-fields.md · Regenerate: node scripts/gen-field-catalog.mjs
//
// Hand-transcribing ${fields.length} fields x ${roles.length} roles is precisely where one
// mistyped dash puts TAG's management fee on a client's screen, so the visibility
// table is parsed from the doc rather than retyped. test/field-catalog-drift.test.ts
// re-parses the doc and fails if this file and the doc disagree.

import type { Role } from "@/lib/auth/roles";

/** \`on\` shows by default · \`available\` is opt-in · \`never\` is not selectable at any price. */
export type FieldVisibility = "on" | "available" | "never";

export type FieldDefinition = {
  id: string;
  label: string;
  section: string;
  /** Roles absent from this map are \`never\` — see visibilityOf(). */
  visibility: Partial<Record<Role, FieldVisibility>>;
};

export const FIELD_CATALOG: Record<string, FieldDefinition> = {
`;

const body = fields
  .map((f) => {
    const vis = roles
      .map((r) => `      ${r}: "${f.visibility[r]}",`)
      .join("\n");
    return `  ${JSON.stringify(f.id)}: {
    id: ${JSON.stringify(f.id)},
    label: ${JSON.stringify(f.label)},
    section: ${JSON.stringify(f.section)},
    visibility: {
${vis}
    },
  },`;
  })
  .join("\n");

const footer = `
};

export const FIELD_IDS = Object.keys(FIELD_CATALOG);
`;

writeFileSync("lib/dashboard/field-catalog.generated.ts", header + body + footer);
console.log(`wrote ${fields.length} fields`);
