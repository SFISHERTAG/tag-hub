import { describe, expect, it } from "vitest";

import { FakeStore, fakeRepository } from "./fake-repository";
import type { ProcessedEvent } from "./repository";
import { deleteField, serverTimestamp } from "./sentinels";

/*
 * These cover the five operations the audit found beyond get/set/query, plus
 * create-if-absent. They are the ones a Postgres implementation is most likely
 * to get subtly wrong, so they are the ones pinned here.
 */

describe("repository seam", () => {
  it("round-trips a document through a parent-scoped accessor", async () => {
    const { repository, store } = fakeRepository();

    const ref = repository.onboardingChecklists("loc-1").doc("opp-1");
    await ref.set({ completedSteps: ["intake"], updatedAt: 10 } as never);

    expect(await ref.get()).toEqual({ completedSteps: ["intake"], updatedAt: 10 });
    expect(Object.keys(store.snapshot())).toEqual([
      "locations/loc-1/onboardingChecklists/opp-1",
    ]);
  });

  it("keeps parents separate", async () => {
    const { repository } = fakeRepository();

    await repository.auditLog("loc-1").add({ action: "viewed" } as never);
    await repository.auditLog("loc-2").add({ action: "exported" } as never);

    expect(await repository.auditLog("loc-1").list()).toHaveLength(1);
    expect((await repository.auditLog("loc-1").list())[0].data).toMatchObject({
      action: "viewed",
    });
  });

  it("create() answers false on collision instead of throwing", async () => {
    const { repository } = fakeRepository();
    const ref = repository.webhookEventsProcessed.doc("ghl:evt-1");
    const event: ProcessedEvent = { source: "ghl", eventId: "evt-1", processedAt: 1 };

    expect(await ref.create(event)).toBe(true);
    expect(await ref.create(event)).toBe(false);
  });

  it("getAll returns only the ids that exist, in one call", async () => {
    const { repository } = fakeRepository();
    const outcomes = repository.appointmentOutcomes("loc-1");
    await outcomes.doc("a").set({ status: "noshow" } as never);
    await outcomes.doc("c").set({ status: "invalid" } as never);

    const found = await outcomes.getAll(["a", "b", "c"]);

    expect(found.map((d) => d.id)).toEqual(["a", "c"]);
  });

  it("applies where, orderBy, limit and select", async () => {
    const { repository } = fakeRepository();
    const dlq = repository.webhookDeadLetter;
    await dlq.add({ resolved: false, receivedAt: 1, source: "ghl" } as never);
    await dlq.add({ resolved: false, receivedAt: 3, source: "meta" } as never);
    await dlq.add({ resolved: true, receivedAt: 2, source: "ghl" } as never);

    const open = await dlq.list({
      where: [{ field: "resolved", op: "==", value: false }],
      orderBy: { field: "receivedAt", direction: "desc" },
      limit: 1,
      select: ["source"],
    });

    expect(open).toHaveLength(1);
    expect(open[0].data).toEqual({ source: "meta" });
  });

  it("batches writes so nothing lands until commit", async () => {
    const { repository, store } = fakeRepository();
    const page = repository.manualPages.doc("p1");
    const version = repository.manualPageVersions("p1").doc("v1");

    const batch = repository.batch();
    batch.set(version, { pageId: "p1", createdAt: 1 } as never);
    batch.set(page, { title: "next" } as never);

    expect(store.has("manual_pages/p1")).toBe(false);

    await batch.commit();

    expect(store.has("manual_pages/p1")).toBe(true);
    expect(store.has("manual_pages/p1/versions/v1")).toBe(true);
  });

  it("scans one subcollection name across every parent", async () => {
    const { repository } = fakeRepository();
    await repository.metaConversionLog("loc-1").doc("showed_a").set({ status: "failed" } as never);
    await repository.metaConversionLog("loc-2").doc("showed_b").set({ status: "sent" } as never);
    await repository.metaConversionLog("loc-3").doc("showed_c").set({ status: "failed" } as never);

    const failed = await repository.collectionGroup("metaConversionLog", {
      where: [{ field: "status", op: "==", value: "failed" }],
    });

    expect(failed.map((d) => d.path).sort()).toEqual([
      "locations/loc-1/metaConversionLog/showed_a",
      "locations/loc-3/metaConversionLog/showed_c",
    ]);
  });

  it("gives a collection-group hit a writable ref back", async () => {
    const { repository } = fakeRepository();
    await repository.metaConversionLog("loc-1").doc("showed_a").set({ status: "failed" } as never);

    const [hit] = await repository.collectionGroup("metaConversionLog");
    await hit.ref.update({ status: "sent" } as never);

    expect(await repository.metaConversionLog("loc-1").doc("showed_a").get()).toMatchObject({
      status: "sent",
    });
  });

  it("runs work inside a transaction and returns its result", async () => {
    const { repository } = fakeRepository();
    const ref = repository.authCodes.doc("hash-1");
    await ref.set({ codeHash: "x", expiresAt: 100, attempts: 0 });

    const outcome = await repository.transaction(async (tx) => {
      const current = await ref.get(tx);
      if (!current) return "missing";
      await ref.update({ attempts: current.attempts + 1 }, tx);
      return "counted";
    });

    expect(outcome).toBe("counted");
    expect((await ref.get())?.attempts).toBe(1);
  });

  it("shares one store across accessor calls", async () => {
    const store = new FakeStore();
    const { repository } = fakeRepository(store);
    await repository.groups.doc("g1").set({ name: "closers" } as never);

    expect(store.read("groups/g1")).toEqual({ name: "closers" });
  });
});

describe("server-side sentinels", () => {
  it("lets the store assign serverTimestamp, not the caller", async () => {
    const { repository, store } = fakeRepository();
    const id = await repository.bugReports.add({
      title: "broken",
      createdAt: serverTimestamp(),
    } as never);

    const row = store.read(`bugReports/${id}`);
    expect(typeof row?.createdAt).toBe("number");
    // The branded object must never reach the store.
    expect(JSON.stringify(row)).not.toContain("__tag_sentinel__");
  });

  it("removes a nested field with deleteField rather than writing undefined", async () => {
    const { repository, store } = fakeRepository();
    const ref = repository.onboardingChecklists("loc-1").doc("opp-1");

    await ref.set({ completedTasks: { a: true, b: true } } as never);
    await ref.set({ completedTasks: { b: deleteField() } } as never, { merge: true });

    const row = store.read("locations/loc-1/onboardingChecklists/opp-1");
    expect(row?.completedTasks).toEqual({ a: true });
    expect(Object.keys(row?.completedTasks as object)).not.toContain("b");
  });
})
