# Task 3 Implementation Guide — Client Onboarding Automation

**Status:** Built (code-ready, requires configuration)
**Last Updated:** 2026-08-12

## Overview

Two-phase client onboarding automation powered by GHL webhooks and Google Cloud Functions.

**Phase 1:** GHL checkbox + Closed Won → provision GHL sub-account, Slack channel, Drive folder, OTP access  
**Phase 2:** Intake form submission → create Google Doc, seed with intake data, prepare for human audit

## What's Been Built

### Cloud Functions (`/functions/`)

- **Phase 1 Handler** (`src/webhooks/phase1-provisioning.ts`)
  - Clone GHL account from template
  - Create Slack single-channel guest channel
  - Create Drive folder (Shared Drive)
  - Add to OTP whitelist
  - Create Fulfillment opportunity
  - Email GHL form link to client
  - Log to Firestore

- **Phase 2 Handler** (`src/webhooks/phase2-intake-submit.ts`)
  - Generate 4 content pieces from intake data using Gemini:
    - **UVP** — Unique Value Proposition (positioning statement)
    - **Ad Copy** — 3 VSL variations (30-second each)
    - **Pre-call Script** — Opener, positioning, questions, objections, close
    - **Project Charter** — Timeline, milestones, deliverables, success metrics
  - Create Google Doc in Drive folder
  - Seed with intake form data + generated content
  - Share with client (read-only)
  - Log completion

- **Utilities**
  - `ghl.ts` — GHL API calls (clone account, create opportunity, find locations)
  - `slack.ts` — Slack channel creation and guest invites
  - `google.ts` — Drive folder + Doc creation, sharing, tab management
  - `firestore.ts` — Tenant record, OTP whitelist, event logging
  - `email.ts` — Intake form and confirmation emails

### Hub Integration

- **Phase 2 Endpoint** (`app/api/onboarding/intake-submit/route.ts`)
  - Optional: receive form submissions via POST
  - Forwards to Cloud Function
  - Useful for testing and admin-triggered provisioning

## Configuration Checklist

### 1. Environment Variables

Create `.env.local` in `/functions/` with:

```bash
# GHL — Private Integration Token for "Template Do Not Delete" account
GHL_PIT=xoxb-...

# Gemini API (for UVP, ad copy, script, charter generation)
GOOGLE_GEMINI_API_KEY=<get from aistudio.google.com>

# Google Cloud
GOOGLE_CLOUD_PROJECT=tag-success-hub

# Google Drive — Shared Drive where client folders go
TAG_SHARED_DRIVE_ID=<get from Drive settings>

# Slack — Bot token with channels:manage, conversations:create
SLACK_BOT_TOKEN=xoxb-...

# Email
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=noreply@taxadvisorygrowth.com
MAIL_PASS=<app-specific password>
MAIL_FROM=noreply@taxadvisorygrowth.com

# URLs
HUB_URL=https://hub.taxadvisorygrowth.com
GHL_FORM_URL=<share link to intake form in TAG agency account>

# Notifications
TAG_TEAM_EMAIL=team@taxadvisorygrowth.com
```

Also add to Hub `.env.local`:

```bash
PHASE2_WEBHOOK_URL=https://us-central1-tag-success-hub.cloudfunctions.net/phase2-intake-submit
PHASE2_WEBHOOK_SECRET=<shared secret between Hub and functions>
```

### 2. Gemini API Setup

Phase 2 generates UVP, ad copy, scripts, and project charters using Google's Gemini API.

**Get API key:**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key
4. Add to `/functions/.env.local`: `GOOGLE_GEMINI_API_KEY=<key>`

### 3. GHL Setup

**Find the template account ID:**
```bash
# In GHL, go to Admin → Locations
# Find "Template Do Not Delete" and note its location ID
```

**Verify template contains Fulfillment pipeline:**
- The template must have a pipeline named "Fulfillment"
- Phase 1 creates opportunities in this pipeline

### 4. GHL Webhooks

Add two webhooks in GHL agency account (Admin → Webhooks):

**Phase 1 Webhook:**
- Name: `TAG Onboarding Phase 1`
- Event: Opportunity Updated
- URL: `https://us-central1-tag-success-hub.cloudfunctions.net/phase1-provisioning`
- Filters:
  - Custom field `Initiate Onboarding` = true
  - Stage = "Closed Won"
- Include in payload: opportunity, contact, custom fields

**Phase 2 Webhook (if using GHL form):**
- Name: `TAG Onboarding Phase 2`
- Event: Form Submitted
- Form: [Client Intake Form Name]
- URL: `https://us-central1-tag-success-hub.cloudfunctions.net/phase2-intake-submit`
- Include in payload: form response, contact email, opportunity ID

### 5. Slack Setup

**Create app in Slack workspace:**
1. Go to api.slack.com → Create New App
2. Choose "From scratch"
3. Name: "TAG Automation"
4. Workspace: TAG Slack

**Add scopes:**
- `channels:manage` — Create channels
- `conversations:create` — Create conversations
- `users:write` — Manage users
- `chat:write` — Post messages

**Get bot token:**
- Install app to workspace
- Copy Bot User OAuth Token (starts with `xoxb-`)

### 6. Google Cloud Setup

**Shared Drive for client folders:**
1. Create a Shared Drive named "TAG Clients" (or preferred name)
2. Share with `hub-app@tag-success-hub.iam.gserviceaccount.com` as Editor
3. Copy the Drive ID and set `TAG_SHARED_DRIVE_ID`

**Verify keyless delegation:**
- Service account: `hub-app@tag-success-hub.iam.gserviceaccount.com`
- Has roles: `Firestore Editor`, `Cloud Functions Developer`
- Domain-wide delegation already configured (reuse from existing Hub setup)

### 7. Firestore Index

Cloud Functions write to:
- `locations/{locationId}` — Tenant records
- `auth/otpWhitelist` — Client email whitelist
- `locations/{id}/provisioningLog/` — Event logs
- `locations/{id}/intakeData/` — Intake submissions

Ensure `auth/otpWhitelist` document exists:
```bash
db.collection("auth").doc("otpWhitelist").set({
  emails: [],
  updatedAt: new Date()
})
```

## Deployment

### Local Testing

```bash
cd functions
npm install
npm run dev

# In another terminal, test Phase 1:
curl -X POST http://localhost:8080/webhook/phase1 \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity": {"id": "opp123", "name": "Test Client", "stage": "Closed Won"},
    "contact": {"id": "con123", "name": "Jane Doe", "email": "jane@example.com"}
  }'
```

### Deploy to Cloud Functions

```bash
cd functions
npm run build

# Deploy Phase 1
gcloud functions deploy phase1-provisioning \
  --gen2 \
  --region=us-central1 \
  --runtime=nodejs22 \
  --entry-point=handlePhase1 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file=.env.local

# Deploy Phase 2
gcloud functions deploy phase2-intake-submit \
  --gen2 \
  --region=us-central1 \
  --runtime=nodejs22 \
  --entry-point=handlePhase2 \
  --trigger-http \
  --allow-unauthenticated \
  --env-vars-file=.env.local
```

## Testing Workflow

1. **Create a test opportunity in GHL:**
   - Pipeline: "Sales"
   - Stage: "Closed Won"
   - Contact: Your test email
   - Opportunity name: "Test - Acme Tax Advisory"

2. **Check the checkbox:**
   - Scroll to "Initiate Onboarding" custom field
   - Check it (this triggers the webhook)

3. **Monitor Phase 1:**
   - Watch for logs: `gcloud functions logs read phase1-provisioning`
   - Check Firestore: `locations/{newLocationId}` should have slackChannelId, driveFolderId
   - Check email: Intake form link should arrive

4. **Submit intake form:**
   - Client receives GHL form link in email
   - Fills it out
   - Submits (triggers Phase 2 webhook)

5. **Monitor Phase 2:**
   - Watch logs: `gcloud functions logs read phase2-intake-submit`
   - Check Drive: New folder + doc should exist
   - Check Firestore: `locations/{id}.googleDocId` should be populated

## Human Audit Workflow

After Phase 2 completes, the Google Doc already contains:

**Auto-Generated Sections (Gemini):**
- **INTAKE DATA** — Client's form answers
- **UNIQUE VALUE PROPOSITION** — Positioning statement (2-3 sentences)
- **AD & VSL COPY** — 3 variations of 30-second ad copy
- **PRE-CALL SCRIPT FOR CLOSERS** — Complete opener, positioning, questions, objection handling, close
- **PROJECT CHARTER & TIMELINE** — 90-day plan, milestones, deliverables, success metrics

**Human Review & Customization:**

1. **Notification arrives** in `TAG_TEAM_EMAIL` with:
   - Client name, email
   - GHL location ID
   - Drive folder + doc links
   - Slack channel

2. **Open the Google Doc and:**
   - Review auto-generated content for accuracy
   - Refine UVP for brand voice alignment
   - Customize ad copy for client's market
   - Adjust pre-call script tone/messaging
   - Update project charter timeline if needed
   - Add any missing deliverables or client-specific details

3. **Quality checks:**
   - Verify brand voice consistency (UVP, ad copy)
   - Check script for natural conversational tone
   - Ensure charter aligns with client's capacity
   - Confirm no internal jargon in client-facing sections

4. **Mark complete:**
   - Update Firestore: `locations/{id}.auditComplete = true`
   - Send client a Slack message: "Your onboarding doc is ready! [link]"
   - Share the doc with client (read-only) — already done by Phase 2, but confirm visibility

## Troubleshooting

### Phase 1 fails

**Check logs:**
```bash
gcloud functions logs read phase1-provisioning --limit=50
```

**Common errors:**
- `GHL_PIT not set` → Missing env var
- `Template account not found` → Check account name in GHL
- `Fulfillment pipeline not found` → Template doesn't have that pipeline

### Phase 2 fails

**Check logs:**
```bash
gcloud functions logs read phase2-intake-submit --limit=50
```

**Common errors:**
- `No Drive folder found` → Phase 1 didn't complete
- `TAG_SHARED_DRIVE_ID not set` → Missing env var
- Keyless delegation failed → Check service account permissions

### Firestore missing fields

If `auth/otpWhitelist` doesn't exist:
```bash
# Create via Firebase Console or CLI:
firebase firestore:import <backup> --import-in-progress
```

Or add manually in Firebase Console:
1. Create collection: `auth`
2. Create document: `otpWhitelist`
3. Set field: `emails` (array), `updatedAt` (timestamp)

## Next Steps

1. ✓ Code built and documented
2. [ ] Fill in `.env.local` with actual values
3. [ ] Set up GHL webhooks
4. [ ] Deploy to Cloud Functions
5. [ ] Test Phase 1 with a real Closed Won opportunity
6. [ ] Set up human audit workflow in Slack
7. [ ] Monitor provisioning log for errors
8. [ ] Iterate based on real data

## Files Created

```
/functions/
├── src/
│   ├── index.ts                    # Express app + route handlers
│   ├── ghl.ts                      # GHL API calls (clone, create opp, find location)
│   ├── slack.ts                    # Slack channel creation + invites
│   ├── google.ts                   # Google Drive/Docs + sharing
│   ├── firestore.ts                # Firestore writes (tenant, whitelist, logs)
│   ├── email.ts                    # Email sending (intake form, confirmations)
│   ├── gemini.ts                   # Gemini content generation (UVP, ad copy, script, charter)
│   └── webhooks/
│       ├── phase1-provisioning.ts  # Phase 1: GHL account, Slack, Drive, OTP, email
│       └── phase2-intake-submit.ts # Phase 2: Doc creation, Gemini generation, sharing
├── package.json                    # Dependencies (Cloud Firestore, Slack, Gemini, etc.)
├── tsconfig.json
├── .env.example                    # Template (includes GOOGLE_GEMINI_API_KEY)
├── .gitignore
└── README.md

/hub/app/api/onboarding/intake-submit/route.ts  # Hub endpoint for Phase 2 (optional)

/IMPLEMENTATION_GUIDE.md            # Full setup + deployment guide
```

## Questions/Decisions Still Open

- [ ] Confirm GHL form integration (is form already built, where does it live?)
- [ ] Should Phase 2 auto-trigger on form submit or manual trigger?
- [ ] Who approves UVP before client sees it (human, then share-publish flow)?
- [ ] Should provisioning log appear in Hub admin dashboard?
- [ ] Should there be a "resend form" button if client doesn't submit?
