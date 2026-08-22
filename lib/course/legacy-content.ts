import { COURSE_AUDIENCES } from "./visibility";
import type { VideoProvider } from "./types";

/**
 * The two Skool trainings that were never entered into the Hub.
 *
 * Content is verbatim from a live crawl of the `thedealclosers` classrooms on
 * 2026-08-21, not from the earlier hand-paraphrase pass and not from the
 * companion handoff file, whose video-to-lesson map was shifted across four
 * lessons.
 *
 * The CSM course is written here in its POST-CONSOLIDATION shape, per
 * `assets/tag-skool-update-outline.pdf` and Sam's call on 2026-08-21: the three
 * funnel-build lessons are one lesson carrying three videos, and ADS becomes
 * "Ad Copy & Callout Standards". That is why this file has 13 CSM lessons where
 * Skool currently shows 15.
 *
 * Lesson titles are written properly rather than copied from Skool's casing:
 * "MUST WATCH" and "REMINDERS" are shouted there and "AD Launching" is a typo.
 * Acronyms stay as acronyms (A2P, TAG, ACH).
 *
 * TWO LESSONS ARE DELIBERATELY INCOMPLETE HERE. The live Wistia and ADS lessons
 * carry plaintext passwords in their body text. Sam's decision is that they stay
 * in the lesson for now, but a password committed to this repo is a different
 * thing from a password in a database row: it lands in git history, survives
 * deletion, and the pre-commit secret check exists to stop exactly that. Both
 * carry a pointer instead, and the real value is typed into the admin editor
 * after import. See `CREDENTIAL_PLACEHOLDER`.
 */

export type LegacyVideo = {
  provider: VideoProvider;
  externalId: string;
  label?: string;
};

export type LegacyDoc = { label: string; url: string };

export type LegacyLesson = {
  title: string;
  /** Preferred over `loomId`: everything imported here writes video rows. */
  videos: LegacyVideo[];
  docs: LegacyDoc[];
  checkboxes: string[];
  content: string;
  /** Empty means the course's own audience decides. */
  visibleToRoles?: readonly string[];
};

export type LegacyCourse = {
  slug: string;
  title: string;
  description: string;
  visibleToRoles: readonly string[];
  sections: { title: string; lessons: LegacyLesson[] }[];
};

/** What a lesson says where a live credential used to be. */
export const CREDENTIAL_PLACEHOLDER =
  "Login: ask your account manager, or check the shared credentials in Slack.";

const WATCHED = ["Watched"];

const CSM_TRAINING: LegacyCourse = {
  slug: "csm-training",
  title: "CSM Training",
  description: "Client success onboarding, tools, and internal process training.",
  visibleToRoles: COURSE_AUDIENCES.CSM,
  sections: [
    {
      title: "CSM Training",
      lessons: [
        {
          title: "Understanding Activation Points",
          videos: [{ provider: "loom", externalId: "b8632a6529fa404eb5907c41bf6947ee" }],
          docs: [],
          checkboxes: WATCHED,
          // No body text and no linked sheet on the live page, contrary to the
          // handoff. Confirmed twice, once after a full render.
          content: "",
        },
        {
          title: "Must Watch",
          videos: [{ provider: "loom", externalId: "afd7384d02ed4cb29e635e2a7819dfa7" }],
          docs: [],
          checkboxes: WATCHED,
          content: `The Complete System: How We Actually Get Clients Results

What we provide is not "ads" or a "funnel."

We provide a client acquisition system built for how the market buys today — skeptical, informed, and outcome-driven.

Our job is to:

Engineer the right offer

Crack the messaging

Build the funnel

Optimize until a winner is found

Scale once the math works

When that happens, results don't grow linearly — they compound fast.

Step One: Fixing the Offer (The Most Important Part)

Coaching Is No Longer Enough

The old model of selling coaching and information is largely dead.

Why?

The market is oversaturated

Buyers have been burned before

Skepticism is at an all-time high

Information is everywhere

Selling coaching today requires:

A strong personal brand

Massive trust upfront

Long nurturing cycles

Most people don't have that — and don't need it.

We Convert Coaching Into a Service

Our number one priority is converting your offer from:

Information-based coaching
to
Outcome-based service

We don't sell how to get results.
We sell the results themselves.

This changes everything:

You take on the execution risk

The offer feels safer

Decisions become easier

Price resistance drops

You stand out immediately

You're no longer competing with coaches — you're positioned above them.

Sell the Transformation, Not the Information

People don't buy frameworks.
They buy outcomes.

Example:
Instead of:

"A course that teaches you how to make money with Shopify"

You sell:

"A done-for-you Shopify setup where we build, configure, and launch your store so you can focus on running it."

Same end result.
Different packaging.
Higher perceived value.
Faster client results.
Higher profit margins.

Marketing is the difference — not the service itself.

Why Services Close Without a Big Brand

Service-based offers:

Don't require blind trust

Provide tangible deliverables

Remove execution friction

Shift risk off the buyer

Trust is built through:

Clear process

Defined outcomes

Strong positioning

Risk reversal

Not personal branding or social proof alone.

This is why services:

Convert colder traffic

Support higher ad spend

Scale faster

High Ticket, CAC, and ROAS (The Math That Makes This Work)

CAC: Cost of Acquiring a Client

CAC is simply:

How much you spend in ads to acquire one paying client.

Example:

Ad spend: $2,000

Client value: $10,000

CAC: $2,000

You didn't "lose" $2k.
You deployed $2k to buy $10k.

That leaves:

$8k gross profit (before fulfillment)

ROAS: Return on Ad Spend

ROAS answers one question:

For every dollar spent, how much comes back?

Using the same example:

$2k spend → $10k revenue

ROAS = 5x

If the math works, the question becomes:

"How many times can I repeat this?"

And the answer should be:

As many times as the business can handle.

That's scaling.

Why High-Ticket Offers Win With Ads

Ads have fixed costs.
Low-ticket offers break under pressure.

High-ticket offers:

Absorb CAC

Allow aggressive testing

Enable faster scaling

Outbid competitors

Increase net profit

Scared money doesn't make money — but smart money follows math.

Once CAC and ROAS are known:

Spend becomes predictable

Risk becomes calculated

Growth becomes logical

Ads stop feeling risky and start feeling like leverage.

Financing Multiplies Conversions

We also help you connect financing options for your clients.

This:

Lowers friction

Increases close rates

Makes high-ticket offers accessible

Improves cash flow

Clients say yes based on monthly affordability, not total price.

Step Two: Messaging Is the Bottleneck (And We Own It)

Early performance is about discovery, not scale.

Our team:

Tests angles and hooks

Refines positioning

Sharpens promises

Identifies objections

Lets data decide

Most funnels don't fail because of traffic.
They fail because the message isn't right yet.

Our job is to crack it.

Step Three: The Direct Call Funnel (3 Proven Variations)

We deploy one of three funnel models depending on your offer, price point, and team.

1. Direct Application → Call Booking

Best for:

High-ticket offers

Owner-led sales

Lower volume, higher quality

Flow:
Ads → VSL → Application → Booked call

This prioritizes:

Intent

Efficiency

Qualified conversations

2. Application + Setter Follow-Up

Best for:

Higher lead volume

Missed bookings

Growing sales teams

Flow:

Ads → VSL → Application

Setter calls non-booked leads

Setter qualifies and books calls

This:

Increases booking rate

Improves ROAS

Maximizes ad spend

3. Live Transfer Funnel (Hot Hand-Off)

Best for:

Aggressive scaling

Speed-sensitive offers

High daily ad spend

Flow:

Lead opts in

Setter immediately calls

Qualifies in real time

Live transfer into Zoom or Google Meet

You or your rep closes while intent is highest

Speed equals money.

How This All Comes Together

We:

Fix the offer

Reposition you as a service

Engineer the funnel

Crack the messaging

Track CAC and ROAS

Scale what works

Once the winning message is found, sales accelerate quickly because the system is already built.

Final Anchor Statement

"We don't sell coaching. We sell outcomes. Once the message and math work, scaling is simply a matter of repetition."

Processors to recommend to clients that have financing

Fanbasis

Whop

Stripe

Square

Quikbooks

Elective

Eaze Consulting`,
        },
        {
          title: "Complete Tax Offer Structure",
          videos: [{ provider: "loom", externalId: "d752a838099c4d2d95f1d447bdd92d30" }],
          docs: [],
          checkboxes: WATCHED,
          // Video only live. The Circular 230 compliance segment the course
          // update outline calls for is authored in story 12.5.
          content: "",
        },
        {
          title: "Qualification Questions",
          videos: [{ provider: "loom", externalId: "096b3cbfe4694affa3ab84f8ef4366be" }],
          docs: [],
          checkboxes: WATCHED,
          content: `THESE SHOULD ALL BE REQUIRED!

Full Name *

Phone *

Business Website *

Approximately How Much Did You Pay In Taxes Last Year? *

Less Than $100K( Not A Fit )

$100k-$500k

$500k-$1M

1M+

Why Are You Looking For A Tax Strategy Right Now?( Please Be Detailed) *( Multi line)

If We Determine We're A Good Fit And Can Show You How To Legally Reduce Your Tax Liability, Are You Prepared To Invest In A Customized Tax Strategy? *

Yes, I'm Ready To Move Forward

No, I'm Not Ready To Invest At This Time`,
        },
        {
          title: "TAG Essentials",
          videos: [{ provider: "loom", externalId: "60ce97d7aad14d93b2fd79d1c49cded1" }],
          docs: [
            {
              label: "TAG Essentials template (Google Doc)",
              url: "https://docs.google.com/document/d/1R_6TNOrU6xz9Myc9Vm6cLV042DHsTe6ojqW-JOQc-fE/edit?usp=sharing",
            },
          ],
          checkboxes: WATCHED,
          content: `You Make A Copy For Clients Labeled With Their Name- Anyone with Like -Editor Access

Remember to Add This To The TAG Tracking`,
        },
        {
          title: "Ad Copy & Callout Standards",
          videos: [{ provider: "loom", externalId: "25b324307ef9485dad1c03b5d8a6f317" }],
          docs: [],
          checkboxes: WATCHED,
          // Merge of ADS and PROVEN ADS per the outline. PROVEN ADS does not
          // exist in Skool — checked, the classroom returns 23 published
          // lessons and none is it — so the callout-specificity half is
          // authored from Manual §09.4 in story 12.5. What survives from ADS
          // is its CPC benchmark and its video.
          content: `B2C UNDER 80 GOOD CPC

B2B UNDER 250 GOOD CPC

Facebook login: ${CREDENTIAL_PLACEHOLDER}`,
        },
        {
          title: "Ad Launching",
          videos: [{ provider: "loom", externalId: "439018a0bdd54af0acfca6ed76966b5d" }],
          docs: [],
          checkboxes: WATCHED,
          content: "",
        },
        {
          title: "Wistia Training",
          videos: [{ provider: "loom", externalId: "c6a6febf5e624960b2fc13d907d4e1c4" }],
          docs: [],
          checkboxes: WATCHED,
          content: `Color code

#ebc507

Wistia login: ${CREDENTIAL_PLACEHOLDER}`,
        },
        {
          title: "Call Recordings of First Call",
          videos: [
            { provider: "fathom", externalId: "xz2a6sFyhhzHZb3RJ269st9n6FA9vTXt" },
            { provider: "fathom", externalId: "AxigvFKCqZVEEv-hotZ8mPxdRjxqfL91" },
            { provider: "fathom", externalId: "cCsHPDbiP1xDhPXqcSrYdEmpgGzzHho9" },
            { provider: "fathom", externalId: "5gJGq41xkCFLGDMrrvLA6HzEoeFtS2XF" },
            { provider: "fathom", externalId: "14zjzi25KfUrnRYcquzsRyT4h1_33pFp" },
            { provider: "fathom", externalId: "QsBLaYt4mB2Nysyfy3rEJDiYjUxDFW4c" },
            { provider: "fathom", externalId: "-AWU7a5VzZgHsP41amxSJr_sXjGc8UzX" },
          ],
          docs: [],
          checkboxes: WATCHED,
          content: "",
        },
        {
          title: "A2P",
          videos: [{ provider: "loom", externalId: "e9ca12cab509477eb19741079bcbdb52" }],
          docs: [],
          checkboxes: WATCHED,
          // Video only live. The full SOP sequence and its two silent-failure
          // traps are authored in story 12.5.
          content: "",
        },
        {
          title: "Building a Client Funnel (Standard Build)",
          // The merge the outline calls for. The DJ lesson has no embedded
          // video — its recording is a resource link — and the two Austyn
          // lessons carry one each. Ordered DJ first: the outline names it the
          // base because it is the complete end-to-end walkthrough.
          videos: [
            {
              provider: "loom",
              externalId: "c93aae97f09e44eea82891ce5ee6c0ae",
              label: "Funnel build, end to end (DJ)",
            },
            {
              provider: "loom",
              externalId: "530d713b269747f188455aef0de0d94c",
              label: "Client funnel build, part 1 (Austyn)",
            },
            {
              provider: "loom",
              externalId: "a9bf78a043d8477abc34310939acc0a6",
              label: "Client funnel build, part 2 (Austyn)",
            },
          ],
          docs: [],
          checkboxes: WATCHED,
          // Mobile-sizing-before-clone and rename-before-edit come from
          // Manual §07.3-07.5 and are authored in story 12.5.
          content: "",
        },
        {
          title: "Reminders",
          videos: [{ provider: "loom", externalId: "2d5d277e958f4f60b0456e1853baa355" }],
          docs: [],
          checkboxes: WATCHED,
          content: `SMS IMMEDIATELY

(Hey {{contact.name}},

It's( Company Name) .

Thanks for booking a time to speak with us; your call is at  {{appointment.start_time}}

Meeting Link: {{appointment.meeting_location}}

Please reply back with "YES" to confirm you'll show up.

EMAIL IMMEDIATELY

Hey {{contact.name}},

It's Firm Outcomes.

Thanks for booking a time to speak with us; your call is at  {{appointment.start_time}}

Meeting Link: {{appointment.meeting_location}}

12 HOUR B4 APPOINTMENT

Hey {{contact.name}},

It's Firm Outcomes.

Thanks for booking a time to speak with us; your call is at  {{appointment.start_time}}

Meeting Link: {{appointment.meeting_location}}

6 HOUR B4 APPOINT

Hey {{contact.name}} just another friendly reminder of our call coming up soon in the next 6 hours. Here's the meeting link just to make it easier!

{{appointment.meeting_location}}

3HOURS B4 APPOINTMENT

Hey {{contact.name}} Just sending the link again just incase you missed it.

{{appointment.meeting_location}}

1 HOUR B4 APT

Hey {{contact.name}} I'm hopping on in an hour. Here is the link below!

{{appointment.meeting_location}}`,
        },
        {
          title: "Actor Training",
          videos: [{ provider: "loom", externalId: "9f4475d0b78448f8a277d92d97cea4bd" }],
          docs: [
            {
              label: "Actor Training doc (Google Doc)",
              url: "https://docs.google.com/document/d/1XY8yyTDzIdxEtQzP299NvWsTHY-54P5rbAYKg9HDBU0/edit?usp=sharing",
            },
          ],
          checkboxes: WATCHED,
          content: `Heres the doc link as well

We will bill them 700-1200$ for this and then submit the order on my account`,
        },
      ],
    },
  ],
};

/**
 * The 24 Fathom recordings on "Call Recording Links".
 *
 * Ids come from the companion handoff file; the live lesson was re-counted on
 * 2026-08-21 and holds exactly 24 Fathom and 11 Drive links, matching.
 */
const CALL_RECORDING_FATHOM: readonly string[] = [
  "ciGE6zcLehaVz6eVQzxJucxgsiDiGr6C",
  "rBH82rYDUEbxRpNpTXTrfXFyxnG9wsuG",
  "hQTQJox27fNJ6TMzq3UiKx4j3DiVfvfZ",
  "ZCsLMayG1HNUiGWskZUuFx_o1yXbAzq7",
  "ZhnpXsRA9ysaVJ7_FSEBj9BsQCJK1siT",
  "q_7AyDsJ-PYQ9VrjzzTY_Yvb8dVrApSF",
  "Nzp3mF-1Douc4uRrCJzfae5HqJjYh8LS",
  "KmKNNX5qc7CXXhj9RDrkWQt979vx-w-5",
  "6qYDZy-uk7d1doZ7yoZxL6dkzaZ6yKh-",
  "32vKKiYy7sxS4-HVmfX5LprLn9MCRdkH",
  "1tCTbWQC1dX3TXmbikM9nTzMj-zp1WZt",
  "LLCDrfQ1UbxbeRPJ4V36dSTKxF8SB8ji",
  "PRUktsPuizbyNDjAsnBsMJuPXxCoEvQL",
  "ykVgLWBPeM6RzisA2eSPgbLhKW3ghgzc",
  "1nRX5ghFgKjU7q3CtBiB-LP_DoBSsYxm",
  "uZkazdLk1xwc1_uCwjByGCYzxNQyykcD",
  "zKtztE45hWxfiSxbnA_CZi4KBBkCkkch",
  "nsP1pfCxNWPA43oU3susZtsupJfoCoa2",
  "WVciPbAz1oNcC1CGGMGDpyv7nM8CCNhk",
  "2Fd8SiAn47x9obwMTxHsJmmJ8WRc1zdb",
  "7tt5RrCusvRqbGggY2WB7-cG3es3iA5f",
  "P5x5PbqJLX9f-ysHuvmrBy1z5E5fBN-L",
  "ALaaMMYT5rEyVaL7x-RGdot-AE3pU5gP",
  "PBG5PU_48oH7F4M3-C-aG8AGgrXQcdL3",
];

/**
 * The 11 Drive recordings on the same lesson, with their dates.
 *
 * The source labels carry real prospect names — "Julia Hernandez | TDC
 * Strategy Session - 2026/04/22", and ten more. Per Sam on 2026-08-21 the
 * names are stripped and only the session date survives. Four of the eleven
 * had no label in the source at all and get none here.
 *
 * Stripping the label does not anonymise the recording: whoever opens it hears
 * the call. What it does is keep the names out of a table every sales rep can
 * read and out of any future export of it, which is the exposure that was
 * actually being decided.
 */
const CALL_RECORDING_DRIVE: readonly { id: string; date?: string }[] = [
  { id: "1AOUSyQO2BTK6k61e8zmlCWy91vmiGMbQ", date: "2026/04/22" },
  { id: "14SZ2ckJsfhKG3XWrLT2uJpbxEjneZtI3", date: "2026/03/20" },
  { id: "1WbgWXlX5GxPoFzeML-P7r_j40g5dWVbT", date: "2026/03/13" },
  { id: "1iNuQkYlkWj_4MJa3-smGWffWxxVxiDjk", date: "2026/03/05" },
  { id: "1O9hkGbM4xVSmlDOLesCzjyDaXAjHDqeK", date: "2026/03/03" },
  { id: "15Yc6uv8zzoMu3ldrYu6uJXIiOCQ4S7Jl", date: "2026/02/18" },
  { id: "16iUl0V-9abf7mX6W5B5T6cu3j6bvr6Yw", date: "2026/02/05" },
  { id: "1efKvz42TMmS0ZQk-0nLO6Tu6TAcBT8h1" },
  { id: "1j2QkgsYiBtYzc46VzPOPwok2PWmwPbr6" },
  { id: "1TL2Oq3b-owWm8CCuJ3a8mL6ikygc4ym5" },
  { id: "14xxXAElHoQpgU3kzJz5aPRXPjfJKJ4Uf" },
];

const CALL_RECORDING_VIDEOS: LegacyVideo[] = [
  ...CALL_RECORDING_FATHOM.map((externalId, index) => ({
    provider: "fathom" as const,
    externalId,
    label: `Call recording ${index + 1}`,
  })),
  ...CALL_RECORDING_DRIVE.map((entry) => ({
    provider: "drive" as const,
    externalId: entry.id,
    label: entry.date ? `Strategy session - ${entry.date}` : undefined,
  })),
];

const SALES_REP_TRAINING: LegacyCourse = {
  slug: "sales-rep-training",
  title: "Internal Sales Rep Training",
  description:
    "Internal process training for the TAG sales team: funnels, scripts, pipeline, and payments.",
  visibleToRoles: COURSE_AUDIENCES.SALES_REP,
  sections: [
    {
      title: "Internal Sales Rep Training",
      lessons: [
        {
          title: "Marketing Funnels Link",
          videos: [],
          docs: [],
          checkboxes: WATCHED,
          content: `VSL

https://taxadvisorygrowth.com/vsl

TY

https://taxadvisorygrowth.com/ty`,
        },
        {
          title: "How to Sell This",
          // The handoff recorded this lesson as having no video. It has one.
          videos: [{ provider: "loom", externalId: "904430ad38ac4d5499b54fa09a38e967" }],
          docs: [],
          checkboxes: WATCHED,
          content: `First, compliance work is your bread-and-butter tax returns—basically filing annual forms. It's transactional, often low-ticket, and everyone needs it, but it's not where big profit lies.

Next, tax resolution steps in when someone's already in trouble with the IRS—they owe back taxes, they're under audit. You're negotiating, setting up payment plans, or reducing liabilities after the fact. It's often urgent work but can be stressful and reactive.

Now, tax advisory is where you want to be. This is proactive consulting—working with clients before any issues arise. You build strategies to legally minimize their future tax burdens. Instead of just reacting, you're planning for the future—helping them structure their business or investments so they owe less down the line. It's higher-value, more strategic, and frankly, it's where firms can command premium fees.

Your system is built to shift firms from relying on referrals (which often bring more resolution-type work) to attracting ideal advisory clients on demand. You control the quality of who's coming in. And yes, before they even see the return, you position them for a paid assessment, which leads them into that advisory relationship. That's the game-changer!

You've got it. We don't dabble in general marketing or spread ourselves thin. We're laser-focused on the tax professionals' world—CPAs, EAs, and tax firm owners. This is literally all we do, and that gives us a deep understanding of your challenges and goals. Our entire model is built on long-term partnerships—we want you to renew with us year after year. And frankly, it only works if we deliver real results—because every long-term client is worth about $60k a year to us, too.

That's why we're not just giving you random leads. Our system ensures you get highly qualified appointments—business owners who actually show up and are ready to talk tax strategy. The whole system is designed to remove guesswork, so you're talking to people who want advisory—and that's what fuels your growth and our mutual success.

The system we install is the same one we've proven ourselves. It tackles the inconsistency problem head-on by making sure that the only people you speak to are genuinely interested in tax strategy—not tire-kickers. On the back end, we aggressively filter out the wrong fit. If someone's just browsing, or not serious, they're weeded out before a call is even booked.`,
        },
        {
          title: "Sales Script",
          videos: [],
          docs: [],
          checkboxes: WATCHED,
          content: `High-Level Framework

1. Frame
2. Discovery
3. Current State
4. Desired Future
5. Gap
6. Emotional Drivers
7. Summary
8. Transition
9. Presentation
10. Temperature Check
11. Investment
12. Commitment
13. Funding (if needed)
14. Onboarding

The biggest change from your current process is this:

Funding should never happen until after they've committed to buying.

SECTION 1 - FRAME

"First off, I appreciate you taking the time today.

My goal isn't to convince you to work with us.

My goal is to understand your business, where you're trying to go, what's stopping you from getting there, and if we genuinely believe we can help, I'll show you exactly how we'd do it.

If I don't think we're a good fit, I'll tell you that too.

Fair enough?"

This lowers resistance immediately.

SECTION 2 - DISCOVERY

Never pitch here.

Become obsessed with understanding.

Questions:

"What do you currently offer?"

"Who do you primarily serve?"

"How are you currently acquiring clients?"

"What percentage comes from referrals?"

"What percentage comes from advisory?"

"What's annual revenue?"

"When did you start?"

"What's working?"

"What's frustrating?"

"What finally made you book today?"

Replace:

What resonated with you?

with

What finally made you decide enough was enough?

It's much stronger.

SECTION 3 - FUTURE

"Where do you actually want this business to be?"

Revenue?

Lifestyle?

Team?

Retirement?

Freedom?

Exit?

Keep digging.

SECTION 4 - PAIN

This is where almost every call you've shared left money on the table.

Instead of:

"What happens if nothing changes?"

Go deeper.

Examples:

"If nothing changes over the next 12 months...what does that cost you?"

"What opportunities have you missed because referrals dried up?"

"How much revenue have you left on the table?"

"What happens if advisory never becomes predictable?"

Stay here.

SECTION 5 - WHY NOW

You already ask this.

Keep it.

It's one of your best questions.

SECTION 6 - SUMMARY

One of the biggest additions.

Never transition without summarizing.

Example:

"So let me make sure I understand.

You've built a great firm.

You're relying mostly on referrals.

You know advisory is where the future is.

You already have fulfillment.

But marketing hasn't become predictable.

And ultimately you want a business producing predictable advisory revenue every month.

Did I miss anything?"

This gets them agreeing with you.

SECTION 7 - TRANSITION

Don't say:

"Let me show you our funnel."

Instead:

"Based on everything you've told me...

I don't think you need another marketing company.

I think you need a predictable client acquisition system.

Let me show you exactly what that looks like."

Huge difference.

SECTION 8 - PRESENTATION

This is where I'd make the biggest changes.

Current:

Offer → Ads → Funnels → Applications → Videos → Sales reps → Guarantees → Examples → Price

New:

Problem → Solution → Offer → Assets → Implementation → Guarantee → Price

Much shorter.

Remember...

Nobody bought because of funnels.

Everyone bought because they wanted predictable advisory clients.

BUYING TEMPERATURE CHECK

This doesn't exist in your current process.

It needs to.

Ask:

"How are you feeling about everything so far?"

or

"Does this feel like the solution you've been looking for?"

Now you know where they are.

PRICE

Don't verbally explain everything.

Have ONE slide.

Done For You Client Acquisition

Offer Creation

Ads

Funnels

AI Qualification

Appointment Setting

100 Qualified Live Appointments

Sales Infrastructure

Implementation

Investment

$25,000

Today

$20,000

Done.

No confusion.

COMMITMENT

Biggest addition.

Ask:

"Based on everything we've covered...

Do you feel this is the right solution for your business?"

Pause.

Silence.

Wait.

If yes...

THEN...

Ask

"Great.

Now let's figure out the easiest way to structure the investment."

Notice...

Commitment first.

Funding second.

FUNDING

Only after commitment.

Not before.

OBJECTION FRAMEWORK

This is probably the biggest thing I'll build.

Every objection fits into one category.

Trust

"They've been burned."

Don't sell harder.

Ask:

"What happened?"

"What would've had to happen for you to still be working with them?"

"What would make this feel different?"

Stay there.

Price

Never defend price.

Ask:

"Compared to what?"

or

"What specifically makes it feel expensive?"

Partner

"How do you and your partner typically make decisions?"

Timing

"What's changing between now and then?"

Delivery

Bruce's objection.

Ask:

"If we controlled the flow of clients while you refined fulfillment, would that solve your concern?"

BIGGEST CHANGE

Your closes currently look like:

Presentation → Questions → Questions → Questions → Funding → Decision

New flow:

Presentation → Temperature Check → Commitment → Funding → Onboarding

Massive difference.

BUYER TYPES

This is something almost nobody teaches.

I identified at least five.

Analytical

Needs certainty.

Needs logic.

Needs process.

Trust Buyer

Burned before.

Needs proof.

Momentum Buyer

Just wants someone to help them move.

Consensus Buyer

Needs spouse.

Partner.

Team.

Operator

Thinks in systems.

Economics.

Scaling.

Backend.

Each one should hear different language.`,
        },
        {
          title: "Call Recording Links",
          videos: CALL_RECORDING_VIDEOS,
          docs: [],
          checkboxes: WATCHED,
          content: "",
          // Restated at lesson level even though the whole course is already
          // sales-rep only. These are recordings of real client calls; if the
          // course audience is ever widened, this lesson should not widen with
          // it by default.
          visibleToRoles: COURSE_AUDIENCES.SALES_REP,
        },
        {
          title: "EOD Pipeline Management",
          videos: [{ provider: "loom", externalId: "cda6e938cf634477b1402343b1a4d9bb" }],
          docs: [],
          checkboxes: WATCHED,
          content: "",
        },
        {
          title: "Sending Agreements",
          // Same title as a lesson in the Onboarding course, different video
          // and different course. Two real lessons, not a duplicate.
          videos: [{ provider: "loom", externalId: "032913be862d4435bffb8a853acfa15b" }],
          docs: [],
          checkboxes: WATCHED,
          content: "",
        },
        {
          title: "ACH Pitch Doc",
          videos: [],
          docs: [
            {
              label: "ACH Pitch Doc (Google Doc)",
              url: "https://docs.google.com/document/d/1ro3Lx_0_p9hNjTJbgAJhSBJUJf74OkJ9pd47-v1zX0A/edit?usp=sharing",
            },
          ],
          checkboxes: WATCHED,
          content: "",
        },
        {
          title: "Payment Links",
          videos: [{ provider: "loom", externalId: "a5859fc0535349138d9fbf7e3b6f6c57" }],
          docs: [
            {
              label: "Payment Links (Google Doc)",
              url: "https://docs.google.com/document/d/1mt0ygNaIxGA3RNHB4kPLEaOnntWcAGaS1irRSW1tUpA/edit?usp=sharing",
            },
          ],
          checkboxes: WATCHED,
          content: "",
        },
      ],
    },
  ],
};

/** The two courses that do not exist in the Hub at all. */
export const NEW_LEGACY_COURSES: readonly LegacyCourse[] = [CSM_TRAINING, SALES_REP_TRAINING];
