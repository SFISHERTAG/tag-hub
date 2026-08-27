import { describe, expect, it } from "vitest";
import { AUTHORED_CHANGES, AUTHORED_COURSE_SLUG } from "@/lib/course/authored-lessons";

/**
 * Story 12.5. These lessons are written, not migrated, so the tests are about
 * whether the standard actually made it into the text — a lesson that reads
 * well but omits the trap it exists to teach is worse than no lesson, because
 * someone will believe they have been told.
 */

const change = (title: string) =>
  AUTHORED_CHANGES.find((c) => (c.kind === "edit" ? c.matchTitle : c.title) === title);

const bodyOf = (title: string) => change(title)?.content ?? "";

describe("authored lessons", () => {
  it("targets the CSM course and covers all five gaps plus the four updates", () => {
    expect(AUTHORED_COURSE_SLUG).toBe("csm-training");

    const inserts = AUTHORED_CHANGES.filter((c) => c.kind === "insert");
    const edits = AUTHORED_CHANGES.filter((c) => c.kind === "edit");

    expect(inserts.map((c) => (c.kind === "insert" ? c.title : ""))).toEqual([
      "Fulfillment Intro",
      "Client Intake Form Walkthrough",
      "Using AI for Scripts and Assets",
      "Pixel Install and Ad Account Access",
    ]);
    expect(edits).toHaveLength(5);
  });

  it("teaches both silent-failure traps in the pixel lesson", () => {
    const body = bodyOf("Pixel Install and Ad Account Access");

    // Trap one: where the data set is created.
    expect(body).toContain("inside the ad account");
    expect(body).toMatch(/Not from Events Manager/i);
    expect(body).toMatch(/Not from Business Settings/i);

    // Trap two: where the code goes.
    expect(body).toContain("Head Tracking Code");
    expect(body).toContain("Not Body Tracking Code");

    // And the rest of the standard.
    expect(body).toContain("Meta Pixel only");
    expect(body).toContain("Track Button");
    expect(body).toContain("Schedule");
    expect(body).toMatch(/Never personal contact details/i);
  });

  it("puts the real A2P blocker in the A2P lesson", () => {
    const body = bodyOf("A2P");

    // The outline attributed the pixel traps to this lesson. They are not its
    // failure mode; the chat widget and the EIN are.
    expect(body).toContain("chat widget");
    expect(body).toContain("EIN");
    expect(body).toContain("A2P 10DLC");
    expect(body).not.toContain("Head Tracking Code");
  });

  it("states the compliance gate as a standard, not a suggestion", () => {
    const body = bodyOf("Complete Tax Offer Structure");

    expect(body).toContain("Circular 230");
    expect(body).toMatch(/state board advertising rules/i);
    expect(body).toContain("written sign-off");
    expect(body).toMatch(/Guarantee the process and the engagement/i);
  });

  it("carries the callout-specificity example the outline asked for", () => {
    const body = bodyOf("Ad Copy & Callout Standards");

    expect(body).toContain("High income attorneys");
    expect(body).toContain("Attorneys making over $400,000 a year");
    expect(body).toMatch(/the copy is the primary signal/i);
  });

  it("carries the full Wistia checklist including why captions is off", () => {
    const body = bodyOf("Wistia Training");

    expect(body).toContain("#ebc507");
    for (const control of ["Auto Play", "Play with Sound", "Big Play Button", "Full Screen"]) {
      expect(body).toContain(control);
    }
    expect(body).toMatch(/Control Bar, Play Bar, Captions, Settings/);
    expect(body).toMatch(/burns captions into the creative/i);
  });

  it("gives the reminder workflow its exact wait-step configuration", () => {
    const body = bodyOf("Reminders");

    expect(body).toContain("Until Scheduled Time");
    expect(body).toMatch(/Skip all outbound communications until the next one/i);
    expect(body).toContain("12h, 6h, 3h, 1h");
    expect(body).toContain("{{appointment.meeting_location}}");
  });

  it("walks all nine intake sections and names what feeds the script", () => {
    const body = bodyOf("Client Intake Form Walkthrough");

    for (const section of [
      "Firm Information",
      "Program Details Confirmation",
      "Advertising & Marketing Setup",
      "Next Steps",
      "Tax Advisory Offer",
      "Ideal Client",
      "Pain Points & Motivation",
      "Results & Proof",
      "Competition & Positioning",
    ]) {
      expect(body).toContain(section);
    }
    expect(body).toMatch(/thin intake produces a thin script/i);
  });

  it("says plainly where the fulfillment source is missing rather than inventing it", () => {
    const body = bodyOf("Fulfillment Intro");

    expect(body).toMatch(/intake quality/i);
    expect(body).toMatch(/compliance review/i);
    expect(body).toMatch(/launch review/i);
    // The Ops Design Doc is not in the repo, and the lesson admits it.
    expect(body).toMatch(/Ops Design Doc, which is not yet in the Hub/i);
  });

  it("introduces no credential value anywhere", () => {
    for (const c of AUTHORED_CHANGES) {
      expect(c.content).not.toMatch(/TAG\d{4,}/);
      expect(c.content).not.toMatch(/password[:=]\s*\S+/i);
    }
    // The two lessons that need one still point at the placeholder.
    expect(bodyOf("Wistia Training")).toMatch(/ask your account manager/i);
    expect(bodyOf("Ad Copy & Callout Standards")).toMatch(/ask your account manager/i);
  });

  it("cites a source on every authored lesson", () => {
    for (const c of AUTHORED_CHANGES) {
      expect(c.content).toMatch(/Source: /);
    }
  });
});
