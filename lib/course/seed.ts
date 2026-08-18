import { pool } from "@/lib/postgres";
import type { Course } from "./types";

/**
 * One-time migration of the old static lib/course/data.ts content into
 * Postgres. Run once against a fresh courses table; re-running is safe
 * (ON CONFLICT (slug) DO NOTHING skips courses that already exist) but
 * won't pick up edits made after the first run — that's what the admin
 * UI is for from here on.
 */

function loomId(shareUrl: string): string {
  const match = shareUrl.match(/https:\/\/www\.loom\.com\/share\/([a-zA-Z0-9]+)/);
  return match ? match[1] : "";
}

const SEED_COURSES: Course[] = [
  {
    id: "onboarding-expectations",
    title: "Onboarding & Expectations",
    description: "Get your account set up and operational.",
    sections: [
      {
        id: "onboarding",
        title: "Onboarding & Expectations",
        subsections: [
          {
            id: "welcome",
            title: "Onboarding & Expectations",
            loomId: loomId("https://www.loom.com/share/fdba6345d0cb4175baa850e81066216f"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: "",
          },
          {
            id: "scaling-model",
            title: "The Modern Tax Advisory Scaling Model",
            loomId: loomId("https://www.loom.com/share/2f922c4caa12477699f8f5a6f3e1a590"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `For CPAs, EAs & Tax Firms Looking To Scale The Advisory Side Of Their Business

Most tax firms struggle to scale their advisory division because they're focused on selling services instead of outcomes.

They lead with:
- Tax Planning
- Tax Advisory
- Tax Strategy
- CFO Services
- Tax Consulting

The problem is that business owners don't wake up looking for any of those things.

They wake up thinking:
- "I paid too much in taxes."
- "There has to be a better way."
- "I don't know if my current CPA is being proactive."
- "I feel like I'm leaving money on the table."
- "I want to legally keep more of what I earn."

The market doesn't buy tax planning. The market buys outcomes.`,
          },
          {
            id: "intake-form",
            title: "Intake Form",
            loomId: loomId("https://www.loom.com/share/e7a4b69c92d845a79cf8d070d09594c7"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "completed", label: "Form completed" },
            ],
            content: `This Intake Form was Given To You On Your Onboarding Call

Describe your Tax Advisory Offer in as much detail as possible. What specific outcomes do clients achieve working with you?

Walk us through your Tax Advisory process from start to finish.

What makes your Tax Advisory offer different from every other CPA, EA, or Tax Firm?

Do you offer a money-back guarantee or any form of risk reversal?

What is the average investment for a client to work with you? Please include Assessment/Audit Fee, Tax Plan Fee, Implementation Fee, and Ongoing Advisory/CFO Fee.`,
          },
          {
            id: "book-call",
            title: "Book A Call 2-3 Days",
            checkboxes: [{ id: "booked", label: "Call booked" }],
            content: `Use the link below to book a call, 2-3 days after the intake form has been updated by you. Also be sure to hold on to this link because this is how you will book calls with our fulfillment team, for the duration of our service to you and your business.

Walters Booking Link: https://links.thedealclosers.net/widget/booking/GCG8N9f8oqMtDZx9lPXE
Samuel Booking Link: https://links.thedealclosers.net/widget/booking/KX741GkenVU8IjGvPBuX`,
          },
          {
            id: "crm-access",
            title: "Access To CRM",
            loomId: loomId("https://www.loom.com/share/a8cb4c5e6d9542de934a3943cc7843a9"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "granted", label: "Access granted" },
            ],
            content: `Use This Email for Invite To Highlevel: support@taxadvisorygrowth.net

Make sure you give us access to the agency access. If you do not have atp (texting) set up, give invite to your account managers email.

Use This Link To Sign Up: https://www.gohighlevel.com/em-30-day-trial (Starter Plan $97/month with 30-day free trial)`,
          },
          {
            id: "domain",
            title: "Purchasing Domain",
            loomId: loomId(
              "https://www.loom.com/share/2180fa7ffbed46f5855fc550e7ae0d90?sid=82884d95-0128-4e0b-88e8-35949e40fccd",
            ),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "purchased", label: "Domain purchased" },
            ],
            content: "",
          },
          {
            id: "meta-account",
            title: "Access To META Ad Account",
            loomId: loomId("https://www.loom.com/share/d979f9495e78411786926aac21bcf483"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "granted", label: "Access granted" },
            ],
            content: `Invite this email: support@taxadvisorygrowth.net`,
          },
          {
            id: "calendar",
            title: "Setting Up Calendar & Availability",
            loomId: loomId(
              "https://www.loom.com/share/4421043f354343a99be4285a510f19fd?sid=2d8966de-d62d-4746-8b78-84dd52cdfb33",
            ),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "setup", label: "Calendar set up" },
            ],
            content: "",
          },
          {
            id: "actors",
            title: "Finding Actors",
            loomId: loomId("https://www.loom.com/share/884e665030f142f8b2dd954084ff5bab"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "selected", label: "Actor selected" },
            ],
            content: `Here is the doc for actors. Please let your account manager know the number of the person you want to use (1-17). You can listen to the audio to hear how the spokesperson sounds. 7-10 day delivery with actors which covers the time for them to film and edit.

https://docs.google.com/document/d/1sYBWN8FDKkVD9VfuXbTvyQfYYKuk761K6mgngvxpYGM/edit`,
          },
          {
            id: "recording",
            title: "Recording Instructions (Skip if Using an Actor)",
            loomId: loomId("https://www.loom.com/share/75984e180643411abb55796c4ea76882"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "organized", label: "Footage recorded and organized" },
            ],
            content: `Step 1: Create a Google Drive, Select "Share", "Anyone with Link" & "Editor Access"

Step 2: Label your folders:
- Ad1 (Vertical)
- VSL (Horizontal)
- Pre Call (Horizontal)
- Testimonial Pictures With Labeled Name
- Company Logo

Step 3: Buy Domain If You Don't Have One

Step 4: Get Set Up On HighLevel: https://www.gohighlevel.com/highlevel-bootcamp`,
          },
          {
            id: "payment",
            title: "Payment Processor (Financing)",
            loomId: loomId("https://www.loom.com/share/0920e3e8fde34686a6724b5b558e5b0b"),
            checkboxes: [
              { id: "watched", label: "Watched" },
              { id: "booked", label: "Call booked with Luminos" },
            ],
            content: `Use This Link To Book A Call With Luminos For Payment Processor With Financing:
https://calendly.com/robert-golumino/ttg

Make sure you put "REFERRED BY THE DEAL CLOSERS LLC" to fast track the process.`,
          },
          {
            id: "agreements",
            title: "Sending Agreements",
            loomId: loomId(
              "https://www.loom.com/share/d675207348d34fc2a18719521de50a33?sid=a3b28beb-f074-4b8a-8fff-86fb36d2bd92",
            ),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: "",
          },
        ],
      },
    ],
  },
  {
    id: "sales-training",
    title: "Sales Training",
    description: "Master the mindset and mechanics of selling tax advisory.",
    sections: [
      {
        id: "mindset",
        title: "Sales: Mindset",
        subsections: [
          {
            id: "archaic-beliefs",
            title: "Destroying Your Archaic Beliefs",
            loomId: loomId("https://www.loom.com/share/d75458c5f3df414881e0e2cb6a24df4c"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `Selling Tax Advisory: The Mindset Shift Every Tax Professional Must Make

You're Not in the Tax Business

The first thing you have to understand is this: You are not in the business of selling tax strategies. You're in the business of helping business owners build more wealth.

Most accountants believe people hire them because they know the tax code. That's only partially true. People don't invest thousands—or tens of thousands—of dollars because someone understands IRS regulations. They invest because they believe their life or business will be better after working with you.

The tax strategy is simply the vehicle. The destination is what they're buying.`,
          },
          {
            id: "doctor-frame",
            title: "Doctor's Frame",
            loomId: loomId("https://www.loom.com/share/37028b5d7ee34ce0bc9e0c7a244acf0a"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `The Doctor's Frame: How Elite Tax Advisors Build Trust, Ask Better Questions, and Lead Conversations

The biggest misconception in sales is that the person with the best presentation wins. They don't. The person who understands the prospect better than anyone else wins.

That's why the best tax advisors don't sound like salespeople. They sound like trusted professionals. Think about the last time you visited a doctor, attorney, or financial advisor you respected. They weren't rushing. They weren't talking over you. They weren't trying to impress you. They were calm. Confident. Curious. Intentional.`,
          },
        ],
      },
      {
        id: "sales-101",
        title: "Sales 101",
        subsections: [
          {
            id: "seven-beliefs",
            title: "The Seven Beliefs Every Business Owner Must Have to Buy",
            loomId: loomId("https://www.loom.com/share/ab40f65f6eb147e8a7f5240a5193384f"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `The Seven Beliefs Every Business Owner Must Have Before They'll Invest in Tax Advisory

One of the biggest mistakes tax advisors make is believing that people buy because they heard a good presentation. They don't. People buy because they believe.

Every buying decision is simply the result of a series of beliefs becoming true. If even one critical belief is missing, the prospect hesitates.

The Belief Ladder: Think of every sales conversation as climbing a ladder. You can't skip steps. If someone doesn't believe they have a problem, they won't care about your solution.`,
          },
          {
            id: "control-conversation",
            title: "Control the Conversation",
            loomId: loomId("https://www.loom.com/share/c782ed8ebf244d21bc8c63e39f5f2f7d"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `How Elite Tax Advisors Control the Conversation

Great sales conversations aren't about talking more. They're about leading better. The best tax advisors don't sound like salespeople—they sound like trusted professionals. Every question, every pause, and every response has a purpose.

Use the Power of Silence: One of the biggest mistakes advisors make is talking too much. Ask your question, then stop. Give the prospect time to think.`,
          },
          {
            id: "chunking-down",
            title: "Chunking Down (Reflex Selling)",
            loomId: loomId("https://www.loom.com/share/551ac771d1b34fc6826f1b82b8718a9d"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `Building Trust Through Empathy and Understanding

People don't buy because you have the best solution. They buy because they trust you. Before a business owner invests in your firm, they need to feel like you truly understand their business, their challenges, and where they want to go.

Your job isn't to impress them. Your job is to understand them.`,
          },
          {
            id: "discovery",
            title: "Proper Discovery",
            loomId: loomId("https://www.loom.com/share/bea5565c35f34f60b1cfefd04a88951c"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `The Tax Advisory Discovery Framework

The quality of your discovery determines the quality of your close. Your goal isn't to ask every question on a checklist. Your goal is to fully understand the prospect's business, uncover the real problem, and help them realize why solving it matters.

Think like a doctor. Diagnose first. Prescribe second.`,
          },
          {
            id: "commitment",
            title: "Committing Phase",
            loomId: loomId("https://www.loom.com/share/d8244b649066442ca7577d620aa4f826"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `The Commitment Phase

The commitment phase begins after you've presented your recommendation and before discussing the investment. At this point, the business owner should understand their current problem, what's causing it, what it's costing them, and how your process helps them get there.

Your job now is to increase certainty—not increase pressure.`,
          },
          {
            id: "pitching",
            title: "Pitching",
            loomId: loomId("https://www.loom.com/share/3533c9e73fe8461da075c064d5802d18"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `One of the biggest mistakes tax advisors make is presenting their solution too early. The moment a prospect tells them they're paying too much in taxes or aren't getting proactive advice, they immediately start explaining their services.

Don't.

Instead, pause. Acknowledge what they've shared. Then transition naturally.`,
          },
          {
            id: "4-step",
            title: "Stupid Simple 4 Step Sales Process",
            loomId: loomId("https://www.loom.com/share/c9e05d18065b42d58db73b8b144a68ff"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `Our Stupid Simple 4-Step Sales Process

Every successful sales call follows the same four steps. It doesn't matter how much experience you have or how many calls you've taken.

Step 1: Find the Pain
Step 2: Understand the Pain
Step 3: Connect the Pain to Their Goals
Step 4: Show Them How We Help`,
          },
        ],
      },
      {
        id: "objections",
        title: "Objection Handling",
        subsections: [
          {
            id: "framework",
            title: "Objection Handling Framework",
            loomId: loomId("https://www.loom.com/share/21474fd715d34813bc9bb3903189dacb"),
            checkboxes: [{ id: "watched", label: "Watched" }],
            content: `Objection Mastery

One of the biggest misconceptions in sales is that great closers are great at handling objections. They're not. Great advisors are great at preventing objections before they ever happen.

Almost every objection can be traced back to something that wasn't uncovered, addressed, or built during discovery. If you thoroughly diagnose the problem, build trust, create urgency, and establish value, objections become much smaller.

Think of objections as missing beliefs—not reasons someone can't buy.`,
          },
        ],
      },
    ],
  },
];

export async function seedCourses(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const [courseIndex, course] of SEED_COURSES.entries()) {
      const existing = await client.query("SELECT id FROM courses WHERE slug = $1", [course.id]);
      if (existing.rows.length > 0) {
        console.log(`Skipping ${course.id} — already seeded`);
        continue;
      }

      const courseResult = await client.query(
        "INSERT INTO courses (slug, title, description, display_order) VALUES ($1, $2, $3, $4) RETURNING id",
        [course.id, course.title, course.description, courseIndex],
      );
      const courseId = courseResult.rows[0].id;

      for (const [sectionIndex, section] of course.sections.entries()) {
        const sectionResult = await client.query(
          "INSERT INTO course_sections (course_id, title, display_order) VALUES ($1, $2, $3) RETURNING id",
          [courseId, section.title, sectionIndex],
        );
        const sectionId = sectionResult.rows[0].id;

        for (const [subsectionIndex, subsection] of section.subsections.entries()) {
          const subsectionResult = await client.query(
            `INSERT INTO course_subsections (section_id, title, loom_id, content, display_order)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              sectionId,
              subsection.title,
              subsection.loomId || null,
              subsection.content,
              subsectionIndex,
            ],
          );
          const subsectionId = subsectionResult.rows[0].id;

          for (const [checkboxIndex, checkbox] of subsection.checkboxes.entries()) {
            await client.query(
              "INSERT INTO course_checkboxes (subsection_id, label, display_order) VALUES ($1, $2, $3)",
              [subsectionId, checkbox.label, checkboxIndex],
            );
          }
        }
      }

      console.log(`Seeded ${course.id}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
