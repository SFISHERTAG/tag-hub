---
name: cubby_creatives_business_model
description: Cubby folder is client's creative submission space; alternative to paid actors
metadata:
  type: project
---

# Cubby Creatives Business Model

**What:** Cubby folder created at intake holds all client creatives — either DIY (client-submitted) or professional (from actor/production).

**Workflow:**
1. CSM creates cubby folder at intake for client
2. Client can submit own creatives (DIY path) OR
3. CSM orders actor creatives (paid path)
4. When actor creatives received:
   - Added to cubby folder
   - Opportunity moved to next stage
   - Fulfillment pipeline triggered
   - Slack notification sent to editor channel (with folder link)
   - Editor receives signal creatives are ready for editing

**Why:** Gives clients choice: DIY (cheaper) or professional talent (higher quality). Both paths flow through same cubby folder.

**How it applies to Phase 3:**
- Cubby = Single source of truth for all client creatives (DIY + actor)
- Phase 3 links all cubby creatives to Meta campaigns
- CSMs can see which assets (regardless of source) are driving performance

**Implications for Phase 3+:**
- All creatives in cubby get linked to campaigns automatically
- Could tag creatives as "client-submitted" vs. "actor-created" for comparison
- Performance analytics could show which source performs better
- Pipeline automation: New creatives in cubby → Auto-link to campaigns

**Related files:**
- `lib/dashboard/data-fetchers.ts` — Fetches all creatives from cubby (Google Drive)
- `lib/meta/creatives.ts` — Links all cubby creatives to campaigns
- Slack editor channel flow — Triggered by fulfillment pipeline when actor creatives received
