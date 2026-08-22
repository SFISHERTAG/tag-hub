import { describe, expect, it, beforeEach, vi } from "vitest";

/**
 * Story: agency tokens shared one Firestore document. A second agency
 * completing a company-level install overwrote ours, `companyId` included, so
 * every later mint for every one of our own sub-accounts would have gone to
 * the wrong company. These tests pin the two properties that prevent it: an
 * install lands under its own company, and the primary is assigned once.
 */

type Doc = Record<string, unknown>;

const docs = new Map<string, Doc>();

function docRef(path: string) {
  return {
    id: path.split("/").pop()!,
    async get() {
      const data = docs.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    async set(value: Doc, options?: { merge?: boolean }) {
      docs.set(
        path,
        options?.merge ? { ...(docs.get(path) ?? {}), ...value } : value,
      );
    },
  };
}

const fakeFirestore = {
  doc: (path: string) => docRef(path),
  collection: (path: string) => ({
    async listDocuments() {
      return [...docs.keys()]
        .filter((key) => key.startsWith(`${path}/`))
        .filter((key) => key.slice(path.length + 1).split("/").length === 1)
        .map((key) => docRef(key));
    },
  }),
};

vi.mock("@/lib/firestore", () => ({ firestore: () => fakeFirestore }));

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
  docs.clear();
});

describe("agency token storage", () => {
  it("stores the first install under its own company and makes it primary", async () => {
    await saveAgencyToken(token("tag-co"));

    expect(await loadPrimaryCompanyId()).toBe("tag-co");
    expect(await loadAgencyToken()).toMatchObject({ companyId: "tag-co" });
    expect(docs.get("ghl/agency/companies/tag-co")).toMatchObject({
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
    docs.set("ghl/agency", token("legacy-co"));

    expect(await loadAgencyToken()).toMatchObject({
      companyId: "legacy-co",
      accessToken: "access-legacy-co",
    });
    expect(docs.get("ghl/agency/companies/legacy-co")).toMatchObject({
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
    expect(docs.size).toBe(0);
  });

  it("returns null rather than a stranger's token when nothing is installed", async () => {
    expect(await loadAgencyToken()).toBeNull();
    expect(await loadPrimaryCompanyId()).toBeNull();
  });
});
