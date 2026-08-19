# Meta Business Manager + Marketing API — Live Launch Plan

**Owner:** Sam Fisher
**Prepared by:** Chief of Staff (Claude)
**Status:** Phase 2 complete — App + System User live, token verified against the Marketing API. Phase 3 (App Review for Full Access) not started.
**Business Portfolio ID:** `2499756636894332`
**Gates:** Epic 4 (4.1–4.6), Epic 5 (5.4–5.5), Epic 6 (6.1–6.5) — TAG Success Hub

**Token expiry — resolved 2026-08-16.** The first token Meta generated was a 60-day expiring token. Regenerated via the System User's Generate New Token screen with the "Never" expiration option — the Business was not, in fact, forced into expiring-only. New token confirmed non-expiring (`expires_at: 0` on `debug_token`) and the old 60-day token was revoked. No refresh job needed. Detail in Risks (marked resolved) and Phase 2 below.

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

## Phase 2 — App and System User — DONE (2026-08-16)

1. developers.facebook.com → My Apps → Create App. Meta has since moved to a use-case flow rather than an app "type" picker — used "Create & manage ads with Marketing API," connected to the existing TAG business portfolio at creation. App: `tag-hub-server`, App ID `1388576803228178`.
2. Marketing API use case attached automatically by the use case selection above (no separate "add product" step in the current flow).
3. BM Settings → Users → System Users → Add → `tag-hub-server`. **Role: Employee, not Admin.** Admin System User creation was blocked by Meta's anti-fraud rule ("Admin System User must be at least 7 days old before creating other Admin System Users") — this fires on Business Managers created within 7 days, regardless of whether it's the first System User. Employee role sidesteps it and is actually the better-scoped choice: the Hub's server code only needs API access to assigned assets, not Business Manager admin rights.
4. App asset assignment through the UI (System User → Add Assets → Apps) initially showed "No permissions available" — the app wasn't yet claimable as an asset for the System User through that picker. Resolved by installing the app directly via the Business Management API (`POST /{system-user-id}/applications` with `business_app` + a personal admin token from Graph API Explorer), which is the mechanism Meta's own docs describe as the actual install step underlying the UI.
5. Generated the System User token: scopes `ads_management`, `ads_read`, `business_management`, confirmed via `debug_token`. First attempt came back 60-day expiring; regenerated with the "Never" expiration option and got a non-expiring token instead. Old expiring token revoked immediately after cutover.
6. Ad accounts: done for 3 clients already partnered with TAG's Business Manager (visible under Business Settings → Partners before this work started — Money Problems Solved, Medori Tax & Advisory Group, Onestop.CPA). Business-level partnership existed but the System User itself wasn't individually assigned to their ad accounts — that's a separate step from the partnership (Business Settings → System Users → `tag-hub-server` → Add Assets → Ad Accounts). Once done, System User reaches 9 accounts total: 5 owned by TAG (TAG I–V) plus 4 client accounts across the 3 partnered businesses. Confirmed via `assigned_ad_accounts` and `client_ad_accounts`, both agree.

   **Superseded by Phase 2.5 below for every client going forward** — the "New clients repeat the Partners-page process" note that used to be here no longer applies. These 3 clients stay on the Partner model since it's already live for them; nothing forces a migration.

## Phase 2.5 — Client access model going forward: no Partner relationships (decided 2026-08-19)

**Decision:** no new client will be connected to TAG's Business Manager via Partner (business-to-business) sharing. The 3 existing partnered clients (Phase 2, step 6) are grandfathered — this only changes how *every client from here forward* is onboarded.

**The model:**
1. TAG accesses each client's Ads Manager directly, as a person — `support@taxadvisorygrowth.net`, logged in on desktop, 2FA to a cell phone (currently Austyn's; see the single-point-of-failure risk below, unchanged from before).
2. The client adds `support@taxadvisorygrowth.net` as a **Business Manager Admin** (Business Settings → Users → People → Add) — full Business Manager Admin, not ad-account-scoped Advertiser access. This is the entire client-side ask.
3. From that login, TAG creates a System User inside the *client's own* Business Manager, installs TAG's app (`tag-hub-server`, App ID `1388576803228178`) as an asset if it isn't already selectable, assigns the client's ad account and pixel to the System User, and generates the access token — the same mechanics as Phase 2 above, just performed inside the client's business instead of TAG's.

**Why this works without Partner sharing:** a System User created *inside* the client's own Business Manager has native access to that business's assets — no cross-business asset-sharing relationship is needed at all. Partner sharing was only ever required because Phase 2's System User (`tag-hub-server`) lives in *TAG's* Business Manager, not the client's.

**Engineering implication — not yet built:** `lib/meta/client.ts` currently initializes the Marketing API SDK once from a single global `META_SYSTEM_USER_TOKEN` env var, and the `Tenant` type (`lib/ghl/tenants.ts`) has no per-tenant token field — only `metaAdAccountId`/`metaBusinessId`/`metaPixelId`. Under this model, each client has *their own* token, so the Hub needs per-tenant token storage, not one shared secret. The codebase already has the right shape to copy: `lib/ghl/tokens.ts`'s tiered `resolveToken()` tries a location's own credential first and falls through otherwise — the same pattern applies here (try the tenant's own Meta token, fall back to TAG's shared System User token for the 3 grandfathered partnered clients). Tracked as open engineering work, not started.

**Client-facing instructions updated:** `functions/src/webhooks/phase3-meta-setup.ts`'s `getMetaAccessInstructions()` — previously told the client to grant access to a TAG-owned System User (the Partner model). Rewritten to ask for Business Manager Admin access instead.

**Operating manual updated:** `_archive/manual-content.json` §05 "Pre-launch gate" (regenerate `_archive/*.html` after any further edit — `node generate-manual.js` from `_archive/`) — the "Ad account access granted" checklist row now has a full note explaining this exact process for CSMs running a launch.

## Phase 3 — App Review for Full Access (Sam/Austyn submits; joint prep)

1. Build and exercise the integration against Limited Access first (TAG's own test account) to accumulate the 500-call/15-day threshold — this can happen automatically as Story 4.1's read calls (spend, delivery) come online.
2. Submit for Full Access once volume and error-rate thresholds are visibly met in the App Dashboard.
3. Submit Business Verification in parallel (Phase 1, step 4) — don't wait for Full Access eligibility to start this.

## Phase 4 — Engineering (unblocked — System User + token exist as of 2026-08-16 — I build this)

Maps directly to existing scoped stories, no new spec needed:

| Story | What it needs from Phase 1–3 |
| --- | --- |
| 4.1 System User + ad account access | Done — token live, 4 client ad accounts + 5 TAG-owned accounts assigned. New clients repeat Phase 2.6. |
| 4.2–4.6 Spend, funnel, ROAS, freshness, calendar | 4.1 complete |
| 5.2–5.3 Campaign template, launch preview | No Meta dependency — buildable now |
| 5.4 Create paused campaign via Marketing API | System User with `ads_management` |
| 5.5 Explicit activation | 5.4 |
| 5.6 Budget ceilings, idempotency | No Meta dependency — buildable now |
| 6.1 Duplicate-conversion audit | **Manual, not code.** Requires Meta Events Manager access per client. Must clear before 6.2–6.3 touch a live pixel. |
| 6.2–6.5 Conversion dispatch, monitoring | 6.1 green + System User |

---

## Risks and Mitigations

**Token expiry — resolved 2026-08-16.** First token generated was 60-day expiring. Regenerating via the System User's token screen with the "Never" option produced a non-expiring token (confirmed `expires_at: 0`) — the business was not actually forced into expiring-only, that was just what the first generation defaulted to. Old token revoked immediately after cutover. No refresh job needed.

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
