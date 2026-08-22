import { describe, expect, it } from "vitest";
import { canSeeCourse, COURSE_AUDIENCES } from "@/lib/course/visibility";
import { NEW_LEGACY_COURSES, CREDENTIAL_PLACEHOLDER } from "@/lib/course/legacy-content";
import { COURSE_CORRECTIONS } from "@/lib/course/legacy-corrections";
import { ROLES } from "@/lib/auth/role-labels";

/**
 * Story 12.4. Three things are worth holding still.
 *
 * The shape of the import, because it is a consolidation: the CSM course has
 * 13 lessons here and 15 in Skool, and a regression that quietly restored the
 * three retired funnel lessons would look like a successful import.
 *
 * The two data-handling decisions, because both were explicit calls and both
 * are invisible once made. Prospect names are stripped from recording labels,
 * and no live credential is committed to this repo.
 *
 * The visibility rule, because the failure direction matters: unset must mean
 * everyone, not nobody. Reading it the other way would have removed the
 * onboarding course from every client on the day the migration ran.
 */

const byslug = (slug: string) => {
  const course = NEW_LEGACY_COURSES.find((candidate) => candidate.slug === slug);
  if (!course) throw new Error(`No course ${slug} in the import.`);
  return course;
};

const lessonsOf = (slug: string) => byslug(slug).sections.flatMap((section) => section.lessons);

describe("legacy course import shape", () => {
  it("imports the CSM course consolidated, not as Skool currently lists it", () => {
    const titles = lessonsOf("csm-training").map((lesson) => lesson.title);

    expect(titles).toHaveLength(13);

    // The merge: one funnel lesson carrying all three recordings.
    expect(titles).toContain("Building a Client Funnel (Standard Build)");
    expect(titles).not.toContain("Building a Funnel on GHL ( DJ)");
    expect(titles).not.toContain("Building Clients Funnels Austyn P1");
    expect(titles).not.toContain("Building Clients Funnels Austyn P2");

    // The rename: ADS becomes the callout-standards lesson.
    expect(titles).toContain("Ad Copy & Callout Standards");
    expect(titles).not.toContain("ADS");

    const funnel = lessonsOf("csm-training").find(
      (lesson) => lesson.title === "Building a Client Funnel (Standard Build)",
    );
    expect(funnel?.videos.map((video) => video.externalId)).toEqual([
      "c93aae97f09e44eea82891ce5ee6c0ae",
      "530d713b269747f188455aef0de0d94c",
      "a9bf78a043d8477abc34310939acc0a6",
    ]);
  });

  it("carries the video the earlier handoff missed on How to Sell This", () => {
    const lesson = lessonsOf("sales-rep-training").find(
      (candidate) => candidate.title === "How to Sell This",
    );
    expect(lesson?.videos).toEqual([
      { provider: "loom", externalId: "904430ad38ac4d5499b54fa09a38e967" },
    ]);
  });

  it("keeps all 35 recordings on the call recording lesson, 24 Fathom and 11 Drive", () => {
    const lesson = lessonsOf("sales-rep-training").find(
      (candidate) => candidate.title === "Call Recording Links",
    );
    const videos = lesson?.videos ?? [];

    expect(videos).toHaveLength(35);
    expect(videos.filter((video) => video.provider === "fathom")).toHaveLength(24);
    expect(videos.filter((video) => video.provider === "drive")).toHaveLength(11);
  });

  it("assigns no lesson the same video twice, and no video to two lessons", () => {
    const all = NEW_LEGACY_COURSES.flatMap((course) =>
      course.sections.flatMap((section) =>
        section.lessons.flatMap((lesson) => lesson.videos.map((video) => video.externalId)),
      ),
    );
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("data-handling decisions", () => {
  it("strips prospect names from recording labels", () => {
    const labels = lessonsOf("sales-rep-training")
      .flatMap((lesson) => lesson.videos)
      .map((video) => video.label ?? "");

    // The names that were on the source labels.
    for (const name of [
      "Julia Hernandez",
      "Jeremy Sudik",
      "Sandy",
      "Mike Aversano",
      "Luis Miletti",
      "Kenneth Feyers",
      "Seth McCormick",
    ]) {
      expect(labels.some((label) => label.includes(name))).toBe(false);
    }

    // The date survives, because it is what makes one recording findable.
    expect(labels).toContain("Strategy session - 2026/04/22");
  });

  it("commits no live credential, only a pointer", () => {
    const bodies = NEW_LEGACY_COURSES.flatMap((course) =>
      course.sections.flatMap((section) => section.lessons.map((lesson) => lesson.content)),
    );

    const wistia = bodies.find((body) => body.includes("Wistia login"));
    const facebook = bodies.find((body) => body.includes("Facebook login"));

    expect(wistia).toContain(CREDENTIAL_PLACEHOLDER);
    expect(facebook).toContain(CREDENTIAL_PLACEHOLDER);

    // Nothing that looks like the passwords the source lessons carried.
    for (const body of bodies) {
      expect(body).not.toMatch(/TAG\d{4,}/);
    }
  });

  it("restates the sales-rep audience on the call recording lesson itself", () => {
    const lesson = lessonsOf("sales-rep-training").find(
      (candidate) => candidate.title === "Call Recording Links",
    );
    expect(lesson?.visibleToRoles).toEqual(COURSE_AUDIENCES.SALES_REP);
  });
});

describe("course visibility", () => {
  it("treats an unset audience as everyone, not nobody", () => {
    // The seeded client-facing courses. If this inverted, every client would
    // lose the onboarding course the day the migration ran.
    expect(canSeeCourse(ROLES.CLIENT_OWNER, [])).toBe(true);
    expect(canSeeCourse(undefined, [])).toBe(true);
  });

  it("keeps internal training out of a client's course list", () => {
    const csm = byslug("csm-training").visibleToRoles;

    expect(canSeeCourse(ROLES.TAG_CSM, csm)).toBe(true);
    expect(canSeeCourse(ROLES.TAG_CSD, csm)).toBe(true);
    expect(canSeeCourse(ROLES.CLIENT_OWNER, csm)).toBe(false);
    expect(canSeeCourse(ROLES.CLIENT_CLOSER, csm)).toBe(false);
  });

  it("keeps client call recordings out of the CSM course audience", () => {
    const salesRep = byslug("sales-rep-training").visibleToRoles;

    expect(canSeeCourse(ROLES.TAG_SALES, salesRep)).toBe(true);
    expect(canSeeCourse(ROLES.TAG_SALES_MANAGER, salesRep)).toBe(true);
    expect(canSeeCourse(ROLES.TAG_CSM, salesRep)).toBe(false);
  });

  it("never locks an admin out of a course they administer", () => {
    expect(canSeeCourse(ROLES.ADMIN, byslug("csm-training").visibleToRoles)).toBe(true);
    expect(canSeeCourse(ROLES.ADMIN, byslug("sales-rep-training").visibleToRoles)).toBe(true);
  });
});

describe("part C corrections", () => {
  it("covers every lesson in both seeded courses", () => {
    const onboarding = COURSE_CORRECTIONS.find((c) => c.slug === "onboarding-expectations");
    const sales = COURSE_CORRECTIONS.find((c) => c.slug === "sales-training");

    // 12 and 10, not the 11 and 9 the handoff recorded.
    expect(onboarding?.lessons).toHaveLength(12);
    expect(sales?.lessons).toHaveLength(10);
  });

  it("replaces the summary rather than trimming it", () => {
    const sales = COURSE_CORRECTIONS.find((c) => c.slug === "sales-training");
    const total = (sales?.lessons ?? []).reduce((sum, lesson) => sum + lesson.content.length, 0);

    // seed.ts holds ~4,463 characters for this course. Anything close to that
    // means a correction quietly reverted to the paraphrase.
    expect(total).toBeGreaterThan(50_000);
  });

  it("keeps Committing Phase, which the handoff suspected was never real", () => {
    const sales = COURSE_CORRECTIONS.find((c) => c.slug === "sales-training");
    const lesson = sales?.lessons.find((l) => l.loomId === "d8244b649066442ca7577d620aa4f826");

    expect(lesson).toBeDefined();
    expect(lesson?.content).toContain("The Commitment Phase");
  });

  it("uses support@ on both lessons whose page text and mailto disagreed", () => {
    const onboarding = COURSE_CORRECTIONS.find((c) => c.slug === "onboarding-expectations");
    const crm = onboarding?.lessons.find((l) => l.loomId === "a8cb4c5e6d9542de934a3943cc7843a9");
    const meta = onboarding?.lessons.find((l) => l.loomId === "d979f9495e78411786926aac21bcf483");

    for (const lesson of [crm, meta]) {
      expect(lesson?.content).toContain("support@taxadvisorygrowth.net");
      expect(lesson?.content).not.toContain("dj@thedealclosers.net");
      expect(lesson?.content).not.toContain("dmbcwithaustyn@gmail.com");
    }
  });

  it("does not add the tech-support booking link that is not on the live page", () => {
    const onboarding = COURSE_CORRECTIONS.find((c) => c.slug === "onboarding-expectations");
    const bookCall = onboarding?.lessons.find((l) => l.title === "Book A Call 2-3 Days");

    expect(bookCall?.content).toContain("GCG8N9f8oqMtDZx9lPXE");
    expect(bookCall?.content).toContain("KX741GkenVU8IjGvPBuX");
    expect(bookCall?.content).not.toContain("tag-technical-support");
  });

  it("gives every correction a unique join key", () => {
    for (const course of COURSE_CORRECTIONS) {
      const keys = course.lessons.map((lesson) => lesson.loomId || `title:${lesson.title}`);
      expect(new Set(keys).size).toBe(keys.length);
      // A keyless correction would update by `undefined` and match nothing.
      expect(keys.every((key) => key && key !== "title:undefined")).toBe(true);
    }
  });

  it("retitles only where the lesson was actually renamed", () => {
    const retitled = COURSE_CORRECTIONS.flatMap((course) =>
      course.lessons.filter((lesson) => lesson.title && lesson.loomId),
    );

    // Skool also differs on three others by a typo, a stray space and
    // capitalisation. Copying those in would be churn.
    expect(retitled).toHaveLength(1);
    expect(retitled[0].title).toBe("Niches, Offer, Pricing, Closing");
  });
});
