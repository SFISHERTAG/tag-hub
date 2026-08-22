# Cowork prompt — GHL access outreach campaign

Hand the block below to Cowork verbatim. It builds the client outreach campaign
for obtaining authorized GHL access per client account.

## Context for whoever runs this

The ask splits by segment because the credential path splits by segment. See
`docs/stories/1.2-agency-oauth-install.md`. Segment A is reached by the
agency-level install and needs nothing from the client once consolidated.
Segment B is reached by the location-scoped direct install (tier 2 in
`lib/ghl/tokens.ts`) and needs one click from the client's Agency Owner.

**Gate before sending segment B:** `saveAgencyToken` writes to a single
Firestore document (`lib/ghl/store.ts`). An outside agency installing at company
level overwrites TAG's agency token and breaks every other client. Fix that
before inviting anyone outside TAG's agency to install. Segment A is unaffected.

**Open question that may change segment B's targeting:** the Agency Owner gate
is a recorded finding for agency-wide install. It has not been verified for the
location-scoped direct install. If a non-owner admin can complete that install,
segment B can be worked through an ops contact instead of the owner, which is a
materially easier campaign.

---

## The prompt

```text
You are helping TAG (Tax Advisory Growth), a marketing agency, run an outreach
campaign to its client base. TAG uses GoHighLevel (GHL) as its operational
platform and is launching a client hub that needs authorized access to each
client's GHL location.

## The situation

TAG has roughly 23 client accounts today, growing to a planned 40. They fall
into two segments, and the ask is DIFFERENT for each. Do not write one message
for both.

SEGMENT A - clients whose GHL account is, or is willing to become, a sub-account
under TAG's agency.
The ask: consolidate/transfer their account into TAG's agency.
Once done, there is no further action from them ever. Access is automatic.

SEGMENT B - clients who run their own GHL agency, or are entrenched with another
agency, and will not move.
The ask: their Agency Owner clicks a single install link that authorizes TAG's
app on one location they choose.
They keep their agency, their other apps, their other clients, and their data.
They can revoke at any time by uninstalling.

## Hard constraints that shape the messaging

1. In GHL, installing a marketplace app is an AGENCY OWNER action. An agency
   admin is refused. The segment B message must therefore reach the owner
   specifically, by name, and must make clear that delegating to an ops person
   will not work. Build the sequence around identifying and reaching that
   person.
2. TAG is NOT asking for passwords, API keys, logins, or any credential. Say
   this explicitly and early. The single most likely objection is that this
   sounds like a request for account access or a land grab.
3. TAG is NOT asking segment B to leave their current agency or change any
   existing relationship. Say this explicitly. This is the second most likely
   objection and it is the reason segment B exists as a separate segment.
4. Access is scoped to the one location the owner selects. Nothing else in
   their agency is visible to TAG.

## What I need you to produce

1. A segmentation worksheet: the questions TAG must answer per account to sort
   it into A or B, and how to find each answer. Include how to identify the
   Agency Owner for segment B accounts, since that is the gating unknown.
2. For each segment: an email sequence (initial plus two follow-ups) with
   subject lines, and a short SMS variant.
3. A call script for the TAG CSM, including the 30-second version, since some
   of these will be handled live rather than by email.
4. A one-page FAQ TAG can attach or link. It must directly answer: "Am I
   leaving my agency?", "What can TAG see?", "Are you asking for my login?",
   "Can I undo this?", "Why does it have to be me and not my team?"
5. An objection-handling table for the responses you expect.
6. A tracking plan: what TAG measures, and what the follow-up cadence is for
   non-responders.

## Tone and rules

- Corporate, concise, executive. Short sentences. No hype, no marketing filler.
- No em dashes anywhere.
- Use the word "client", never "member" or "customer".
- Lead with what the client gets, not with what TAG needs. If you cannot make
  the client benefit concrete, flag that and ask me for it rather than
  inventing one.

## Before you draft

Ask me for anything you need that is not above. At minimum I expect you to need
the specific client-facing benefit of the hub, who signs the outreach, and the
timeline TAG wants this completed by. Ask first, draft second.
```
