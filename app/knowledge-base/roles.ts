import type { Role } from "@/lib/auth/roles";

/** Every TAG-side hat (i.e. not a client-side role) — shared between the view and admin edit routes. */
export const TAG_STAFF_ROLES: Role[] = [
  "admin",
  "tag_exec",
  "tag_csd",
  "tag_csm",
  "tag_sales_manager",
  "tag_sales",
  "tag_setter_manager",
  "tag_setter",
];
