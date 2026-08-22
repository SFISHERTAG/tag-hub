/**
 * Part C: what the two already-seeded courses should actually say.
 *
 * `lib/course/seed.ts` entered `onboarding-expectations` and `sales-training`
 * from an earlier hand-paraphrase pass. Measured against a live crawl on
 * 2026-08-21, that text is roughly 8% of the source on the sales course — 4,463
 * characters standing in for 54,400. It is not a light paraphrase to touch up;
 * it is a summary, and this file replaces it.
 *
 * Corrections are matched to lessons by their **video id**, not by title or
 * position. Four of these lessons carry a different title in Skool than the one
 * they were seeded under, so a title match would silently skip exactly the
 * lessons most in need of correcting. A loom id is the one thing that has not
 * moved. Verified read-only against the live database on 2026-08-21: all 22
 * corrections match exactly one row each.
 *
 * On "verbatim": the words are the source's, unedited. Whitespace is normalised
 * to one blank line between blocks, because the crawl read rendered text rather
 * than the stored markup and Skool's own spacing is not recoverable from it.
 *
 * The two lessons that show one email address and link another use
 * `support@taxadvisorygrowth.net`, per Sam on 2026-08-21.
 *
 * Only one lesson is retitled. Skool also differs from the seeded titles on
 * three others, but only in a typo ("Must To Buy"), a stray space ("Chunking
 * Down ( Reflex Selling)") and capitalisation — those are Skool being sloppy,
 * not the lesson being renamed, and copying them in would be churn that makes
 * the Hub worse. Flagged rather than applied.
 */

export type LessonCorrection = {
  /** The loom id on the seeded row. The join key. */
  loomId: string;
  /** Set when the live lesson has been retitled since seeding. */
  title?: string;
  content: string;
};

export type CourseCorrection = {
  slug: string;
  lessons: LessonCorrection[];
};

const ONBOARDING: CourseCorrection = {
  slug: "onboarding-expectations",
  lessons: [
    {
      loomId: "fdba6345d0cb4175baa850e81066216f",
      // "Onboarding & Expectations". Video only, no body text live.
      content: "",
    },
    {
      loomId: "2f922c4caa12477699f8f5a6f3e1a590",
      // Retitled in Skool. Sam's call 2026-08-21: Skool's title ships.
      title: "Niches, Offer, Pricing, Closing",
      content: `For CPAs, EAs & Tax Firms Looking To Scale The Advisory Side Of Their Business

Most tax firms struggle to scale their advisory division because they're focused on selling services instead of outcomes.

They lead with:

Tax Planning

Tax Advisory

Tax Strategy

CFO Services

Tax Consulting

The problem is that business owners don't wake up looking for any of those things.

They wake up thinking:

"I paid too much in taxes."

"There has to be a better way."

"I don't know if my current CPA is being proactive."

"I feel like I'm leaving money on the table."

"I want to legally keep more of what I earn."

The market doesn't buy tax planning.

The market buys outcomes.

THE POSITIONING

You are not selling:

Tax preparation

Compliance

Bookkeeping

Hourly consulting

Reactive advice

You are selling:

Tax liability reduction

Strategic tax planning

Financial certainty

Increased cash flow

Long-term wealth preservation

High-value business advisory

Your positioning should be simple:

"We help business owners legally reduce unnecessary tax liability through proactive tax strategy, implementation, and ongoing advisory."

THE BIGGEST MISTAKE MOST FIRMS MAKE

Most firms spend too much time worrying about niches.

They ask:

Should I target dentists?

Should I target doctors?

Should I target real estate investors?

Should I target agencies?

Should I target contractors?

Should I target law firms?

In reality, the niche matters far less than most people think.

The offer matters.

The income level matters.

The tax pain matters.

A business owner generating meaningful income with a meaningful tax burden is a potential client regardless of industry.

Instead of obsessing over niches, focus on:

Income

Target business owners with money.

Examples:

$500,000+ annual revenue

$1M+ annual revenue

$250,000+ personal income

Tax Burden

The greater the tax burden, the greater the motivation.

A business owner who paid $20,000 in taxes rarely takes action.

A business owner who paid:

$100,000

$250,000

$500,000+

in taxes becomes highly motivated to explore solutions.

Offer

The offer is everything.

WEAK OFFER

"We provide tax planning services."

Nobody cares.

STRONG OFFER

"If you paid $100,000+ in taxes last year, here's my offer to you."

"We'll identify every meaningful tax reduction opportunity available to your situation and show you exactly where you may be overpaying."

Or:

"If you're a business owner paying more taxes than you believe you should be, we'll uncover the highest-impact tax reduction strategies available and help implement them."

The market buys the result.

Not the mechanism.

THE IDEAL CLIENT JOURNEY

Most successful tax advisory firms follow a similar structure.

Phase 1: Assessment / Discovery

Purpose:

Identify opportunities

Quantify potential savings

Create certainty

Typical Fee:

$2,000–$5,000

Examples:

Tax Blueprint

Tax Assessment

Tax Opportunity Review

Tax Strategy Discovery

Phase 2: Strategy & Planning

Purpose:

Build the roadmap

Prioritize opportunities

Create implementation plan

Typical Fee:

$5,000–$25,000+

Phase 3: Implementation

Purpose:

Execute strategies

Coordinate structures

Handle compliance requirements

Examples:

Entity structuring

Cost segregation

Retirement planning

Advanced tax strategies

Trust structures

Tax elections

Typical Fee:

$5,000–$50,000+

Phase 4: Ongoing CFO / Advisory Services

Purpose:

Maintain strategy

Monitor performance

Continue optimization

Typical Fee:

$2,000–$10,000+ per month

The assessment is not the business.

The assessment is simply the entry point into a long-term advisory relationship.

THE IRRESISTIBLE OFFER FRAMEWORK

Most firms lead with services.

Winning firms lead with outcomes.

Instead of saying:

"We offer tax advisory services."

Say:

"If you paid six figures in taxes last year, here's my offer to you."

Or:

"If you're a business owner generating substantial income and you're not sure whether you're overpaying in taxes, here's what we'll do."

Then explain the process.

The problem first.

The solution second.

The service last.

WHAT ACTUALLY SCALES

The firms that scale the fastest generally do not have the most complicated strategy.

They simply:

Get in front of qualified business owners

Lead with a painful problem

Present a compelling offer

Sell outcomes instead of services

Use a structured assessment process

Move clients into implementation

Retain them through ongoing advisory

The niche is rarely the bottleneck.

The offer is.

Find business owners with money.

Find business owners with a tax problem.

Present an offer that is difficult to ignore.

Then build the systems necessary to consistently bring those opportunities into the firm.`,
    },
    {
      loomId: "e7a4b69c92d845a79cf8d070d09594c7",
      content: `This Intake Form was Given To You On Your Onboarding Call

Tax Advisory Offer

Please describe your Tax Advisory Offer in as much detail as possible.

What specific outcomes do clients achieve working with you?

Examples:

Reduce tax liability

Increase cash flow

Improve entity structure

Implement advanced tax strategies

Ongoing CFO guidance

Walk us through your Tax Advisory process from start to finish.

What makes your Tax Advisory offer different from every other CPA, EA, or Tax Firm?

Do you offer a money-back guarantee or any form of risk reversal? (Highly Recommended)

If yes, please explain in detail.

What is the average investment for a client to work with you?

Please include:

Assessment/Audit Fee

Tax Plan Fee

Implementation Fee

Ongoing Advisory/CFO Fee

Ideal Client

Describe your ideal Tax Advisory client in as much detail as possible.

What industries, business types, or client profiles produce the best results for you?

What revenue, income level, or tax burden should a prospect have before working with you?

What are the common characteristics of your best clients?

Pain Points & Motivation

What is the biggest problem your ideal client is facing before they work with you?

What keeps your ideal client up at night?

Why do clients ultimately decide to hire you?

What are the biggest mistakes prospects make before working with your firm?

Results & Proof

What are your three best Tax Advisory client success stories?

For each example, please include:

Client Type

Original Problem

Tax Strategies Implemented

Tax Savings Achieved

Final Outcome

Do you have any testimonials, case studies, screenshots, videos, or client wins we can use in marketing?

What is the largest tax savings result your firm has ever achieved for a client?

Competition & Positioning

Who are your biggest competitors?

Why should a prospect choose your firm over them?

Is there anything else we should know that would help us position, market, and scale your Tax Advisory services more effectively?`,
    },
    {
      // "Book A Call 2-3 Days" has no video, so it is matched on title.
      loomId: "",
      title: "Book A Call 2-3 Days",
      content: `Use the link below to book a call,  2-3 days after the intake form has been updated by you. Also be sure to hold on to this link because this is how you will book calls with our fulfillment team, for the duration of our service to you and your business

Walters Booking Link

https://links.thedealclosers.net/widget/booking/GCG8N9f8oqMtDZx9lPXE

Samuel Booking Link

https://links.thedealclosers.net/widget/booking/KX741GkenVU8IjGvPBuX`,
    },
    {
      loomId: "a8cb4c5e6d9542de934a3943cc7843a9",
      // The page shows support@ and links dj@. Sam: support@ is correct.
      content: `Use This Email for Invite To Highlevel

Make sure you give us access to the agency access. If you do not have atp( texting) set up

Give Invite to your account managers email

Email

support@taxadvisorygrowth.net

Use This Link To Sign Up

Starter Plan $97 A Month

30 Day Free Trial

https://www.gohighlevel.com/em-30-day-trial`,
    },
    {
      loomId: "2180fa7ffbed46f5855fc550e7ae0d90",
      // "Purchasing Domain". Video only.
      content: "",
    },
    {
      loomId: "d979f9495e78411786926aac21bcf483",
      // The page shows support@ and links dmbcwithaustyn@. Sam: support@.
      content: `Invite this email

support@taxadvisorygrowth.net`,
    },
    {
      loomId: "4421043f354343a99be4285a510f19fd",
      // "Setting Up Calendar & Availability". Video only.
      content: "",
    },
    {
      loomId: "884e665030f142f8b2dd954084ff5bab",
      content: `Here is the doc for actors please let your account manager know the number of the person you want to use 1-17 on slack here is the doc so you can listen to the audio to hear how the spoke person sounds . 7-10 DAY DELIVERY WITH ACTORS WHICH COVERS THE TIME FOR THEM TO FILM AND TIME TO EDIT

https://docs.google.com/document/d/1sYBWN8FDKkVD9VfuXbTvyQfYYKuk761K6mgngvxpYGM/edit`,
    },
    {
      loomId: "75984e180643411abb55796c4ea76882",
      content: `STEP 1

Create a Google Drive Select " Share " , " Anyone with Link" & " Editor Access"

STEP 2

Label

Ad1( Vertical)

Vsl ( Horizontal)

Pre Call ( Horizontal)

Testimonial Pictures With Labeled Name

Company Logo

STEP 3

Buy Domain If You Don't Have One

STEP 4

Get Set Up On HighLevel If You Don't

https://www.gohighlevel.com/highlevel-bootcamp?fp_ref=-68`,
    },
    {
      loomId: "0920e3e8fde34686a6724b5b558e5b0b",
      content: `Use This Link To Book A Call With Luminos For Payment Processor With Financing

https://calendly.com/robert-golumino/ttg

Make sure you put this, "REFERRED BY THE DEAL CLOSERS LLC" to fast rack the process for the question below

Please share anything that will help prepare for our meeting.`,
    },
    {
      loomId: "d675207348d34fc2a18719521de50a33",
      // "Sending Agreements". Video only.
      content: "",
    },
  ],
};

const SALES_TRAINING: CourseCorrection = {
  slug: "sales-training",
  lessons: [
    {
      loomId: "d75458c5f3df414881e0e2cb6a24df4c",
      content: `Selling Tax Advisory: The Mindset Shift Every Tax Professional Must Make

You're Not in the Tax Business

The first thing you have to understand is this:

You are not in the business of selling tax strategies.

You're in the business of helping business owners build more wealth.

That may sound like a small difference, but it's one of the biggest mindset shifts you can make.

Most accountants believe people hire them because they know the tax code.

That's only partially true.

People don't invest thousands—or tens of thousands—of dollars because someone understands IRS regulations.

They invest because they believe their life or business will be better after working with you.

The tax strategy is simply the vehicle.

The destination is what they're buying.

The Biggest Mistake Tax Professionals Make

Most tax professionals sell their services like this:

We do tax planning.

We create custom tax strategies.

We analyze your financials.

We optimize your entity structure.

We review your books quarterly.

We perform cost segregation studies.

We utilize the Augusta Rule.

We implement R&D credits.

The problem is...

Business owners don't wake up excited about any of those things.

No successful entrepreneur has ever said,

"I really hope someone explains depreciation schedules to me today."

They don't care about the mechanism.

They care about what the mechanism does for them.

They're asking themselves questions like:

Will this help me keep more of my money?

Will this help me build wealth faster?

Will this help me buy another company?

Will this give me more cash flow?

Will this reduce stress?

Will this help me retire sooner?

Will this allow me to invest in real estate?

Will this let me provide more for my family?

That is what they're buying.

Not tax planning.

Not strategy.

Not compliance.

The outcome.

Stop Selling the Process

Imagine you're buying a private jet.

The salesperson doesn't spend two hours explaining how the engines work.

They don't explain every bolt inside the aircraft.

They don't teach aerodynamics.

Instead they paint a picture.

Imagine leaving whenever you want.

No airport lines.

No TSA.

More time with your family.

More productive business trips.

More freedom.

They're selling the destination.

Not the engine.

You need to do the exact same thing.

Instead of saying:

"We create proactive tax strategies."

Say:

"We help successful business owners legally keep significantly more of the money they've already earned so they can grow faster and build long-term wealth."

Notice how different that feels.

People Buy Better Futures

Nobody buys a Rolex because they need to know the time.

Nobody buys a Ferrari because transportation is difficult.

Nobody buys luxury homes because apartments don't exist.

People buy what those things represent.

Status.

Freedom.

Success.

Identity.

Business owners behave the exact same way.

They don't buy tax planning.

They buy the version of themselves that keeps more of what they earn.

They buy the future where they have more opportunities.

The strategy is simply how they get there.

Shift From Features to Outcomes

Every service your firm offers has two versions.

The feature.

And the outcome.

The feature is what you do.

The outcome is why anyone cares.

Instead of saying:

"We perform quarterly tax planning."

Say:

"We make sure taxes never become a surprise again."

Instead of saying:

"We optimize your entity structure."

Say:

"We help you legally keep more money inside your business every single year."

Instead of saying:

"We prepare tax projections."

Say:

"We give you complete confidence before making major financial decisions."

Instead of saying:

"We review your financial statements."

Say:

"We uncover opportunities that most business owners never realize they're missing."

The outcome is always more valuable than the activity.

Stop Thinking Like an Accountant During Sales

Your accounting brain has been trained for years.

You've been rewarded for being accurate.

Detailed.

Precise.

Conservative.

Thorough.

Explaining everything.

Documenting everything.

Double-checking everything.

Those habits make you an excellent accountant.

But they often make you a poor salesperson.

Sales requires certainty.

Confidence.

Simplicity.

People don't buy the person who explains the most.

They buy the person who gives them the most confidence.

That's a huge difference.

Knowledge Doesn't Create Trust

Most accountants believe this:

"If I educate the client enough, they'll trust me."

That's rarely true.

Think about a heart surgeon.

Imagine asking,

"Can you fix my heart?"

Instead of answering confidently, the surgeon spends the next forty-five minutes explaining every artery, every instrument, and every medical procedure.

Does that make you feel better?

Usually not.

You don't want a medical lesson.

You want confidence.

You want certainty.

Business owners feel exactly the same way.

They don't need to understand every tax strategy.

They need to believe you're capable of delivering the result.

Your job is not to turn prospects into tax experts.

Your job is to become the obvious expert.

The Curse of Expertise

One of the biggest challenges experts face is something called the Curse of Knowledge.

Because you understand tax law so well, you assume everyone else needs to understand it too.

They don't.

Imagine hiring a mechanic.

You don't need to understand how transmissions work.

You simply want your truck fixed.

Your clients think the exact same way.

The more complicated you make your explanation, the more confusing your offer becomes.

Simple always wins.

People Buy Emotion First

Business owners love to believe they make logical decisions.

They don't.

Logic justifies.

Emotion decides.

Every purchasing decision starts emotionally.

Think about why someone wants to reduce taxes.

It's rarely because they enjoy saving taxes.

They want what the savings creates.

Freedom.

Growth.

Security.

Opportunity.

More cash.

Less stress.

More confidence.

More control.

Those are emotional outcomes.

The tax strategy simply delivers them.

Price Is Relative to Value

One of the biggest limiting beliefs accountants have is this:

"My fees are expensive."

Let's challenge that.

Suppose you charge $25,000.

Your strategies legally save the client $400,000 over the next few years.

Is your fee expensive?

Or is it one of the highest-return investments they'll ever make?

Business owners don't compare your fee against your competitors.

They compare your fee against what they believe they'll gain.

The more valuable the outcome feels, the smaller the investment appears.

Never Defend Your Price

When someone says,

"That's expensive."

Most accountants immediately begin defending their fee.

Don't.

Instead, help them compare the investment against the outcome.

For example:

"If we can help you legally keep an additional $300,000 over the next twelve months, how would that impact your business?"

Now the conversation isn't about spending $25,000.

It's about preserving $300,000.

That's a completely different conversation.

Stop Teaching on Sales Calls

Many accountants accidentally turn every sales conversation into a tax seminar.

They spend thirty minutes teaching.

Explaining.

Drawing diagrams.

Walking through strategies.

By the end of the call, the prospect has learned a lot.

But they haven't made a buying decision.

Education does not equal persuasion.

In fact, too much education often reduces urgency.

Your job isn't to prove how smart you are.

It's to help someone clearly understand their problem, believe there's a solution, and see why you're the best person to guide them.

Diagnose Before You Prescribe

The best advisors don't immediately start talking.

They ask questions.

Lots of questions.

A doctor doesn't prescribe medication before understanding what's wrong.

Neither should you.

Your goal is to understand:

Where is the business today?

Where do they want to go?

What's preventing them from getting there?

What is it costing them every year?

What happens if nothing changes?

Only after understanding those answers should you recommend a solution.

People trust advisors who understand them before trying to sell them.

Sell the Cost of Inaction

Many prospects compare your fee against doing nothing.

That's because no one has shown them what doing nothing actually costs.

Ask questions like:

"What happens if you continue paying unnecessary taxes for another five years?"

"What opportunities would you miss if nothing changes?"

"How much capital could you have invested back into your business instead?"

Sometimes doing nothing costs hundreds of thousands—or even millions—of dollars over time.

When prospects realize that, your fee begins to look very small.

Confidence Is Contagious

Clients borrow confidence from the person sitting across from them.

If you're uncertain about your value, they'll feel uncertain too.

If you hesitate when discussing your fees, they'll hesitate to invest.

If you sound apologetic, they'll believe your service is overpriced.

Confidence doesn't come from being loud.

It comes from genuinely believing your service creates extraordinary value.

If you believe that helping someone legally preserve hundreds of thousands of dollars changes their future, your conversations will naturally become stronger.

Your Identity Must Change

Stop seeing yourself as an accountant who occasionally sells.

Start seeing yourself as a trusted advisor who happens to use tax strategy as the tool.

You're helping entrepreneurs:

Build wealth.

Create financial freedom.

Protect what they've earned.

Reinvest into growth.

Take care of their families.

Retire earlier.

Create generational wealth.

That's a much bigger mission than preparing tax returns.

The Most Important Sales Principle You'll Ever Learn

People don't buy tax strategies.

People don't buy compliance.

People don't buy meetings.

People don't buy reports.

People don't buy spreadsheets.

People don't buy deliverables.

They buy:

More wealth.

More cash flow.

More freedom.

Less stress.

Better financial decisions.

Faster business growth.

More opportunities.

Greater confidence.

A better future.

Everything you say on a sales call should connect back to one simple question:

"How does this improve the client's life or business?"

If what you're explaining doesn't clearly answer that question, you're talking about the process instead of the outcome.

The highest-performing advisors understand something that average advisors never do:

People don't invest in how you do it. They invest in where you'll help them end up.`,
    },
    {
      loomId: "37028b5d7ee34ce0bc9e0c7a244acf0a",
      content: `The Doctor's Frame: How Elite Tax Advisors Build Trust, Ask Better Questions, and Lead Conversations

The biggest misconception in sales is that the person with the best presentation wins.

They don't.

The person who understands the prospect better than anyone else wins.

That's why the best tax advisors don't sound like salespeople.

They sound like trusted professionals.

Think about the last time you visited a doctor, attorney, or financial advisor you respected.

They weren't rushing.

They weren't talking over you.

They weren't trying to impress you.

They were calm.

Confident.

Curious.

Intentional.

Every question felt like it had a purpose.

That's the frame you need to operate from.

You're Not Here to Sell

The moment you believe your job is to convince someone to buy, you'll start doing what most salespeople do.

You'll overexplain.

You'll interrupt.

You'll defend your price.

You'll start pitching before you've earned the right to.

Instead, adopt this belief:

"My job isn't to sell. My job is to understand whether I can genuinely help this person."

That single belief changes everything.

You stop chasing.

You start diagnosing.

You stop forcing.

You start discovering.

Prospects can feel the difference immediately.

Care More Than You Close

Here's one of the simplest ways to improve your sales conversations.

Imagine the person on the other side of the phone isn't a prospect.

Imagine it's your mother.

Your father.

Your brother.

Your best friend.

Or someone you genuinely care about.

Now imagine they were just in a serious car accident.

Would you sound rushed?

Would you interrupt them?

Would you be waiting for your turn to talk?

Of course not.

You'd slow down.

You'd listen carefully.

You'd ask thoughtful questions.

You'd make sure you completely understood what happened before saying anything.

That is exactly how every discovery call should feel.

Not because your prospect was in an accident.

But because they have a business problem that is affecting their life, their family, their employees, and their future.

If you truly care about helping them solve it, your tone changes automatically.

People can hear genuine care.

They can also hear fake enthusiasm.

The best advisors don't perform empathy.

They actually care.

Your Voice Is Selling Before Your Words Are

Most advisors obsess over what they're going to say.

Very few think about how they're saying it.

Yet prospects judge confidence long before they evaluate your logic.

Your voice communicates:

Confidence.

Competence.

Leadership.

Calmness.

Authority.

Empathy.

Trustworthiness.

Before your words ever have a chance.

Slow Down

One of the fastest ways to sound inexperienced is to speak too quickly.

Fast talking usually communicates one of three things:

You're nervous.

You're trying to convince them.

You're afraid they'll leave.

None of those create confidence.

Confident people don't rush.

Experienced doctors don't rush.

Experienced attorneys don't rush.

Experienced CEOs don't rush.

Slow your speech down.

Allow your words to land.

Give people time to think.

Silence isn't awkward.

Silence is where people process.

And when people process, they often reveal information they weren't planning to share.

Learn to Pause

One of the most powerful communication tools is silence.

Ask your question.

Then stop talking.

Really stop.

Don't rescue the silence.

For example:

"What made you decide to book this call?"

Pause.

Let them think.

If they stop after a short answer, wait another second or two.

Many prospects will continue speaking simply because you allowed them space.

Some of the most valuable information you'll ever hear comes after the first answer.

Vocal Projection

Project confidence without becoming loud.

Speak from your diaphragm, not your throat.

Finish your sentences.

Avoid letting your voice trail off.

Avoid sounding unsure.

Instead of ending every sentence like a question...

Finish your statements with certainty.

Compare these:

"So... I think this strategy could probably help..."

Versus:

"Based on everything you've shared, I believe this is absolutely something we can help you solve."

Same message.

Completely different confidence.

People don't follow uncertainty.

They follow certainty.

Remove Artificial Sales Energy

Many salespeople believe they need to sound excited all the time.

That's exhausting.

And it feels fake.

You don't need to be high energy.

You need to be emotionally appropriate.

If a client tells you they're frustrated because they wrote a six-figure check to the IRS, that's not the moment to sound like a motivational speaker.

Match their emotional state.

If they're serious, be serious.

If they're reflective, be reflective.

If they're excited about growth, allow your energy to rise with theirs.

Great communicators don't force emotion.

They mirror it.

Curiosity Over Cleverness

Many people think elite salespeople have all the answers.

Actually, they ask better questions.

Every answer should create another question.

Prospect:

"I think I'm paying too much in taxes."

Instead of immediately responding:

"We can definitely help with that."

Get curious.

"What makes you say that?"

"Walk me through that."

"When did you first realize it?"

"What happened?"

"How did that impact the business?"

Every answer has another layer underneath it.

Your job is to uncover it.

Never Accept the First Answer

Most prospects answer at the surface level.

Your job is to help them go deeper.

Prospect:

"I want to reduce taxes."

That's not the real reason.

Ask:

"What would reducing your taxes allow you to do?"

"Why is that important?"

"What happens if nothing changes?"

"What would keeping that money mean for your business?"

Eventually you might discover:

They've delayed hiring.

They've postponed opening a second location.

They've stopped investing.

They're worried about retirement.

They're frustrated watching money leave the business every year.

Now you're no longer solving taxes.

You're solving growth.

You're solving freedom.

You're solving opportunity.

Chunk Down Every General Statement

Prospects naturally speak in broad terms.

"I'm overwhelmed."

"What specifically feels overwhelming?"

"My business has slowed."

"Compared to when?"

"I need more cash flow."

"What's creating the cash flow pressure?"

"My CPA isn't proactive."

"Can you tell me what that's looked like?"

Every broad statement should become a detailed conversation.

The more specific the problem becomes, the more valuable your solution becomes.

Follow the Emotion

Facts explain.

Emotion motivates.

Listen for emotional words.

Frustrated.

Disappointed.

Overwhelmed.

Concerned.

Embarrassed.

Excited.

Hopeful.

Whenever emotion appears, don't move on.

Stay there.

Ask:

"What made you feel that way?"

"Tell me more."

"What was going through your mind?"

"How did that affect your decisions?"

Emotion reveals importance.

Diagnose Before You Prescribe

Doctors don't prescribe treatment after hearing one symptom.

Neither should you.

Understand:

Where they are today.

Where they want to go.

What's preventing them from getting there.

How long it's been happening.

What they've already tried.

Why those attempts failed.

What it's costing them.

Only then should you discuss solutions.

When the diagnosis is thorough, the recommendation feels obvious.

Listen to Understand, Not to Respond

One of the biggest mistakes advisors make is listening for the next opportunity to talk.

Instead, listen with one goal:

"I want to fully understand this person's world."

That means you're not mentally rehearsing your pitch while they're speaking.

You're completely present.

You're paying attention to their words.

Their emotions.

Their pauses.

Their uncertainty.

Their excitement.

People can feel when they have your full attention.

And very few people ever experience that.

The Goal of Every Question

Every question should accomplish one of four things.

It should help you understand:

Where they are.

Where they want to be.

What's preventing them from getting there.

Why solving it matters.

If your questions aren't moving you toward one of those answers, they're probably unnecessary.

Confidence Comes From Certainty, Not Pressure

You don't need pressure when you've diagnosed correctly.

You don't need clever closing techniques when the prospect clearly understands the problem.

The easiest sales are rarely the result of a brilliant pitch.

They're the result of brilliant discovery.

Because once someone clearly sees the gap between where they are and where they want to be, your recommendation stops feeling like a sales pitch.

It feels like the logical next step.

The Advisor Every Client Wants

Become the advisor who makes people feel understood.

Become the advisor who listens more than they speak.

Become the advisor who asks thoughtful questions instead of making assumptions.

Become the advisor whose calmness creates confidence.

Become the advisor whose voice slows the room down.

Become the advisor who genuinely cares more about solving the problem than making the sale.

Because people don't remember every question you asked.

They remember how you made them feel.

If they leave the conversation thinking,

"That was the first person who truly understood my business,"

you've already done the hardest part of selling.

Everything else becomes much easier.`,
    },
    {
      loomId: "ab40f65f6eb147e8a7f5240a5193384f",
      content: `The Seven Beliefs Every Business Owner Must Have Before They'll Invest in Tax Advisory

One of the biggest mistakes tax advisors make is believing that people buy because they heard a good presentation.

They don't.

People buy because they believe.

Every buying decision is simply the result of a series of beliefs becoming true.

If even one critical belief is missing, the prospect hesitates.

They ask for time.

They need to think about it.

They want to talk to their spouse.

They want to "shop around."

They say your fee is expensive.

Those aren't the real objections.

They're symptoms.

The real objection is always a missing belief.

Your job on a sales call isn't to overcome objections after they happen.

Your job is to build the right beliefs before you ever present your recommendation.

That's what elite advisors do.

They don't close people.

They help people arrive at the right conclusion themselves.

The Goal Isn't to Convince

Most inexperienced salespeople think their presentation creates certainty.

Actually, certainty is created during discovery.

By the time you explain your recommendation, your prospect should already believe:

"I have a serious problem."

"I can't continue doing what I'm doing."

"This problem is costing me far more than I realized."

"I know exactly what life looks like if I solve it."

"I can afford to solve it."

"The people around me will support this."

"And I believe this advisor can actually help me."

If those beliefs exist, presenting your recommendation becomes easy.

The Belief Ladder

Think of every sales conversation as climbing a ladder.

You can't skip steps.

If someone doesn't believe they have a problem, they won't care about your solution.

If they don't believe your solution is different, they'll compare you to every other CPA they've worked with.

If they don't believe the cost of waiting is significant, they'll delay the decision.

Each belief supports the next one.

Miss one, and the ladder collapses.

Belief #1 – Pain

"I have a problem that's preventing me from getting where I want to go."

This is where every sales conversation begins.

Many business owners know they're paying taxes.

Far fewer understand what those taxes are actually costing them.

Your job isn't to tell them they have a problem.

Your job is to help them discover it.

Instead of saying:

"We can reduce your taxes."

Ask:

"What made you book this call today?"

"What concerns you most about your current tax situation?"

"Walk me through how tax planning is currently handled."

"When was the last time someone proactively brought you opportunities before year-end?"

"What happens today if you have a major tax question?"

"What frustrates you most about your current approach?"

Don't settle for:

"I think I pay too much."

Go deeper.

"What makes you say that?"

"When did you first start feeling that way?"

"What happened?"

"How has that affected the business?"

Every answer should uncover another layer.

Pain isn't created.

It's uncovered.

Belief #2 – Doubt

"I can't solve this problem by continuing to do what I'm doing."

This is where many advisors accidentally sabotage themselves.

They immediately become the hero.

Instead, allow the prospect to recognize why their current approach hasn't worked.

Ask:

"What have you tried so far?"

"How has that worked?"

"What prevented those strategies from producing the result you wanted?"

"What has your current CPA done proactively?"

"When was the last time they presented multiple tax-saving opportunities before you asked?"

"If nothing changes, what makes you believe next year will be different?"

These questions create an important realization.

The problem isn't simply taxes.

The problem is the current system.

Once someone realizes their existing approach isn't producing the outcome they want, they're naturally open to a different one.

Belief #3 – Cost

"Doing nothing will cost me far more than fixing the problem."

This is one of the most powerful beliefs in sales.

People naturally compare your investment against keeping their money.

Your job is to help them compare it against what they're losing every year.

Ask questions like:

"What do you estimate unnecessary taxes have cost you over the last five years?"

"If nothing changes over the next three years, what do you think that number looks like?"

"What opportunities have you delayed because that money wasn't available?"

"If you had another $300,000 available, where would it go?"

"How would that change the business?"

Maybe they'd hire another salesperson.

Open another office.

Acquire another company.

Invest in equipment.

Buy investment property.

Spend more time with family.

The investment isn't competing against your fee.

It's competing against the cost of staying the same.

Belief #4 – Desire

"Life would be significantly better if this problem were solved."

Business owners don't buy tax strategies.

They buy the future those strategies create.

This is where you help them emotionally connect with the outcome.

Ask:

"If we solved this perfectly, what would change?"

"What would having significantly more cash flow allow you to do?"

"What goals become possible?"

"How would your business look three years from now?"

"What would that mean for your family?"

"What would that feel like?"

Don't paint the picture for them.

Let them paint it.

People believe their own vision more than yours.

Belief #5 – Money

"I have the ability and willingness to invest in solving this problem."

Money objections usually aren't money problems.

They're value problems.

Before discussing investment, understand their relationship with investing.

Ask:

"When you invest in your business, how do you typically evaluate those decisions?"

"Have you made significant investments into growth before?"

"What made those worthwhile?"

"If solving this problem produced a strong return, would making the investment be the difficult part—or deciding who to trust?"

Those questions reveal whether the real issue is finances or confidence.

Remember:

Successful business owners invest every day.

The question isn't whether they spend money.

The question is whether this feels like a worthwhile investment.

Belief #6 – Support

"The people who matter most will support this decision."

Many advisors wait until the end to hear:

"I need to talk to my spouse."

By then it's often too late.

Discover this early.

Ask:

"When you make larger business decisions, who else is typically involved?"

"Who would want to be part of this conversation?"

"What would they need to see to feel comfortable?"

"Have the two of you talked about solving this before?"

If another decision-maker exists, include them whenever possible.

Never make someone sell your recommendation for you after the call.

Belief #7 – Trust

"This advisor and this process are different from what I've experienced before."

Almost every successful business owner has worked with accountants before.

Many have heard promises before.

Some have been disappointed.

Don't ignore that.

Explore it.

Ask:

"What has your experience with previous advisors been like?"

"What did you wish they had done differently?"

"What frustrated you the most?"

"What would an ideal advisory relationship look like?"

Only after understanding those experiences should you explain your process.

Don't simply tell them you're proactive.

Show them.

Don't tell them you're different.

Demonstrate why.

Trust isn't built through claims.

It's built through understanding.

The Power of Socratic Selling

Notice something about every belief.

None of them were taught.

They were discovered.

That's the difference between average salespeople and elite advisors.

Average advisors tell.

Elite advisors ask.

Instead of saying:

"You need proactive tax planning."

Ask:

"How proactive has your current planning actually been?"

Instead of saying:

"This is costing you money."

Ask:

"What do you think waiting another three years would cost?"

Instead of saying:

"You need to invest."

Ask:

"What would solving this be worth if it allowed you to keep an additional $500,000 over the next few years?"

The conclusion is far more powerful when it comes from them.

Why This Works

Human beings naturally want to remain consistent with what they've already said.

If a business owner tells you:

"My current CPA isn't proactive."

"This problem is costing me hundreds of thousands."

"I can't keep operating this way."

"I want to grow."

"I have the capital to invest."

"My wife supports making smart business investments."

"I believe your approach is different."

Then the decision to move forward becomes consistent with everything they've already concluded.

You didn't convince them.

You simply helped them organize their own thinking.

The Advisor's Job

Your job is not to pressure.

Not to manipulate.

Not to overcome objections.

Your job is to help successful business owners think more clearly than they ever have about one of the most expensive problems in their business.

When they fully understand:

The problem.

Why it exists.

What it's costing them.

What life looks like after it's solved.

Why their current approach won't get them there.

Why they can invest.

Why they can trust you.

Then the sale stops feeling like a sales process.

It feels like the obvious next business decision.

That's what great tax advisors do.

They don't sell tax strategies.

They guide business owners to the conclusion that protecting and growing their wealth is one of the highest-return investments they can make.`,
    },
    {
      loomId: "c782ed8ebf244d21bc8c63e39f5f2f7d",
      content: `How Elite Tax Advisors Control the Conversation

Great sales conversations aren't about talking more.

They're about leading better.

The best tax advisors don't sound like salespeople—they sound like trusted professionals. Every question, every pause, and every response has a purpose.

Use the Power of Silence

One of the biggest mistakes advisors make is talking too much.

Ask your question, then stop.

Give the prospect time to think. Don't interrupt the silence just because it feels uncomfortable.

When they finish answering, wait another 2-3 seconds before speaking.

Many prospects will continue talking, and that's often where the most valuable information comes out.

Silence communicates confidence, patience, and genuine interest.

Control Your Pace and Tonality

Your voice often builds trust before your words do.

Speak slower than you think you need to.

Project confidence without sounding aggressive.

Finish your statements with certainty rather than sounding unsure.

Most importantly, match the emotional state of the prospect.

If they're frustrated, show genuine concern.

If they're excited about growth, let your energy naturally rise.

Imagine you're speaking to someone you genuinely care about who needs your help—not someone you're trying to sell.

Gather Information Like a Doctor

Never assume you know the full story.

Even if it's written on the application, ask them about it.

Applications give you facts.

Conversations give you context.

Always begin with the problem.

"What made you book this call?"

"What are you hoping to solve?"

From there, continue asking questions until you fully understand the situation before offering advice.

Diagnose first. Prescribe second.

Ask One Question at a Time

Keep your questions short and focused.

Don't stack multiple questions together.

Instead of asking three questions at once, ask one, listen carefully, then ask the next.

Simple questions create better conversations.

Build Rapport Through Understanding

Real rapport isn't built by talking about sports or making small talk.

It's built by making people feel heard.

Listen carefully.

Be curious.

Remember what they tell you.

When people feel understood, they naturally begin to trust you.

Set the Frame Early

At the beginning of every call, explain what will happen.

For example:

"I'd like to spend some time understanding your business, your goals, and what's getting in the way. If I believe we can genuinely help, I'll show you what that would look like. If I don't think we're the right fit, I'll tell you that too. Sound fair?"

This positions you as an advisor instead of a salesperson.

Stay in Leadership

Your job isn't to control the prospect.

Your job is to control the conversation.

If they go off track, respectfully guide them back.

Lead with curiosity.

Listen with intention.

Ask questions with purpose.

When you fully understand the problem, your recommendation becomes the obvious next step—not a sales pitch.`,
    },
    {
      loomId: "551ac771d1b34fc6826f1b82b8718a9d",
      content: `Building Trust Through Empathy and Understanding

People don't buy because you have the best solution.

They buy because they trust you.

Before a business owner invests in your firm, they need to feel like you truly understand their business, their challenges, and where they want to go.

Your job isn't to impress them.

Your job is to understand them.

Listen More Than You Talk

The best advisors spend more time listening than speaking.

Don't listen just to respond.

Listen to understand.

Pay attention to their words, their emotions, and what's important to them.

When they finish speaking, summarize what you heard.

For example:

"So if I'm understanding correctly, your biggest frustration isn't just paying taxes—it's that you don't feel like your CPA has been proactive. Is that right?"

This shows you're listening and builds trust.

Ask Better Questions

Don't ask questions that can be answered with "yes" or "no."

Ask questions that encourage the prospect to open up.

Instead of:

"Are you happy with your CPA?"

Ask:

"Tell me about your experience with your current CPA."

Then keep digging.

Ask:

"Why is that important?"

"Tell me more."

"How has that affected the business?"

The deeper you understand the problem, the easier it is to recommend the right solution.

Connect Your Solution to Their Goals

Don't give the same pitch to everyone.

Use what they've already told you.

If they want more cash flow, explain how your process creates more cash flow.

If they want to grow faster, explain how keeping more money in the business helps them expand.

Always connect your recommendation to their specific goals—not generic features.

Use Stories, Not Just Facts

Stories help prospects see what's possible.

Share examples of clients who were in a similar situation, what challenges they faced, and the results they achieved.

People remember stories because they can picture themselves getting the same outcome.

Solve the Problem Together

Don't make the conversation feel like a sales pitch.

Make it feel like you're working together to solve a business problem.

Use phrases like:

"Based on what you've shared..."

"Here's what I believe is happening..."

"If I were advising you as a client..."

This positions you as a trusted advisor instead of a salesperson.

Build Trust Before Asking for Commitment

Trust is built throughout the conversation—not at the end.

Be honest.

Be curious.

Provide value before asking for anything.

If you're not the right fit, say so.

Ironically, that's one of the fastest ways to build credibility.

Remember

People may forget what you said.

But they'll never forget how you made them feel.

If they leave the call thinking,

"This is the first advisor who truly understood my business,"

you've already done the hardest part of the sale.`,
    },
    {
      loomId: "bea5565c35f34f60b1cfefd04a88951c",
      content: `The Tax Advisory Discovery Framework

The quality of your discovery determines the quality of your close.

Your goal isn't to ask every question on a checklist.

Your goal is to fully understand the prospect's business, uncover the real problem, and help them realize why solving it matters.

Think like a doctor.

Diagnose first.

Prescribe second.

1. Isolate the Problem

Start every call by identifying the biggest challenge they're facing.

Ask questions like:

"What made you book this call?"

"What's your biggest challenge right now?"

"What's not working in your business?"

"Where do you feel stuck?"

Don't move on until you know the #1 problem they're trying to solve.

2. Go Deeper

The first answer is rarely the real problem.

Keep digging.

Use simple follow-up questions like:

"Tell me more."

"Why do you say that?"

"What do you mean by that?"

"How long has this been going on?"

"What's the most frustrating part?"

The goal is to understand both the facts and the emotions behind the problem.

3. Turn Stories Into Numbers

Business owners often speak in general terms.

Your job is to make the problem measurable.

Ask questions like:

"How many advisory clients did you sign last month?"

"How much tax did you pay last year?"

"How many opportunities do you think you've missed?"

"How much revenue are you generating today?"

Numbers make the problem real.

4. Widen the Gap

Help them understand how the problem is affecting other areas of their business and life.

Ask:

"How has this impacted the business?"

"What opportunities have you missed because of this?"

"How has this affected your family or personal life?"

"What's the worst part about it?"

The more they understand the impact, the more urgency they create for themselves.

5. Discover Their Vision

Once you've uncovered the problem, shift to the future.

Ask:

"What's your ultimate goal?"

"What would success look like?"

"If we solved this, what would that allow you to do?"

"How would your business be different?"

People don't buy tax strategies.

They buy the future those strategies create.

6. Create Doubt in Their Current Approach

Help them realize their current system isn't producing the result they want.

Ask:

"What have you tried so far?"

"Why do you think it hasn't worked?"

"What's stopping you from solving this on your own?"

"What would happen if nothing changed?"

You're not creating doubt in them.

You're creating doubt in their current process.

7. Understand Their Financial Situation

If you're recommending a premium solution, understand where they are financially.

Ask naturally:

"How is the business performing today?"

"How much profit are you keeping?"

"How much are you paying in taxes?"

"How are you currently investing back into the business?"

This isn't about qualifying them out.

It's about making the best recommendation for them.

8. Learn What's Been Tried Before

Find out what's worked—and what hasn't.

Ask:

"What have you tried before?"

"What did you like?"

"What didn't work?"

"What would you want done differently this time?"

This allows you to explain why your approach is different.

9. Increase Urgency

Help them understand the cost of doing nothing.

Ask:

"What happens if nothing changes?"

"Where will the business be in three years?"

"How much could this cost you if you wait?"

"Why is solving this important now?"

People rarely change until staying the same becomes more painful than changing.

10. Understand Their Why

Goals create direction.

Reasons create action.

Go beyond the numbers.

Ask:

"Why is that goal important to you?"

"What would reaching it mean for your family?"

"How would that make you feel?"

"What would it allow you to do that you can't do today?"

The stronger the reason, the stronger the commitment.

11. Identify Decision Makers

Don't wait until the end of the call.

Find out early who is involved.

Ask:

"Who else is involved in decisions like this?"

"Would anyone else need to be part of this conversation?"

"Are you able to make this decision today if it's the right fit?"

Alignment early prevents objections later.

12. Build Trust Before You Pitch

Before presenting your recommendation, make sure you've earned the right.

Summarize everything you've learned.

Confirm you understand their goals.

Answer any remaining questions.

Only then transition into your recommendation.

People don't buy because you gave a great presentation.

They buy because they believe you understand their business better than anyone else.

Remember

The best tax advisors don't ask more questions.

They ask better questions.

They don't rush discovery.

They don't pitch too early.

They listen.

They stay curious.

They uncover the real problem.

And by the time they present the solution, the prospect already believes it's the logical next step.`,
    },
    {
      loomId: "d8244b649066442ca7577d620aa4f826",
      // Confirmed to exist live, matching seed exactly. The handoff suggested
      // it might be placeholder content that was never in Skool. It is not.
      content: `The Commitment Phase

The commitment phase begins after you've presented your recommendation and before discussing the investment.

At this point, the business owner should understand:

Their current problem.

What's causing it.

What it's costing them.

What life looks like after it's solved.

How your process helps them get there.

Your job now is to increase certainty—not increase pressure.

There are three parts to every commitment phase.

1. Temperature Check

Before discussing the investment, check in with the prospect.

Don't assume they're ready.

Ask questions like:

"Based on everything we've covered, how are you feeling so far?"

"Do you feel like this is the solution you've been looking for?"

"Can you see how this would help you achieve the goals we discussed?"

"Is there anything you're still unsure about?"

This gives you valuable feedback before asking for a commitment.

It also gives the prospect an opportunity to voice concerns early instead of holding onto them until the end.

2. Explain What Happens Next

Business owners are more confident when they know exactly what to expect.

Walk them through the onboarding process at a high level.

For example:

"Once we get started, we'll first take a deep dive into your business, your current tax position, and your goals. From there, we'll build your custom tax strategy, implement the appropriate strategies, and work with you throughout the year to make sure you're proactively reducing taxes while staying compliant."

Keep it simple.

Don't overwhelm them with technical details.

Focus on the outcome and the process they'll experience.

Certainty creates confidence.

3. Present the Investment

If you've done a great job diagnosing the problem and presenting the solution, discussing the investment should feel natural.

Transition confidently.

For example:

"Now that we've covered exactly how we'll help you legally reduce your tax liability and build a long-term tax strategy, let's go over what the investment looks like."

State the investment clearly.

Don't apologize for your fee.

Don't rush through it.

Then stay quiet.

Give them time to think.

Confident advisors don't fill the silence.

Use Clarifying Questions Before Answering

One of the biggest mistakes advisors make is answering questions too quickly.

Instead, understand why they're asking.

For example, if they ask:

"How often do we meet?"

Don't immediately explain your meeting schedule.

Instead ask:

"That's a great question. Can I ask what made you ask that?"

You may discover they had a CPA who disappeared after tax season.

Now you can address the real concern instead of simply answering the question.

Find the Real Concern

Most questions have a deeper reason behind them.

Your job is to uncover it.

Ask questions like:

"Can you tell me more about that?"

"What makes that important to you?"

"Have you had a bad experience in the past?"

"Is there something specific you're concerned about?"

Once you understand the concern, your answer becomes far more valuable.

Stay in the Advisor Frame

Remember, you're not trying to convince someone to buy tax strategy.

You're helping them make an important financial decision.

Stay calm.

Stay curious.

Stay confident.

Continue leading the conversation like a trusted advisor.

When business owners feel understood and have certainty about the process, the investment becomes much easier to justify.

Remember

People don't invest because they were pressured.

They invest because they believe.

They believe:

You understand their business.

You understand their goals.

You have a clear plan.

You can help them legally keep more of what they earn.

When those beliefs are in place, moving forward feels like the obvious business decision—not a sales decision.`,
    },
    {
      loomId: "3533c9e73fe8461da075c064d5802d18",
      content: `One of the biggest mistakes tax advisors make is presenting their solution too early.

The moment a prospect tells them they're paying too much in taxes or aren't getting proactive advice, they immediately start explaining their services.

Don't.

At this point in the conversation, the prospect has shared their business, their frustrations, their goals, and why solving this problem matters.

They've become vulnerable.

They've started to trust you.

If you immediately jump into your pitch, you risk sounding like every other salesperson who's just waiting for their turn to talk.

Instead, pause.

Acknowledge what they've shared.

Then transition naturally.

For example:

"Based on everything you've shared, I genuinely believe we can help you accomplish what you're looking to achieve. Before I walk you through how we'd do that, does it make sense for me to show you what our process looks like?"

This keeps the conversation collaborative instead of feeling like a presentation.

Start With the Outcome

Don't begin by explaining tax strategies.

Start with the transformation.

Business owners don't buy entity structures, cost segregation, or tax planning.

They buy what those things allow them to achieve.

For example:

"Our goal is to help you legally keep more of the money you've worked so hard to earn, eliminate unnecessary taxes, and create a proactive tax strategy that supports the long-term growth of your business."

Lead with the destination.

Not the process.

Build the Bridge

Once they understand the outcome, explain how you'll get them there.

Keep it simple.

Three to five steps are enough.

Don't overwhelm them with technical details.

For example:

Step 1: We perform a complete review of your current tax situation and identify missed opportunities.

Step 2: We build a customized tax strategy based on your business, income, and long-term goals.

Step 3: We help implement those strategies throughout the year while providing proactive guidance so you're never reacting at tax time.

Each step should answer one question:

"Why is this different from what I'm doing today?"

Explain Why This Works

Don't just explain what you do.

Explain why previous approaches haven't worked.

For example:

"Most business owners only meet with their CPA after decisions have already been made. By then, many tax-saving opportunities are gone. Our approach is proactive, which means we're planning throughout the year—not simply reporting what already happened."

When you explain why your process is different, you naturally increase trust.

Keep It Simple

You don't need complicated names or fancy frameworks.

Clarity beats complexity.

The easier your process is to understand, the easier it is to believe.

Remember:

People aren't buying your process.

They're buying confidence that your process will get them the outcome they want.

The Goal of Your Recommendation

By the end of your presentation, the prospect should clearly understand:

What outcome they'll achieve.

Why your approach is different.

Why it fits their specific situation.

Why you're confident it will work.

If you've done a great job during discovery, your recommendation shouldn't feel like a sales pitch.

It should feel like the obvious solution to the problem they've already acknowledged.`,
    },
    {
      loomId: "c9e05d18065b42d58db73b8b144a68ff",
      content: `Our Stupid Simple 4-Step Sales Process

Every successful sales call follows the same four steps.

It doesn't matter how much experience you have or how many calls you've taken.

If you master these four steps, you'll naturally build trust, uncover the right problems, and position tax advisory as the obvious solution.

Everything we've covered in this training fits into these four steps.

Step 1: Find the Pain

Your first job is to identify the biggest problem the business owner is facing.

Don't assume you know it.

Ask questions until you uncover it.

Examples:

"What made you book this call?"

"What's your biggest challenge right now?"

"What's not working?"

"Where do you feel stuck?"

Your goal is to identify the one problem that matters most.

Step 2: Understand the Pain

Once you've identified the problem, don't move on.

Go deeper.

Understand how long it's been happening, what's causing it, what they've tried, and what it's costing them.

Ask questions like:

"Tell me more."

"Why do you think that's happening?"

"How has that affected the business?"

"What have you tried to fix it?"

"What happens if nothing changes?"

This is where you build urgency and trust.

The deeper you understand the problem, the more valuable your recommendation becomes.

Step 3: Connect the Pain to Their Goals

Now help them connect today's problem to tomorrow's opportunity.

Find out what they really want.

Examples:

"If we solved this, what would that allow you to do?"

"What's the ultimate goal?"

"How would your business look a year from now?"

"What would that mean for your family?"

Business owners don't buy tax strategies.

They buy more cash flow.

More freedom.

More growth.

More wealth.

Connect today's pain to tomorrow's outcome.

Step 4: Show Them How We Help

Only after you've fully understood their business should you explain your recommendation.

Don't overwhelm them with tax code or technical language.

Keep it simple.

Show them how your process solves the exact problems they described.

For example:

Step 1: We identify every tax-saving opportunity available.

Step 2: We build a customized tax strategy around your business and goals.

Step 3: We implement those strategies proactively throughout the year.

Step 4: We continue advising you so you're always making tax-smart business decisions.

Everything you present should tie directly back to what they told you during discovery.

The 7 Beliefs Fit Inside the 4-Step Process

The four-step process naturally builds the seven beliefs every prospect needs before they'll invest.

Step 1: Find the Pain

They believe:

"I have a real problem."

Step 2: Understand the Pain

They believe:

I can't keep doing what I'm doing.

This problem is costing me money.

Waiting only makes it worse.

Step 3: Connect the Pain to Their Goals

They believe:

Solving this changes my future.

The investment is worth it because of the outcome.

Step 4: Show Them How We Help

They believe:

This process is different.

I trust this advisor.

This is the right solution for my business.

Remember

Don't try to sell tax strategy.

Don't try to sell tax planning.

Don't try to sell your firm.

Instead...

Find the problem.

Understand the problem.

Connect the problem to their goals.

Show them how you'll help them achieve those goals.

That's it.

It's a simple process, but when done correctly, it creates trust, builds certainty, and allows the business owner to arrive at the decision themselves.

The best tax advisors don't make people buy.

They help business owners realize that protecting and growing their wealth is one of the smartest investments they can make.`,
    },
    {
      loomId: "21474fd715d34813bc9bb3903189dacb",
      content: `Objection Mastery

One of the biggest misconceptions in sales is that great closers are great at handling objections.

They're not.

Great advisors are great at preventing objections before they ever happen.

Almost every objection can be traced back to something that wasn't uncovered, addressed, or built during discovery.

If you thoroughly diagnose the problem, build trust, create urgency, and establish value, objections become much smaller.

Think of objections as missing beliefs—not reasons someone can't buy.

What Is an Objection?

An objection is simply a question or concern that prevents someone from feeling certain enough to move forward.

Most objections fall into one of these categories:

Trust

Value

Timing

Money

Decision makers

Uncertainty

Your job isn't to argue.

Your job is to understand what's really causing the hesitation.

Don't Defend. Discover.

When a prospect gives you an objection, don't immediately respond.

Get curious.

Ask questions like:

"Can you tell me more about that?"

"What makes you feel that way?"

"Is that your biggest concern?"

"Apart from that, is there anything else holding you back?"

The first objection is rarely the real objection.

Keep asking questions until you understand the root issue.

"I Need to Think About It"

This usually doesn't mean they need more time.

It usually means they need more certainty.

Instead of trying to convince them, ask:

"Absolutely, and what specifically would you like to think about?"

Or:

"When people tell me they want to think about it, it's usually because they're unsure about something. What would you say you're still uncertain about?"

Now you're solving the real problem.

"It's Too Expensive"

Money is rarely the real objection.

Most successful business owners invest in their business every year.

The real question is whether they believe the investment is worth the outcome.

Bring them back to what matters.

"Earlier you mentioned that unnecessary taxes are costing you hundreds of thousands of dollars every year. If we solve that, how would that impact your business?"

Always compare the investment to the outcome—not to the price.

"I Need to Talk to My Spouse or Business Partner"

This objection should never surprise you.

You should know early in the call who is involved in making decisions.

If it comes up, don't argue.

Simply ask:

"Is this about getting their approval, or is it about making sure they have the same information you have?"

If they're a true decision maker, invite them into the conversation.

Major financial decisions are best made together.

Build Trust Before You Need It

The easiest way to handle trust objections is to build trust throughout the call.

Listen more than you talk.

Understand before advising.

Share relevant client success stories.

Demonstrate expertise by asking great questions—not by giving long explanations.

Trust isn't built by telling people you're an expert.

It's built by showing them you understand their business.

Don't Chase Shoppers

Some prospects genuinely want the right advisor.

Others simply want the lowest price.

Don't compete on price.

Compete on value.

If someone is only shopping for the cheapest option, they're probably not your ideal client.

Stay confident in your recommendation and the value you provide.

Remember

Every objection is an opportunity to learn something you don't yet know.

Stay calm.

Stay curious.

Ask questions.

Listen carefully.

The better you understand the objection, the easier it becomes to resolve.

Great tax advisors don't win arguments.

They create enough certainty that objections naturally disappear.`,
    },
  ],
};

export const COURSE_CORRECTIONS: readonly CourseCorrection[] = [ONBOARDING, SALES_TRAINING];
