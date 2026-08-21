# Scope creep queue

Ideas raised mid-build that are not the current thread of work. Each entry gets
an honest read: genuine scope creep, or a smart addition worth pulling forward.
Nothing here is started until it is argued and promoted into `docs/epics.md`.

Status values: `Queued` · `Promoted` · `Killed`

---

## SC-001: AI video production pipeline (avatar ads + VSL, no human editor)

**Raised:** 2026-08-19
**Status:** Queued
**Size:** New epic. Roughly Epic 5 scale, with four new external vendors.

### The ask

Replace the current creative SOP (write offer angle and copy -> client films or
a $500-$1,000 Fiverr spokesperson is hired -> ship to a human editor) with a
generation pipeline living inside TAG Hub, driven by the CSM and configured by
Admin. Proposed vendor chain:

- ElevenLabs: professional voice clone, produces the vocal stem
- HeyGen: avatar (digital twin or stock corporate actor), lip-synced to that stem
- Higgsfield: generated 4K B-roll and overlays keyed off script keywords
- OpenChatCut / ChatCut: automated multi-track assembly, silence removal, captions

Output lands in storage, gets pushed to Meta Ads as a paused creative variant,
notifies Slack, and moves the GHL opportunity stage.

Target use: DTC ad hooks, long-form VSL, and pre-call trust video for the tax
advisory offer (individuals who paid $100k+ in taxes).

### Read: genuine scope creep, but it sits on a real gap

**Argument for pulling it forward.** Epic 5 already creates paused Meta
campaigns from a per-offer template (5.2, 5.4, 5.5). The input it does not have
is the creative. Today that input is a human bottleneck measured in days and
$500-$1,000 per asset, and it is the single step in the launch path that TAG
Hub does not touch. An offer-angle-to-paused-creative path is the natural
upstream of work that is already built, not a side quest. The variant-count
argument is also real: one Fiverr asset buys one hook, and a $100k-tax audience
splits into at least three distinct angles (e-com founder, agency owner, W2
executive) that each want their own hook.

**Argument against starting now.** Three things:

1. The foundation is not closed. 1.2 is blocked on GHL account consolidation,
   1.6 is in progress, 1.7 is Ready but not deployed. On the Meta side 4.2 is
   blocked on credentials that are nominally live, 4.4 is explicitly not Done,
   and 5.6 is unit-tested only against a mocked Meta client. Adding four
   unverified vendor integrations on top of one unverified vendor integration
   compounds the failure surface rather than reducing it.
2. The pasted blueprint does not match this codebase. It assumes Angular plus
   Firebase Cloud Functions. This app is Next.js app-router on Cloud Run with
   Postgres, and the standing rule is that new endpoints go in `app/api`, not
   `functions/`. Every payload and handler in that plan needs rewriting before
   it is usable here. Do not treat it as a spec.
3. Vendor risk is uneven, and the 2026-08-20 verification below confirms it.
   ElevenLabs and HeyGen have real, publicly priced, key-authenticated APIs.
   Higgsfield and ChatCut do not, and they are the load bearing pieces of the
   automation claim. The assembly step is what actually removes the editor; if
   it does not work headlessly, the pipeline degrades into "generate assets,
   then hand them to an editor anyway," which is the current SOP with extra
   subscriptions.

**On the economics as pitched.** The "$89-$109/mo replaces a $1,500-$3,000/mo
editor" framing is wrong twice. First, someone still writes the prompts, reviews
every render, and rejects the bad ones, and that someone is the CSM whose time
is not free. Second, and confirmed below, those figures are consumer seat
prices for a use case that requires API access, and on HeyGen the two are
entirely separate billing pools. The honest saving is per-variant marginal cost
collapsing, which is the real prize, not the headcount line.

### Cheapest test before any code

This has a zero-engineering version. Buy HeyGen Creator plus ElevenLabs Creator
(about $51/mo), have one CSM produce two or three avatar hooks by hand, and run
them against the current Fiverr-spokesperson creative on the same audience.
Compare CPL and booked-call rate. If avatar creative holds up, the pipeline is
worth an epic. If it does not, one month of subscriptions bought the answer and
no code was written.

Note the transcript's own caveat, which is worth keeping: avatar for
top-of-funnel ad hooks is low risk, avatar for the long-form pre-call trust
video is high risk with a skeptical high-net-worth audience. The manual test
should cover the ad hook only.

### Verified API pricing, 2026-08-20

Checked against vendor pricing pages and developer docs directly. Every number
below was read off the source, not a review site.

| Vendor | Programmatic access | Billing unit | Entry cost | Publicly priced |
| --- | --- | --- | --- | --- |
| ElevenLabs | API key | per 1K characters | $0.10 / 1K chars (TTS v3) | Yes |
| HeyGen | API key (`x-api-key`) | per second of output | $0.0667 / sec (Avatar IV digital twin) | Yes |
| Higgsfield | MCP + account auth, no API key | plan credits | $19/mo Starter, 270 credits | Plan only, no per-unit rate |
| ChatCut | CLI with stored key, no REST API | credits | $0.25 / credit, $25/mo floor | Yes |

**Three findings that change the plan.**

*HeyGen's API wallet is separate from its web plan credits.* The docs are
explicit: MCP usage draws on the web plan's premium credits, while API key
usage draws on a prepaid API wallet, and "the two billing pools are
independent." The $29/mo Creator plan in the original pitch buys nothing for a
backend integration. API access is prepaid pay-as-you-go from $5, with no
subscription. Avatar IV digital twin runs $4.00 per minute of output against
roughly $1.00 per minute of equivalent consumer plan allowance, so programmatic
access is about four times the seat price for the premium engine. Avatar III at
$0.0167/sec ($1.00/min) is the cheap path if fidelity allows.

*The ElevenLabs to HeyGen handoff works.* `POST /v3/videos` accepts `audio_url`
or `audio_asset_id` to drive lip sync, mutually exclusive with `script`. This
was the single question that could have killed the two-vendor core, and the
answer is yes. HeyGen also exposes a native `engine_type: "elevenlabs"` in
`voice_settings`, so there are two viable routes. Two incidental wins: the
endpoint takes an `Idempotency-Key` header, which matches the pattern Story 5.6
already establishes, and it supports `callback_url` webhooks rather than
requiring polling.

*Neither automation vendor has a headless API.* Higgsfield's own FAQ answers
"Do I need an API key?" with "No" and routes everything through MCP with
interactive account authentication, billed against consumer plan credits. That
is a poor fit for an unattended Cloud Run backend, which is the same
constraint this project already hits with interactively-authenticated MCP
servers in headless runs. ChatCut has no public REST API at all. Its interface
is the `@chatcut/skill` npm CLI, which needs Node 18+, transcodes locally,
blocks for up to 40 minutes per job, and obtains a long-lived key only after a
PKCE browser sign-in. It is containerizable with a stored key, but it is a CLI
dependency, not an API.

*"OpenChatCut" does not exist.* The product is ChatCut at chatcut.io. The
`assemble_timeline` MCP payload in the source material was fabricated, along
with the `mcp.higgsfield.ai` assembly role. Higgsfield's MCP endpoint is real;
the timeline assembler described alongside it is not.

**One genuinely favorable surprise.** ChatCut charges credits only for AI
generation. Cutting, trimming, captions, transcript editing, and MP4 export are
free on every plan, including free. The assembly step, the thing that actually
replaces the editor, has no marginal cost. It only bills when it generates new
footage.

### Corrected cost model

One 30-second vertical ad, roughly 75 words of script, ElevenLabs voice driving
a HeyGen avatar, plus two 5-second generated B-roll clips, assembled and
exported.

| Line | Cost |
| --- | --- |
| ElevenLabs TTS, ~450 chars | $0.05 |
| HeyGen Avatar IV digital twin, 30 sec | $2.00 |
| B-roll, 10 sec generated (ChatCut, 6 credits) | $1.50 |
| Assembly, captions, export | $0.00 |
| **Marginal cost per ad** | **~$3.55** |

Dropping to the Avatar III engine takes the avatar line to $0.50 and the ad to
roughly $2.05.

At volume, including the ElevenLabs Creator floor of $22/mo that professional
voice cloning requires:

- 20 ads/month: about $92 total ($22 ElevenLabs + $40 HeyGen + ~$30 ChatCut)
- 100 ads/month: about $372 total ($22 + $200 + $150)

One-time: $1.00 per digital twin creation call.

Set against $500 to $1,000 per Fiverr asset, 20 ads a month is roughly $92
against $10,000 to $20,000. Even with the corrected, higher API figures the
economics are not close. The original pitch was wrong about the price and still
understated the advantage, because it compared subscription to subscription
instead of marginal cost to per-asset cost.

### Production workflow, if promoted

Raised 2026-08-20: have the client film their own source material, then rewrap
it as an avatar of themselves or another presenter, with motion control.

This is the strongest idea in the proposal and it is not only a cost measure.
It answers the objection that sank the avatar approach for long-form: a
skeptical high-net-worth viewer who detects a synthetic presenter mid-VSL
leaves the page. Filming the actual accountant once means the trust-critical
assets keep a real human on screen and only the words change. It also needs no
new storage concept, since client-filmed footage already flows through the
cubby creatives model this project uses for DIY and actor material.

One filming session feeds two render paths, and the choice between them is made
per asset type rather than by preference:

```
                          +-- trains twin, $1.00 once -->  [ Avatar V twin ]
                          |                                $0.0667/sec        --> 9 ad hooks (30s)
  [ Client films once ]---+                                synthetic delivery
    about 30 min usable   |
                          +-- re-voiced, not rebuilt --->  [ Lip sync ]
                                                           $0.0333/sec        --> 1 VSL + 3 pre-call
                                                           real body language

  Voice cloned once from the same session drives both paths.
  Both converge on assembly and export, which has no marginal cost.
```

**Sequence.**

1. Film once, at least 30 minutes. The 30-minute floor is not arbitrary: it is
   what ElevenLabs professional voice cloning wants, so the same session
   doubles as voice training data and as lip sync source.
2. Clone the voice once. Requires the ElevenLabs Creator tier at $22/mo, the
   only recurring floor in the stack.
3. Create the digital twin once, $1.00 against the HeyGen API wallet. Needed
   only for the synthetic path.
4. Per angle, write the script and generate the voice track. A 30-second hook
   costs about five cents to voice.
5. Route by asset type. Ad hooks render as the twin, where volume matters and
   the viewer has three seconds of exposure. VSL and pre-call videos take lip
   sync on real footage, where a detected fake costs the booking.
6. Assemble, caption, export. No marginal cost.
7. Hand off to the existing launch path: paused Meta creative variant, Slack
   notification, GHL stage update. Stories 5.4 and 5.5 already do this. The
   pipeline only supplies the missing input.

**A full A/B suite for one offer.** The test variable is the hook, held against
a constant audience, so trust assets are produced per audience rather than per
hook.

| Asset | Count | Length | Path | Cost |
| --- | --- | --- | --- | --- |
| Ad hooks | 9 | 30 sec | Avatar V twin | $18.01 |
| Pre-call trust video | 3 | 2 min | Lip sync | $11.99 |
| Long-form VSL | 1 | 10 min | Lip sync | $19.98 |
| Voice, whole suite | | 20.5 min | ElevenLabs | $1.78 |
| Digital twin | 1 | once | HeyGen | $1.00 |
| B-roll | | 400 sec | Generated | $60.00 |
| Assembly and export | 13 | | ChatCut | $0.00 |
| **13 assets** | | | | **$112.76** |

Excludes the filming session, which costs the accountant a morning rather than
cash. The same suite through the current SOP, at $500 to $1,000 per
spokesperson asset, is $6,500 to $13,000 and several weeks of turnaround.

**Two things this costing changed.**

*The rewrap path is cheaper than the avatar path, not only safer.* Lip sync on
real footage is $0.0333/sec against $0.0667/sec for an Avatar V twin. Keeping
the real accountant on screen for the trust assets costs half what fabricating
them does. The trust argument and the cost argument point the same way.

*B-roll is the dominant line, not avatar generation.* At $60.00 it is 53
percent of the suite. The original proposal assumed avatar seconds would
dominate. They do not, and it is not close. B-roll volume is the cost lever to
watch.

**The motion control caveat.** HeyGen rejects the `motion_prompt` field for
video avatars on the default Avatar IV engine. Driving body motion and hand
gestures on a digital twin requires Avatar V at $0.0667/sec, which forecloses
the Avatar III path at $0.0167/sec. Motion control is a four-times cost
decision, not a free toggle. At nine hooks it is a $13 difference and worth
taking. At three hundred hooks it is not automatic.

**This section describes how it would work, not a commitment to build it.**
SC-001 stays Queued. Writing the workflow down does not promote it.

### Open questions not yet answered

- What consent or verification HeyGen requires before building a digital twin
  of a real person. Not checked, and it gates using the actual accountant.
- Whether Avatar III fidelity is acceptable for paid social, since it is a
  quarter the price of Avatar IV.
- HeyGen API rate limits and concurrency on the pay-as-you-go tier.
- Whether the HeyGen API wallet hard-stops or auto-tops-up on exhaustion. This
  is the uncapped-cost question and it matters before any CSM-facing button.

### Proposed disposition

Queued. Revisit after Epic 1 closes and Meta is verified live (4.2, 4.4, 5.6).
Run the manual creative test in parallel, since it needs no engineering time and it
is the input that decides whether this becomes an epic of its own (Epic 10; 7 through 9 are already drafted) or gets killed.

### If promoted, likely shape

- Two vendors only: ElevenLabs plus HeyGen. Both have real key-authenticated
  APIs and public per-unit pricing. Ship script-to-avatar-clip and stop there.
- Have the client film 30 minutes of source once. It trains the voice, trains
  the twin, and supplies lip sync footage for the trust-critical assets.
- Drop Higgsfield entirely. No API key, no per-unit pricing, interactive auth.
  It buys generated B-roll that ChatCut also generates, at a worse integration
  cost.
- Treat assembly as manual for now. ChatCut's editor is free to use and its CLI
  is a later option if the first two prove out. Do not design a backend around
  a 40-minute blocking CLI before the avatar step has earned it.
- Reuse the existing cubby creatives model rather than inventing new storage;
  generated assets are just another creative source feeding campaign linkage.
- Use HeyGen's `Idempotency-Key` and `callback_url` rather than inventing new
  patterns. Both line up with what Stories 5.6 and 6.5 already do.
- Admin-side spend caps are not optional. A prepaid wallet invoked from a
  CSM-facing button is an uncapped-cost surface until the auto-top-up question
  above is answered.
