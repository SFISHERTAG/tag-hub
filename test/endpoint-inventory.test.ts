import { describe, expect, it } from "vitest";
import {
  featureAreaOf,
  extractServerActions,
  importsLibDirectly,
  routePathOf,
  summarize,
} from "../scripts/lib/endpoint-inventory.mjs";

/**
 * Story 11.5. An Angular SPA cannot call a Server Action, so every data path a
 * screen needs must exist as an endpoint first. This is the inventory that
 * turns "how big is this feature story" into a list rather than a guess.
 *
 * The logic is tested here rather than through the CLI so it needs no
 * filesystem and no git, following scripts/lib/story-references.mjs.
 */

describe("featureAreaOf", () => {
  it("groups a page by its first path segment under app/", () => {
    expect(featureAreaOf("app/portfolio/page.tsx")).toBe("portfolio");
    expect(featureAreaOf("app/csm-dashboard/actions/get-campaigns.ts")).toBe("csm-dashboard");
  });

  it("keeps the dynamic tenant segment as its own area", () => {
    // app/l/[locationId]/** is the location-scoped surface and migrates as one
    // unit, so it must not be split across areas by its dynamic segment.
    expect(featureAreaOf("app/l/[locationId]/today/actions.ts")).toBe("l");
  });

  it("treats app/api as a single area regardless of depth", () => {
    expect(featureAreaOf("app/api/flow/org/[orgId]/framework/route.ts")).toBe("api");
  });

  it("returns null for a file outside app/", () => {
    expect(featureAreaOf("lib/auth/session.ts")).toBeNull();
    expect(featureAreaOf("web/src/app/app.routes.ts")).toBeNull();
  });

  it("groups a root-level page under root rather than dropping it", () => {
    expect(featureAreaOf("app/page.tsx")).toBe("root");
  });
});

describe("extractServerActions", () => {
  it("finds exported async functions in a use-server file", () => {
    const src = [
      '"use server";',
      "",
      "export async function markTaskComplete(id: string) {}",
      "export async function setFollowUpConfig(id: string) {}",
    ].join("\n");
    expect(extractServerActions(src)).toEqual(["markTaskComplete", "setFollowUpConfig"]);
  });

  it("returns nothing for a file without the use-server directive", () => {
    // A plain server module is not a Server Action and needs no endpoint.
    const src = 'import "server-only";\nexport async function getThing() {}';
    expect(extractServerActions(src)).toEqual([]);
  });

  it("accepts single quotes and leading whitespace on the directive", () => {
    const src = "\n  'use server'\n\nexport async function doIt() {}";
    expect(extractServerActions(src)).toEqual(["doIt"]);
  });

  it("ignores a non-exported helper in a use-server file", () => {
    const src = '"use server";\nasync function helper() {}\nexport async function real() {}';
    expect(extractServerActions(src)).toEqual(["real"]);
  });

  it("ignores the directive when it appears inside a comment", () => {
    const src = '// "use server" is not set here\nexport async function nope() {}';
    expect(extractServerActions(src)).toEqual([]);
  });
});

describe("importsLibDirectly", () => {
  it("detects a lib import, which the browser cannot do", () => {
    expect(importsLibDirectly('import { getSession } from "@/lib/auth/session";')).toBe(true);
    expect(importsLibDirectly("import x from '@/lib/ghl/contacts'")).toBe(true);
  });

  it("does not count a relative import that merely contains lib", () => {
    expect(importsLibDirectly('import { a } from "./libtastic";')).toBe(false);
  });

  it("does not count a mention of lib/ in a comment", () => {
    expect(importsLibDirectly("// see lib/auth/session.ts for the rule")).toBe(false);
  });
});

describe("routePathOf", () => {
  it("maps a route file to the URL it serves", () => {
    expect(routePathOf("app/api/onboarding/intake-submit/route.ts")).toBe(
      "/api/onboarding/intake-submit",
    );
  });

  it("keeps dynamic segments so a caller can match against them", () => {
    expect(routePathOf("app/api/flow/org/[orgId]/framework/route.ts")).toBe(
      "/api/flow/org/[orgId]/framework",
    );
  });

  it("returns null for a file that is not a route", () => {
    expect(routePathOf("app/portfolio/page.tsx")).toBeNull();
  });
});

describe("summarize", () => {
  const files = [
    { path: "app/portfolio/page.tsx", source: 'import { getTenant } from "@/lib/ghl/tenants";' },
    {
      path: "app/portfolio/actions.ts",
      source: '"use server";\nexport async function enterTenant() {}',
    },
    { path: "app/api/tenants/route.ts", source: "export async function GET() {}" },
  ];

  it("counts actions, routes and lib-importing pages", () => {
    const s = summarize(files);
    expect(s.actionCount).toBe(1);
    expect(s.actionFileCount).toBe(1);
    expect(s.routeCount).toBe(1);
    expect(s.pagesImportingLib).toBe(1);
    expect(s.pageCount).toBe(1);
  });

  it("scopes to one feature area when asked", () => {
    const s = summarize(files, { area: "api" });
    expect(s.routeCount).toBe(1);
    expect(s.actionCount).toBe(0);
    expect(s.pageCount).toBe(0);
  });

  it("groups actions by area so a story can read its own surface", () => {
    const s = summarize(files);
    expect(s.byArea.portfolio.actions).toEqual(["enterTenant"]);
  });

  it("reports zero rather than throwing on an empty tree", () => {
    const s = summarize([]);
    expect(s.actionCount).toBe(0);
    expect(s.pagesImportingLib).toBe(0);
  });
});
