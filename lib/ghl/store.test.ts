import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Story: agency tokens shared one Firestore document. A second agency
 * completing a company-level install overwrote ours, `companyId` included, so
 * every later mint for every one of our own sub-accounts would have gone to
 * the wrong company. These tests pin the two properties that prevent it: an
 * install lands under its own company, and the primary is assigned once.
 */

import { FakeStore, fakeRepository } from "@/lib/data/fake-repository";

/*
 * Uses the repository seam's fake (story 14.1), replacing a hand-rolled
 * Firestore with its own docRef, merge semantics and a listDocuments that
 * re-implemented "direct children only" path filtering.
 *
 * That stub is why this file needed changing at all: it implemented exactly
 * the Firestore surface this module used, so it encoded that surface as the
 * contract and broke the moment the module moved behind the seam. The
 * behaviour under test is unchanged.
 */
const store = new FakeStore();
const { repository } = fakeRepository(store);

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return { ...actual, repository: () => repository };
});

const {
  saveAgencyToken,
  loadAgencyToken,
  loadPrimaryCompanyId,
  listAgencyCompanyIds,
  InvalidCompanyIdError,
} = await import("./store");

function token(companyId: string) {
  return {
    accessToken: `access-${companyId}`,
    refreshToken: `refresh-${companyId}`,
    companyId,
    expiresAt: 1_000,
    updatedAt: 1_000,
  };
}

beforeEach(() => {
  for (const path of Object.keys(store.snapshot())) store.remove(path);
});

describe("agency token storage", () => {
  it("stores the first install under its own company and makes it primary", async () => {
    await saveAgencyToken(token("tag-co"));

    expect(await loadPrimaryCompanyId()).toBe("tag-co");
    expect(await loadAgencyToken()).toMatchObject({ companyId: "tag-co" });
    expect(store.read("ghl/agency/companies/tag-co")).toMatchObject({
      accessToken: "access-tag-co",
    });
  });

  it("a second agency's install does not overwrite ours or steal primary", async () => {
    await saveAgencyToken(token("tag-co"));
    await saveAgencyToken(token("outside-co"));

    // The defect: this used to return the outsider's token.
    expect(await loadPrimaryCompanyId()).toBe("tag-co");
    expect(await loadAgencyToken()).toMatchObject({
      companyId: "tag-co",
      accessToken: "access-tag-co",
    });

    // Stored, not discarded — it is a real install, just not the portfolio's.
    expect(await loadAgencyToken("outside-co")).toMatchObject({
      companyId: "outside-co",
    });
    expect((await listAgencyCompanyIds()).sort()).toEqual([
      "outside-co",
      "tag-co",
    ]);
  });

  it("re-installing the primary agency refreshes it in place", async () => {
    await saveAgencyToken(token("tag-co"));
    await saveAgencyToken({ ...token("tag-co"), accessToken: "access-rotated" });

    expect(await loadPrimaryCompanyId()).toBe("tag-co");
    expect(await loadAgencyToken()).toMatchObject({
      accessToken: "access-rotated",
    });
  });

  it("migrates a legacy root token into the per-company layout on read", async () => {
    // What a deployment installed before this change actually has on disk.
    store.write("ghl/agency", token("legacy-co"));

    expect(await loadAgencyToken()).toMatchObject({
      companyId: "legacy-co",
      accessToken: "access-legacy-co",
    });
    expect(store.read("ghl/agency/companies/legacy-co")).toMatchObject({
      accessToken: "access-legacy-co",
    });
    expect(await loadPrimaryCompanyId()).toBe("legacy-co");

    // And the migrated primary is not displaced by a later outside install.
    await saveAgencyToken(token("outside-co"));
    expect(await loadAgencyToken()).toMatchObject({ companyId: "legacy-co" });
  });

  it("refuses a company id that is not usable as a path segment", async () => {
    await expect(
      saveAgencyToken(token("../../etc/passwd")),
    ).rejects.toBeInstanceOf(InvalidCompanyIdError);
    expect(Object.keys(store.snapshot())).toHaveLength(0);
  });

  it("returns null rather than a stranger's token when nothing is installed", async () => {
    expect(await loadAgencyToken()).toBeNull();
    expect(await loadPrimaryCompanyId()).toBeNull();
  });
});
