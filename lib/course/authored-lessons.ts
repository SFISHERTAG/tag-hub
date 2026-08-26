/**
 * Story 12.5: the CSM lessons that have no Skool source.
 *
 * `assets/tag-skool-update-outline.pdf` asks for five lessons that do not
 * exist in the classroom — checked against the live course tree, which returns
 * 23 published lessons and none of them. Their source material is the
 * operating manual, the hub tools SOPs and the branded intake form, all in
 * `assets/`. This file writes them.
 *
 * Everything here is authored from those documents and cites the section it
 * came from, so a reader can check the lesson against the standard rather than
 * trusting it. Nothing is invented: where a source is missing, the lesson says
 * so rather than filling the gap with plausible text — see FULFILLMENT_INTRO.
 *
 * No credential appears in any lesson here. The two that need one point at the
 * placeholder story 12.4 established.
 */

/** A lesson that already exists and gains authored text. */
export type LessonEdit = {
  kind: "edit";
  /** Matched on title within the course. */
  matchTitle: string;
  /** Replaces the body outright. */
  content: string;
};

/** A lesson that does not exist yet. */
export type LessonInsert = {
  kind: "insert";
  title: string;
  /** Inserted immediately before this lesson. Appended if it is not found. */
  before: string;
  checkboxes: string[];
  content: string;
};

export type AuthoredChange = LessonEdit | LessonInsert;

const WATCHED = ["Watched"];

const FULFILLMENT_INTRO: LessonInsert = {
  kind: "insert",
  title: "Fulfillment Intro",
  before: "Understanding Activation Points",
  checkboxes: WATCHED,
  // The outline sources this from "Ops Design Doc §3", which is not in this
  // repo. Rather than invent a pipeline, this is written from the manual's own
  // map (§00.1) and the hub tools SOPs, and it says plainly which parts are
  // target-state. Replace with the real architecture walk when that doc lands.
  content: `Start here. This is the map every other lesson hangs off.

WHAT THIS COURSE COVERS

Taking a Client from signed to launched, and then reading performance once ads are live. The CSM Operating Manual is the reference you keep open while you work; this course is the walkthrough.

The manual splits into three parts:

Part A, sections 01 to 04. The strategy. What we actually sell, how an offer gets repositioned from compliance to advisory, the economics, and which funnel model fits a given Client. You use this during onboarding and on Client strategy calls.

Part B, sections 05 to 11. The build. Assets, funnel, pixel, campaign, automations, qualification logic. You use this on every launch.

Part C, sections 12 to 13. Reading performance and deciding the next move. Days one to three after launch, then ongoing.

THE STAGES

1. Signed. The deal closes and the account lands with a CSM.

2. Onboarding call. The Client fills the intake form themselves, in the waiting room, during the call. Not sent ahead, not dictated question by question. The EIN is requested in the same message, because A2P registration cannot start without it.

3. Assets. Creative is sourced or filmed, copy is written against the intake form, video is uploaded to Wistia to the standard in this course.

4. Build. Funnel, pixel, campaign settings, reminder automations.

5. Launch review, then live. Target ads-live before the first of the month where you can.

6. Optimize. Days one to three are about cost per call and whether the callout is landing, not about closes.

THE THREE GATES THAT ARE YOURS

Three points in that sequence are a CSM's judgement, not a checklist:

Intake quality. A thin intake produces a thin script. If the answers are one-liners, go back for detail before anything gets written. Every downstream asset is modeled on this document.

Compliance review. Guarantee language on a tax-savings claim is a licensure question for the Client, not a Meta question. Section 09.6, and the Complete Tax Offer Structure lesson in this course.

Launch review. Settings discipline is what separates a launch that works from one that burns budget. The build is three minutes; the settings are the job.

WHAT IS AUTOMATED TODAY

Almost none of it. The pipeline above is what a CSM does by hand, with the Hub providing the tracking and the manual providing the standard. Where a step is target-state rather than current practice, this course says so in the lesson itself. Treat anything described as automated as something to verify before you rely on it.

Source: CSM Operating Manual §00.1, and the Onboarding & A2P tool in Hub Tools. The full fulfillment architecture diagram lives in the Ops Design Doc, which is not yet in the Hub; this lesson will be replaced by that walkthrough when it is.`,
};

const INTAKE_WALKTHROUGH: LessonInsert = {
  kind: "insert",
  title: "Client Intake Form Walkthrough",
  before: "Understanding Activation Points",
  checkboxes: WATCHED,
  content: `Every other input to the pipeline has a lesson. The first thing a Client ever gives us did not, until this one.

WHY THIS MATTERS MORE THAN IT LOOKS

The intake form is the source document for the VSL, the ads, the pre-call video and the qualification logic. The AI modeling prompt in "Using AI for Scripts and Assets" takes the entire completed form as its input. A thin intake produces a thin script, and no amount of media buying fixes copy written against three-word answers.

HOW IT IS RUN

Hand the form to the Client to complete themselves, in the waiting room, during the onboarding call. It is not sent ahead of time and it is not dictated question by question. You are there to answer questions, not to fill it in for them.

The form lives in the Hub under Tools, in the Operating Hub, as a fillable nine-section document.

THE NINE SECTIONS

1. Firm Information. Owner and primary contact, firm name, website, primary service offering, email, preferred contact method, phone, headquarters, years in business, current annual revenue.

2. Program Details Confirmation. Terms of Service agreed, and the four-month engagement term confirmed.

3. Advertising & Marketing Setup. Have they run Facebook ads before, do they have a Business Manager, do they have existing video or visual assets, are they comfortable recording, do they acknowledge the service expectations and the refund eligibility conditions.

4. Next Steps. Initial payment submitted, onboarding call scheduled, ad account access provided or a walkthrough booked, availability confirmed.

5. Tax Advisory Offer. The offer in detail, the specific outcomes clients achieve, the process start to finish, what makes it different from every other CPA or EA, whether there is a guarantee or risk reversal, and the average investment broken into assessment, plan, implementation and ongoing advisory fees.

6. Ideal Client. Who produces the best results, which industries and profiles, what revenue or tax burden a prospect needs, and the common characteristics of their best clients.

7. Pain Points & Motivation. The biggest problem the ideal client faces beforehand, what keeps them up at night, why clients ultimately hire them, and the mistakes prospects make first.

8. Results & Proof. Three best client stories, each with client type, original problem, strategies implemented, savings achieved and final outcome. Plus testimonials, case studies or screenshots, and the largest result the firm has ever produced.

9. Competition & Positioning. Biggest competitors, why a prospect should choose this firm, and anything else that helps position the offer.

WHICH ANSWERS FEED THE SCRIPT

Sections 5 through 9 are the ones the modeling prompt leans on hardest. The offer detail and the guarantee become the headline. The ideal client answers become the callout, which is also doing the targeting work, see "Ad Copy & Callout Standards". The pain points become the opening. The proof section becomes the credibility block.

If section 8 comes back empty, say so before the build starts. Copy with no proof in it is a known-weak asset, not a surprise to discover after launch.

WHAT TO CHASE

The EIN is not on this form and is not captured on the sales call. Request it in the same message you send the form. A2P registration cannot proceed without it, and it is the single most common reason an account stalls.

Source: the branded Client Intake Form, and CSM Operating Manual §06.`,
};

const AI_SCRIPTS: LessonInsert = {
  kind: "insert",
  title: "Using AI for Scripts and Assets",
  before: "Ad Copy & Callout Standards",
  checkboxes: WATCHED,
  content: `How copy actually gets written here. This is a modeling process, not a "write me an ad" process.

ONE ASSET AT A TIME

Script each asset as a separate prompt in a separate pass. Batching the VSL, the ad and the pre-call into one request reliably produces worse output: the structure flattens and the result needs more rework than the time you saved.

THE MODELING PROMPT

1. Copy the entire completed intake form.

2. Paste it into ChatGPT with: "Rewrite this, modeling the exact structure of the text I am about to send you."

3. Wait for it to confirm, then send the proven template for that asset type.

4. Iterate: feed in the unique mechanism, tighten the callout, make it more assertive, name the specific audience.

This works because the output is modeled on a structure already proven in market, rather than generated from scratch. The template is doing the heavy lifting; the intake form is supplying the specifics.

THE HEADLINE PATTERN

Three components:

An attention statement naming a specific audience.

The guarantee.

An aggressive offer paired with an aggressive guarantee.

If ChatGPT drifts off the pattern, give it a direct example in that format rather than describing what you want. Showing beats explaining.

BEFORE IT GOES IN THE BUILDER

Copy is ready when it names a specific audience, states the guarantee, and reflects the Client's approved unique mechanism.

Two checks that save a rebuild:

Copy written against an unconverted offer will underperform no matter how good the media buying is. If the offer is still compliance-shaped rather than advisory-shaped, fix that first.

Any guarantee naming a specific tax-savings percentage or dollar figure needs the Client's written sign-off before it ships. See the compliance segment in "Complete Tax Offer Structure".

Source: CSM Operating Manual §06.1 to §06.3.`,
};

const PIXEL_LESSON: LessonInsert = {
  kind: "insert",
  title: "Pixel Install and Ad Account Access",
  before: "Ad Launching",
  checkboxes: WATCHED,
  content: `The two settings in this lesson fail silently. Nothing errors, nothing turns red, the campaign just never optimises and you find out days later.

TRAP ONE: WHERE THE DATA SET IS CREATED

Create the data set from inside the ad account. Not from Events Manager. Not from Business Settings.

Created anywhere else, it will not appear correctly as a selectable option in the campaign, and there is no message telling you why.

CREATE THE DATA SET

1. In Ads Manager at ad set level, under Data Set, choose Create Data Set.

2. Name it after the Client's company. Keep it simple.

3. Select Meta Pixel only. Not Conversions API.

4. Choose Install code manually, then copy the code.

TRAP TWO: WHERE THE CODE GOES

In GoHighLevel: Funnel → Settings.

Paste into Head Tracking Code. Not Body Tracking Code.

This is the silent failure that costs days. Scroll to the bottom, save, and allow a minute to propagate.

MAP THE CONVERSION EVENT

1. Back in Events Manager, hit Continue. Leave the toggle Meta offers off.

2. Add Events, paste the full VSL page URL, continue. Meta loads the live page.

3. Use Track Button, not URL tracking. Click the schedule button on the loaded page.

4. Map it to the standard event Schedule. Confirm.

5. Finish setup → Finish → Skip → Done.

VERIFY BEFORE YOU SPEND

1. Return to Ads Manager and refresh. The data set should now be selectable.

2. Set the conversion event to Schedule. It will show "no data", which is expected on a fresh pixel.

3. Run a test booking through the live funnel and confirm the event fires in Test Events.

4. Use the standard TAG test record. Never personal contact details.

If events do not appear: re-copy the pixel code, delete the old code from Head Tracking, paste fresh, save, retest. Propagation delay is common. Wait a minute before assuming failure.

AD ACCOUNT ACCESS

Operate everything from the support Chrome profile, never a personal one. For Meta specifically, switching device, browser or state mid-session reads as an intrusion and can get the ad account banned. Never disable 2FA.

Every ad account needs a Facebook Page to run from. Confirm one exists, and tell the Client explicitly to upload their logo to it, or they will run ads with no profile picture.

Source: CSM Operating Manual §08, and the Access & Security tool in Hub Tools.`,
};

const AD_COPY: LessonEdit = {
  kind: "edit",
  matchTitle: "Ad Copy & Callout Standards",
  content: `The callout is the targeting. That is the whole lesson.

AD COPY STRUCTURE

1. Callout, naming the exact person. "Business owners earning $500K+ only."

2. Offer and guarantee, the outcome plus the risk reversal.

3. CTA. "Click the link below to book your strategy call."

WHY THE CALLOUT DOES THE TARGETING

Detailed targeting is left open on purpose. That means the copy is the primary signal telling Meta who should see this ad. It is why we test the callout and leave the targeting alone.

BE SPECIFIC, NOT GENERIC

"High income attorneys" is weak.

"Attorneys making over $400,000 a year" is a callout.

The more specific the income or role qualifier in the copy, the tighter the audience Meta delivers to. Vague callouts pull in browsers. Specific ones pull in the Client's actual buyer.

BENCHMARKS

B2C: under $80 is a good CPC.

B2B: under $250 is a good CPC.

BEFORE PUBLISH

A guarantee naming a specific tax-savings percentage or dollar figure does not ship without the Client's written sign-off. See "Complete Tax Offer Structure".

Facebook login: ask your account manager, or check the shared credentials in Slack.

Source: CSM Operating Manual §09.4.`,
};

const TAX_OFFER_COMPLIANCE: LessonEdit = {
  kind: "edit",
  matchTitle: "Complete Tax Offer Structure",
  content: `Watch the video for the offer structure itself.

COMPLIANCE PASS REQUIRED BEFORE PUBLISH

This section is not a footnote. Read it before you write or approve a single guarantee.

Source material for this offer includes a guarantee promising to reduce tax liability by a specific large percentage, or a refund. That carries two risks, and they are not the same size.

The first is Meta rejecting the ad. That is recoverable. You rewrite and resubmit.

The second is not recoverable by us. Our Clients are licensed accountants and CPAs, governed by IRS Circular 230, state board advertising rules, and AICPA conduct standards. An ad guaranteeing a specific tax outcome can create licensure exposure for the Client. That is a far worse failure than a rejected ad, and it lands on them, not on us.

THE STANDARD

No specific percentage or dollar tax-savings guarantee ships without written sign-off from the Client's licensed practitioner.

Guarantee the process and the engagement. Not the number.

WHAT THIS LOOKS LIKE IN PRACTICE

If the Client wants a number in the copy, that is a conversation to have with them directly, with their sign-off in writing before it goes anywhere near the builder. If they decline to sign off, the number does not run. There is no version of this where we ship it because the ad performs better with it.

Source: CSM Operating Manual §09.6 and its Open Items section.`,
};

const WISTIA: LessonEdit = {
  kind: "edit",
  matchTitle: "Wistia Training",
  content: `Applies to every Client video — VSL, ad, pre-call — uploaded to Wistia before it gets embedded in the funnel.

This is a non-negotiable standard, not a suggestion. A sloppy Wistia account is the one thing leadership will personally go back and fix.

THE CHECKLIST

1. Naming. Label the video with the Client's business name. Never a generic label like "call" or "VSL". This is what keeps the shared account navigable as the Client list grows.

2. Colour code. Appearances, set the player colour to the team standard: #ebc507. We pay for Wistia specifically to get branded, trackable players. An unbranded default-blue player defeats the point of the paid account.

3. Thumbnail. Actually pick one. Not a black frame, not a frame that is just floating text. Pick something presentable at a glance.

4. Controls, turn ON: Auto Play, Play with Sound, Big Play Button, Full Screen.

5. Controls, turn OFF: Control Bar, Play Bar, Captions, Settings.

WHY CAPTIONS IS OFF

The editor already burns captions into the creative. Leaving Wistia's native captions on stacks a second, unstyled caption layer on top. Turn it off every time.

IF THE SAVE DOES NOT FIRE

The save confirmation sometimes does not appear. Go back to the thumbnail step and reselect it. That reliably triggers the save.

Wistia login: ask your account manager, or check the shared credentials in Slack.

Source: CSM Operating Manual §06.4.`,
};

const A2P: LessonEdit = {
  kind: "edit",
  matchTitle: "A2P",
  content: `A2P 10DLC carrier registration. Without it, SMS does not deliver, and a text-only reminder sequence fails silently: the Client sees no-shows and no explanation.

A note on the name. The founder calls this "HTTP" in the recordings. The actual item is A2P 10DLC carrier registration. Search that term, not the other one.

THE THING THAT BLOCKS MOST ACCOUNTS

A2P verification requires the chat widget installed on the VSL page. It will not verify without a live page carrying the widget.

That means you do not have to wait for the real VSL. If it is not ready, put the old or a placeholder VSL on the page purely so the widget has a home, get the registration moving, and swap the real one in after verification clears.

THE SEQUENCE

1. Confirm you have the EIN and the business address. Both are mandatory. The EIN is not captured on the sales call, so request it the same day you hand over the intake form and flag that A2P cannot proceed without it.

2. If the real VSL is not ready, put a placeholder page up so the chat widget has a home.

3. Add the chat widget to the VSL page.

4. Submit the A2P registration in GoHighLevel.

5. After verification clears, swap the placeholder for the final VSL.

TIMING

Submissions made over a weekend are not reviewed until the following business day. Batch A2P submissions to start the week so approvals land sooner.

COMMON FAILURES

The Client sends a phone number instead of an EIN. Restate that the EIN specifically is required and that A2P is blocked without it.

Rejected with no widget. Install the widget and resubmit.

The Client pushes to launch while withholding the EIN. Hold the line. Ads cannot launch on an unverified number. Document the date you asked.

WHY BOTH CHANNELS, ALWAYS

Because registration can be pending, every reminder goes out as SMS and email. If A2P is not approved, SMS silently does not deliver, and the email duplication is what keeps reminder coverage working on day one regardless.

Source: the Onboarding & A2P tool in Hub Tools, and CSM Operating Manual §10.1.`,
};

const REMINDERS: LessonEdit = {
  kind: "edit",
  matchTitle: "Reminders",
  content: `Built in GoHighLevel Workflows. Reduces no-shows, which directly protects cost per held call.

THE CONFIGURATION

Trigger: Customer Booked Appointment. No extra trigger filters beyond the calendar itself.

Filter: Calendar equals the specific strategy session calendar.

First action: add tag "reminders".

Wait step type: Until Scheduled Time → Appointment Time → X hours before, with "Skip all outbound communications until the next one" selected.

Cadence: 12h, 6h, 3h, 1h before.

Channels: SMS and email at every interval.

Email from: the Client's own address, verified and added to their GoHighLevel staff list first.

Signature: "[Company] Team".

BUILD ORDER

1. Name the calendar after the Client's business, never the personal calendar GoHighLevel creates by default. For example, "[Firm Name] Tax Strategy Assessment Call". Add the Client's logo to it — small effort, visibly raises perceived quality.

2. Name the workflow after the Client too.

3. Build the immediate confirmation: SMS action first, then the email action directly beneath it in the same step. No wait step before these.

4. Then the wait-then-send pattern for each interval: 12h, 6h, 3h, 1h.

CUSTOM VALUES

Contact → Full Name

Appointment → Start Date and Time

Appointment → Meeting Location

Paste operations frequently drop or mangle these tokens. Re-insert them from the Custom Values menu rather than typing them, and read every message back before you enable the workflow.

THE MESSAGE COPY

The exact templates are in the lesson body below the video and should be pasted verbatim so every CSM builds the identical workflow rather than writing their own reminder text.

SMS, immediate:

Hey {{contact.name}}, It's [Company Name]. Thanks for booking a time to speak with us; your call is at {{appointment.start_time}} Meeting Link: {{appointment.meeting_location}} Please reply back with "YES" to confirm you'll show up.

Email, immediate: the same message, subject line "Important message from [Company Name]".

12 hours before: the same confirmation copy.

6 hours before:

Hey {{contact.name}} just another friendly reminder of our call coming up soon in the next 6 hours. Here's the meeting link just to make it easier! {{appointment.meeting_location}}

3 hours before:

Hey {{contact.name}} Just sending the link again just incase you missed it. {{appointment.meeting_location}}

1 hour before:

Hey {{contact.name}} I'm hopping on in an hour. Here is the link below! {{appointment.meeting_location}}

Source: CSM Operating Manual §10.1 and §10.2.`,
};

/**
 * Applied in order. Inserts are positioned relative to lessons that already
 * exist, so the two new lessons at the top land in the order listed here:
 * Fulfillment Intro first, then the intake walkthrough.
 */
export const AUTHORED_CHANGES: readonly AuthoredChange[] = [
  FULFILLMENT_INTRO,
  INTAKE_WALKTHROUGH,
  AI_SCRIPTS,
  PIXEL_LESSON,
  AD_COPY,
  TAX_OFFER_COMPLIANCE,
  WISTIA,
  A2P,
  REMINDERS,
];

export const AUTHORED_COURSE_SLUG = "csm-training";
