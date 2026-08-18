import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Phase 1 audit item 1.3: every view CSMPortfolio switches between
 * (grid/list/kanban/escalations) renders health scores and escalation
 * buckets sourced from getMockMetrics (lib/dashboard/mock-metrics.ts) --
 * sample data, not a live reading, pending the budget/lead-target schema
 * work documented on getMockMetrics itself. This confirms the disclosure
 * banner actually renders rather than just that the import compiles.
 *
 * getAssignedClientsForCSM is a "use server" action that drags in the
 * Firestore Admin SDK through lib/dashboard/csm-clients.ts, so it's mocked
 * here the same way test/otp-request.test.ts and test/client-health-dq.test.ts
 * mock their own external dependencies rather than hitting them for real.
 */
vi.mock("./actions/get-assigned-clients", () => ({
  getAssignedClientsForCSM: vi.fn().mockResolvedValue([]),
}));

const { CSMPortfolio } = await import("./csm-portfolio");

describe("CSMPortfolio sample data disclosure (Phase 1 audit item 1.3)", () => {
  it("renders SampleDataBanner so mock-backed health/escalation data isn't shown as if it were live", () => {
    const html = renderToStaticMarkup(
      createElement(CSMPortfolio, { csmEmail: "csm@tag.com", userRole: "tag_csm" }),
    );

    expect(html).toContain("Sample data");
  });
});
