import "server-only";
import { isRole, type Role } from "@/lib/auth/roles";
import type {
  DashboardConfig,
  DashboardPage,
  WidgetPlacement,
  WidgetSize,
} from "@/lib/dashboard/widget-definitions";
import { badRequest } from "./http";

/**
 * Parses an untrusted PUT body into a DashboardConfig.
 *
 * The reference implementation (legacy/dashboard/customize/actions.ts) took a
 * typed `DashboardConfig` argument, which a Server Action's serialization made
 * approximately true. An HTTP body has no such guarantee, so the shape is
 * checked field by field here. Entitlement and size limits are enforced
 * separately in the route — this only establishes that the thing is a config.
 */

const MAX_COLS = 4;
const MAX_ROWS = 4;

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw badRequest(`${what} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest(`${what} must be a non-empty string.`);
  }
  return value;
}

function asOptionalString(value: unknown, what: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw badRequest(`${what} must be a string when present.`);
  return value;
}

function asInteger(value: unknown, what: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw badRequest(`${what} must be an integer.`);
  }
  return value;
}

function asRole(value: unknown): Role {
  if (!isRole(value)) throw badRequest("config.role is not a known role.");
  return value;
}

function parseSize(value: unknown, what: string): WidgetSize {
  const raw = asRecord(value, what);
  const cols = asInteger(raw.cols, `${what}.cols`);
  const rows = asInteger(raw.rows, `${what}.rows`);
  if (cols < 1 || rows < 1 || cols > MAX_COLS || rows > MAX_ROWS) {
    throw badRequest(
      `${what} is out of range: cols and rows must be between 1 and ${MAX_COLS}/${MAX_ROWS}.`,
    );
  }
  return { cols, rows };
}

function parsePlacement(value: unknown, what: string): WidgetPlacement {
  const raw = asRecord(value, what);
  const position = asRecord(raw.position, `${what}.position`);
  return {
    id: asString(raw.id, `${what}.id`),
    widgetId: asString(raw.widgetId, `${what}.widgetId`),
    position: {
      x: asInteger(position.x, `${what}.position.x`),
      y: asInteger(position.y, `${what}.position.y`),
    },
    size: parseSize(raw.size, `${what}.size`),
  };
}

function parsePage(value: unknown, what: string): DashboardPage {
  const raw = asRecord(value, what);
  if (!Array.isArray(raw.widgets)) throw badRequest(`${what}.widgets must be an array.`);
  return {
    id: asString(raw.id, `${what}.id`),
    title: asString(raw.title, `${what}.title`),
    icon: asOptionalString(raw.icon, `${what}.icon`),
    widgets: raw.widgets.map((w, i) => parsePlacement(w, `${what}.widgets[${i}]`)),
  };
}

export function parseDashboardConfig(body: unknown): DashboardConfig {
  const raw = asRecord(body, "config");
  if (!Array.isArray(raw.pages)) throw badRequest("config.pages must be an array.");
  if (raw.pages.length === 0) throw badRequest("config.pages must contain at least one page.");

  const pages = raw.pages.map((p, i) => parsePage(p, `config.pages[${i}]`));

  const currentPage = asInteger(raw.currentPage, "config.currentPage");
  if (currentPage < 0 || currentPage >= pages.length) {
    throw badRequest(
      `config.currentPage must index one of the ${pages.length} pages being saved.`,
    );
  }

  const ids = new Set<string>();
  for (const page of pages) {
    if (ids.has(page.id)) throw badRequest(`Duplicate page id "${page.id}".`);
    ids.add(page.id);
  }

  return {
    role: asRole(raw.role),
    pages,
    currentPage,
    // Server-stamped. A client clock is not a source of truth for "when was
    // this saved", and saveDashboardConfig writes NOW() to the row anyway.
    updatedAt: Date.now(),
  };
}
