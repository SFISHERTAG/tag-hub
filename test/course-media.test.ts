import { describe, expect, it, vi } from "vitest";

/**
 * Story 12.3: a lesson can carry many videos and many reference docs.
 *
 * Two things are worth holding still with tests. The link parser, because an
 * id that reaches an embed src is effectively part of an origin and a loose
 * pattern is how "video id" becomes "somewhere else". And the read path's
 * fallback, because every already-seeded lesson has a `loom_id` and no rows in
 * the new table — if the fallback breaks, every existing course silently loses
 * its video.
 */

const query = vi.fn();

vi.mock("@/lib/postgres", () => ({
  pool: {
    query: (...args: unknown[]) => query(...args),
    connect: async () => ({
      query: (...args: unknown[]) => query(...args),
      release: () => {},
    }),
  },
}));

const { parseVideoLink, embedUrl, isVideoProvider } = await import("@/lib/course/video-links");
const { getCourse } = await import("@/lib/course/db");

describe("parseVideoLink", () => {
  it("reads a provider and id out of each provider's share URL", () => {
    expect(parseVideoLink("https://www.loom.com/share/b8632a6529fa404eb5907c41bf6947ee")).toEqual({
      provider: "loom",
      externalId: "b8632a6529fa404eb5907c41bf6947ee",
    });
    expect(parseVideoLink("https://fathom.video/share/-AWU7a5VzZgHsP41amxSJr_sXjGc8UzX")).toEqual({
      provider: "fathom",
      externalId: "-AWU7a5VzZgHsP41amxSJr_sXjGc8UzX",
    });
    expect(
      parseVideoLink("https://drive.google.com/file/d/1AOUSyQO2BTK6k61e8zmlCWy91vmiGMbQ/view?usp=sharing"),
    ).toEqual({ provider: "drive", externalId: "1AOUSyQO2BTK6k61e8zmlCWy91vmiGMbQ" });
  });

  it("keeps the query string out of the id", () => {
    const parsed = parseVideoLink(
      "https://www.loom.com/share/fdba6345d0cb4175baa850e81066216f?sid=ad416611",
    );
    expect(parsed?.externalId).toBe("fdba6345d0cb4175baa850e81066216f");
  });

  it("accepts an already-bare id only when the provider is stated", () => {
    expect(parseVideoLink("fdba6345d0cb4175baa850e81066216f", "loom")).toEqual({
      provider: "loom",
      externalId: "fdba6345d0cb4175baa850e81066216f",
    });
    expect(parseVideoLink("fdba6345d0cb4175baa850e81066216f")).toBeNull();
  });

  it("refuses anything that is not one of the three providers", () => {
    expect(parseVideoLink("https://evil.example.com/share/abc")).toBeNull();
    expect(parseVideoLink("https://www.youtube.com/watch?v=abc")).toBeNull();
    expect(parseVideoLink("")).toBeNull();
  });

  it("refuses an id carrying path or scheme characters", () => {
    expect(parseVideoLink("abc/../../etc", "loom")).toBeNull();
    expect(parseVideoLink("evil.com", "loom")).toBeNull();
    expect(parseVideoLink("javascript:alert(1)", "loom")).toBeNull();
  });
});

describe("embedUrl", () => {
  it("builds each provider's documented embed form", () => {
    expect(embedUrl("loom", "abc123")).toBe("https://www.loom.com/embed/abc123");
    expect(embedUrl("fathom", "abc-123")).toBe("https://fathom.video/embed/abc-123");
    expect(embedUrl("drive", "abc_123")).toBe("https://drive.google.com/file/d/abc_123/preview");
  });

  it("recognises exactly the three stored providers", () => {
    expect(isVideoProvider("loom")).toBe(true);
    expect(isVideoProvider("vimeo")).toBe(false);
    expect(isVideoProvider(undefined)).toBe(false);
  });
});

describe("getCourse media", () => {
  it("attaches videos and docs to their own lesson, and leaves a bare loom lesson alone", async () => {
    query.mockReset();
    query
      // courses
      .mockResolvedValueOnce({
        rows: [{ id: "c1", slug: "csm-training", title: "CSM Training", description: "" }],
      })
      // course_sections
      .mockResolvedValueOnce({ rows: [{ id: "s1", title: "CSM Training" }] })
      // course_subsections
      .mockResolvedValueOnce({
        rows: [
          { id: "sub1", title: "Call Recordings", loom_id: null, content: "" },
          { id: "sub2", title: "MUST WATCH", loom_id: "afd7384d", content: "body" },
        ],
      })
      // checkboxes
      .mockResolvedValueOnce({ rows: [{ id: "cb1", label: "Watched", subsection_id: "sub2" }] })
      // videos
      .mockResolvedValueOnce({
        rows: [
          {
            id: "v1",
            subsection_id: "sub1",
            provider: "fathom",
            external_id: "xz2a6s",
            label: "Strategy Session - 2026/04/22",
          },
          { id: "v2", subsection_id: "sub1", provider: "drive", external_id: "1AOU", label: null },
        ],
      })
      // docs
      .mockResolvedValueOnce({
        rows: [{ id: "d1", subsection_id: "sub2", label: "Offer doc", url: "https://docs.google.com/x" }],
      });

    const course = await getCourse("csm-training");
    const [recordings, mustWatch] = course!.sections[0].subsections;

    expect(recordings.videos).toEqual([
      {
        id: "v1",
        provider: "fathom",
        externalId: "xz2a6s",
        label: "Strategy Session - 2026/04/22",
      },
      { id: "v2", provider: "drive", externalId: "1AOU", label: undefined },
    ]);
    expect(recordings.docs).toEqual([]);
    expect(recordings.checkboxes).toEqual([]);

    // The already-seeded shape: a loom_id, no rows in the new table.
    expect(mustWatch.loomId).toBe("afd7384d");
    expect(mustWatch.videos).toEqual([]);
    expect(mustWatch.docs).toEqual([{ id: "d1", label: "Offer doc", url: "https://docs.google.com/x" }]);
    expect(mustWatch.checkboxes).toEqual([{ id: "cb1", label: "Watched" }]);
  });

  it("issues four queries per section regardless of lesson count", async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({
        rows: [{ id: "c1", slug: "s", title: "T", description: "" }],
      })
      .mockResolvedValueOnce({ rows: [{ id: "s1", title: "Section" }] })
      .mockResolvedValueOnce({
        rows: Array.from({ length: 12 }, (_unused, index) => ({
          id: `sub${index}`,
          title: `Lesson ${index}`,
          loom_id: null,
          content: "",
        })),
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await getCourse("s");

    // courses + sections + subsections + 3 batched child queries. The old
    // per-subsection shape would have been 15 for the checkboxes alone.
    expect(query).toHaveBeenCalledTimes(6);
  });

  it("skips the child queries entirely for a section with no lessons", async () => {
    query.mockReset();
    query
      .mockResolvedValueOnce({ rows: [{ id: "c1", slug: "s", title: "T", description: "" }] })
      .mockResolvedValueOnce({ rows: [{ id: "s1", title: "Empty" }] })
      .mockResolvedValueOnce({ rows: [] });

    const course = await getCourse("s");

    expect(course!.sections[0].subsections).toEqual([]);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
