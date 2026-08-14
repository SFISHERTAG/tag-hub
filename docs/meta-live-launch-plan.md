# Meta Business Manager + Marketing API — Live Launch Plan

**Owner:** Sam Fisher
**Prepared by:** Chief of Staff (Claude)
**Status:** Phase 1 complete — Business Manager set up. Phase 2 (App + System User) next.
**Business Portfolio ID:** `2499756636894332`
**Gates:** Epic 4 (4.1–4.6), Epic 5 (5.4–5.5), Epic 6 (6.1–6.5) — TAG Success Hub

---

## Outcome

Meta Business Manager is set up (Business Portfolio ID `2499756636894332`). Phase 1 is done. Next is Phase 2: create the Meta developer app and System User to produce the actual API token Story 4.1 needs. Every downstream capability — ROAS dashboard, in-Hub campaign launch, conversion dispatch — is still blocked until that token exists.

## Driver

Business Manager creation, system user setup, and App Review require actions only a TAG principal with authority over the business entity can take — business verification, phone/email confirmation, and accepting Meta's terms cannot be delegated to an engineering process or to me. Austyn holds the credentials. This has been sitting as a non-engineering blocker while the engineering work behind it (5.1–5.3, 5.6, most of 4.2–4.6) is already scoped and largely unblocked to build in parallel.

## Next Action

Sam or Austyn executes Phase 1 below (≈15 minutes of account setup) this week. Once the Business Manager exists, I can build the System User, permissions, and integration code in parallel with Meta's review clock, which is the slow part.

---

## What Changed in Meta's Process (as of May 2026)

Meta renamed and restructured the access-tier feature. Update any references before proceeding:

| Old term | Current term |
| --- | --- |
| Ads Management Standard Access (AMSA) | Marketing API Access Tier |
| Standard Access | Limited Access |
| Advanced Access | Full Access |

Limited Access covers apps operating on assets they own/admin — sufficient for initial development against TAG's own test ad account. **Full Access is required to manage client ad accounts in production** and requires App Review plus Business Verification.

Full Access qualification (lowered May 4, 2026): **500+ Marketing API calls in the trailing 15 days, error rate under 15% across the last 500 calls.** No screen recording required anymore; the App Dashboard now shows live progress against both thresholds. Business Verification is a separate, mandatory step for Full Access and typically takes a few business days once documents are submitted.

---

## Phase 1 — Business Manager (Sam/Austyn — requires explicit action, cannot be delegated)

From `docs/meta-bm-setup-for-austyn.md`, still accurate:

1. business.facebook.com → sign in with TAG's account → Create Business Manager (`TAG`).
2. Record the Business Manager ID.
3. BM Settings → Users → Add team members as Admin (lock down roles later).
4. Business Verification: submit under BM Settings → Security Center as soon as the BM exists — this is the long pole (few business days) and should start immediately, not after the app is built.

**Explicit permission checkpoint:** I will not attempt to create the Business Manager, register the app, or submit App Review myself. These are external-system, identity-bound actions per standing instructions. I'll build against the credentials once Sam/Austyn generate them.

## Phase 2 — App and System User (Sam/Austyn creates; I configure once access exists)

1. developers.facebook.com → My Apps → Create App → type "Business."
2. Add product: Marketing API.
3. BM Settings → Users → System Users → Add → name it (e.g., `tag-hub-server`) → role: Admin.
4. Generate a System User access token scoped to `ads_management`, `ads_read`, `business_management`. Long-lived, non-expiring while the System User exists — this is what the Hub's server-side code authenticates with (not a personal user token).
5. Assign the System User to each client ad account as a **partner** (client-owned account, TAG partner access — the model already documented in Story 4.1 as recommended). Each new client repeats this step; worth scripting or documenting as a repeatable onboarding task once the first one is done manually.

## Phase 3 — App Review for Full Access (Sam/Austyn submits; joint prep)

1. Build and exercise the integration against Limited Access first (TAG's own test account) to accumulate the 500-call/15-day threshold — this can happen automatically as Story 4.1's read calls (spend, delivery) come online.
2. Submit for Full Access once volume and error-rate thresholds are visibly met in the App Dashboard.
3. Submit Business Verification in parallel (Phase 1, step 4) — don't wait for Full Access eligibility to start this.

## Phase 4 — Engineering (unblocked once System User + token exist — I build this)

Maps directly to existing scoped stories, no new spec needed:

| Story | What it needs from Phase 1–3 |
| --- | --- |
| 4.1 System User + ad account access | System User token (Phase 2.4), partner access per client (Phase 2.5) |
| 4.2–4.6 Spend, funnel, ROAS, freshness, calendar | 4.1 complete |
| 5.2–5.3 Campaign template, launch preview | No Meta dependency — buildable now |
| 5.4 Create paused campaign via Marketing API | System User with `ads_management` |
| 5.5 Explicit activation | 5.4 |
| 5.6 Budget ceilings, idempotency | No Meta dependency — buildable now |
| 6.1 Duplicate-conversion audit | **Manual, not code.** Requires Meta Events Manager access per client. Must clear before 6.2–6.3 touch a live pixel. |
| 6.2–6.5 Conversion dispatch, monitoring | 6.1 green + System User |

---

## Risks and Mitigations

**Rate/access tier risk.** If Limited Access rate limits prove too low once multiple clients are polling spend concurrently, Full Access resolves it — budget the few-business-days review lag into the rollout timeline, don't discover it at launch.

**Duplicate conversions (Epic 6).** Story 6.1 is a hard gate, not a formality: if GHL's existing Zapier/webhook is already firing conversions to a client's pixel and the Hub adds its own, Meta's algorithm optimizes against inflated numbers — actively worse than the current no-data state. Do not enable 6.2–6.3 for any tenant until that tenant's pixel is audited green.

**Business Verification lag.** This is the true critical path, not the engineering. Start it the same day the Business Manager is created, in parallel with everything else.

**Single point of failure.** Austyn is currently the only one with Meta credentials. Phase 1 step 3 (add admins) exists specifically to remove this risk — don't skip it even under time pressure.

---

## Dependencies

- Blocked by: Austyn/Sam completing Phase 1–2 (external, non-engineering).
- Blocks: Epics 4, 5 (partially), 6 entirely.
- Does not block: Stories 5.1, 5.2, 5.3, 5.6 — buildable now, in parallel.

## Handoff

Sam: confirm who (Austyn vs. someone else) owns Phase 1 execution this week, and whether Business Verification documents (business registration, EIN, etc.) are ready to submit the same day the BM is created — that document gathering can start today, independent of everything else.
