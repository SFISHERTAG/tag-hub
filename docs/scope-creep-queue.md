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
3. Vendor risk is uneven. ElevenLabs and HeyGen are stable, documented, and
   safe to integrate. Higgsfield and especially "OpenChatCut MCP" are the load
   bearing pieces of the automation claim and the least proven. The assembly
   step is what actually removes the editor; if it does not work, the pipeline
   degrades into "generate assets, then hand them to an editor anyway," which
   is the current SOP with extra subscriptions.

**On the economics as pitched.** The "$89-$109/mo replaces a $1,500-$3,000/mo
editor" framing undercounts. Someone still writes the prompts, reviews every
render, and rejects the bad ones, and that someone is the CSM whose time is not
free. The honest saving is per-variant marginal cost going to near zero, which
is the real prize, not the headcount line.

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

### Proposed disposition

Queued. Revisit after Epic 1 closes and Meta is verified live (4.2, 4.4, 5.6).
Run the manual creative test in parallel, since it needs no engineering time and it
is the input that decides whether this becomes an epic of its own (Epic 10; 7 through 9 are already drafted) or gets killed.

### If promoted, likely shape

- Two vendors first (ElevenLabs + HeyGen), not four. Ship script-to-avatar-clip.
- Reuse the existing cubby creatives model rather than inventing new storage;
  generated assets are just another creative source feeding campaign linkage.
- Assembly (Higgsfield, OpenChatCut) is a separate later story, gated on the
  first two proving out. Manual assembly in the interim is acceptable.
- Admin-side spend caps are not optional. Credit-metered vendors invoked from a
  CSM-facing button is an uncapped-cost surface by default.
