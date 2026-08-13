# TAG Automation — Cloud Functions

Zapier-replacement automation pipeline for TAG client onboarding. Two-phase provisioning with human audit.

## Architecture

### Phase 1: Resource Provisioning (GHL Webhook)

**Trigger:** GHL opportunity webhook when:
- Deal reaches "Closed Won" stage
- Custom checkbox field "Initiate Onboarding" is checked

**Actions:**
1. Clone GHL sub-account from "Template Do Not Delete" account
2. Create Slack channel (single-channel guest pattern)
3. Invite client to Slack as guest
4. Create Drive folder (in Shared Drive)
5. Add client email to OTP whitelist (TAG Success Hub sign-in)
6. Create new Fulfillment opportunity in cloned account
7. Email GHL intake form link to client
8. Notify TAG team of completion

**Output:** GHL location ID, Slack channel, Drive folder ready for next phase

### Phase 2: Document Creation & Content Generation (Form Submission)

**Trigger:** Client submits GHL intake form (via webhook or manual trigger)

**Actions:**
1. Read intake form data from GHL
2. Generate 4 content pieces using Gemini AI:
   - **UVP** — Unique Value Proposition (2-3 sentence positioning)
   - **Ad Copy** — 3 variations of 30-second VSL copy
   - **Pre-call Script** — Opener, positioning, questions, objection handling, close
   - **Project Charter** — Timeline, milestones, deliverables, success metrics (90-day view)
3. Create Google Doc in client's Drive folder
4. Seed doc with intake data + all 4 generated sections
5. Share doc with client (read-only)
6. Log completion

**Output:** Google Doc with intake + generated materials, ready for team review and client communication

### Human Audit Step

After Phase 2, a human reviews the doc:
- Adds Unique Value Proposition copy
- Customizes messaging for the client
- Completes any missing information
- Marks ready for client use

No automation here — intentional handoff for brand voice + quality.

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

**Key variables:**

- `GHL_PIT` — Private Integration Token for "Template Do Not Delete" account
- `GOOGLE_CLOUD_PROJECT` — `tag-success-hub`
- `TAG_SHARED_DRIVE_ID` — Shared Drive where client folders go
- `SLACK_BOT_TOKEN` — Bot token with `channels:manage`, `conversations:create` scopes
- `GHL_FORM_URL` — Link to intake form in TAG agency account

### 2. GCP Setup

Ensure the service account `hub-app@tag-success-hub.iam.gserviceaccount.com` has:

- ✓ Firestore Editor
- ✓ Cloud Functions Developer (for local dev, testing)
- ✓ Drive API access (via keyless delegation)
- ✓ Docs API access (via keyless delegation)

Keyless delegation already configured — no service account key needed.

### 3. Gemini API Setup

Phase 2 generates UVP, ad copy, scripts, and project charter using Google's Gemini API.

**Get API key:**
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy the key
4. Add to `.env.local`: `GOOGLE_GEMINI_API_KEY=<key>`

### 4. Deploy

```bash
# Build
npm run build

# Deploy both functions
npm run deploy

# Or manually:
gcloud functions deploy phase1-provisioning \
  --gen2 \
  --region=us-central1 \
  --runtime=nodejs22 \
  --entry-point=handlePhase1 \
  --env-vars-file=.env.local

gcloud functions deploy phase2-intake-submit \
  --gen2 \
  --region=us-central1 \
  --runtime=nodejs22 \
  --entry-point=handlePhase2 \
  --env-vars-file=.env.local
```

### 4. GHL Webhook Configuration

Add webhook in GHL agency account:

**Phase 1 Webhook:**
- Event: Opportunity updated
- Trigger: Checkbox field "Initiate Onboarding" = true AND stage = "Closed Won"
- URL: `https://us-central1-tag-success-hub.cloudfunctions.net/phase1-provisioning`
- Method: POST
- Body: Include opportunity data, contact data, custom fields

**Phase 2 Webhook (if using GHL form):**
- Event: Form submitted
- Form: [Client Intake Form ID]
- URL: `https://us-central1-tag-success-hub.cloudfunctions.net/phase2-intake-submit`
- Method: POST
- Body: Include locationId, email, form response data

## Testing Locally

```bash
npm run dev  # Watch mode

# In another terminal:
curl -X POST http://localhost:8080/webhook/phase1 \
  -H "Content-Type: application/json" \
  -d '{
    "opportunity": {
      "id": "opp123",
      "name": "Acme Tax Advisory",
      "stage": "Closed Won"
    },
    "contact": {
      "id": "con123",
      "name": "Jane Doe",
      "email": "jane@acme.com"
    }
  }'
```

## Firestore Schema

### locations/{locationId}

```typescript
{
  locationId: string;           // GHL location ID
  name: string;                 // Client name
  slackChannelId: string;       // Slack channel created
  driveFolderId: string;        // Drive folder created
  googleDocId?: string;         // Doc created in Phase 2
  ownerEmail: string;           // Client's email
  services: {
    vslFunnel: boolean;
    adManagement: boolean;
    closingTeam: boolean;
    website: boolean;
    salesEnablement: boolean;
  };
  ownerModel: "client" | "tag";
  createdAt: Date;
  provisioned: true;
}
```

### locations/{locationId}/provisioningLog/{eventId}

```typescript
{
  type: "phase1_started" | "phase1_complete" | "phase2_started" | "phase2_complete";
  timestamp: Date;
  details?: Record<string, unknown>;  // Context-specific
  error?: string;                     // If failed
}
```

### auth/otpWhitelist

```typescript
{
  emails: string[];  // Client emails who can sign in to Hub
  updatedAt: Date;
}
```

## Error Handling

Failures are logged to Firestore under `locations/{id}/provisioningLog` with full context. Check the logs to debug:

```bash
gcloud functions logs read phase1-provisioning --limit=50
gcloud functions logs read phase2-intake-submit --limit=50
```

## Next Steps

1. ✓ Phase 1 & 2 functions built
2. Configure GHL webhooks (see section above)
3. Test with a real closed-won opportunity
4. Set up human audit workflow in Slack/email
5. Monitor provisioning log for errors
