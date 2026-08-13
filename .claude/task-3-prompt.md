Build TAG's Zapier-replacement automation pipeline: client onboarding provisioning (Slack channel + Drive folder), an intake form, client-doc creation, and AI-generated UVP/copy written into that doc.

# Context you need

This is the TAG Hub codebase — a Next.js 16 app on Cloud Run (`hub/`), backed by Firestore and Firebase Auth, project `tag-success-hub`. Read `hub/AGENTS.md`, `hub/docs/architecture.md`, and `hub/docs/epics.md` first — this repo has real conventions and a documented data boundary ("Firestore holds only what GHL has no concept of") that this work must respect, not reinvent.

There is a second, currently-empty GCP project: `tag-automation-503720` ("TAG Automation", created 2026-07-27). It was set up to be "strictly GCF" — a Zapier-replacement, Cloud Functions only, for TAG and their clients. As of this writing: Cloud Functions API is not enabled there, and `samuel@taxadvisorygrowth.net` lacks Cloud Build permission on it.

**Open decision, not yet confirmed with the user:** whether these functions should actually deploy into `tag-automation-503720` or into `tag-success-hub` instead. The case for `tag-success-hub`: the runtime service account `hub-app@tag-success-hub.iam.gserviceaccount.com` already has a working, tested keyless domain-wide-delegation setup (self-referential `roles/iam.serviceAccountTokenCreator`, used today for signing Gmail JWTs via the IAM Credentials API — see `hub/lib/auth/gmail.ts`). A function provisioning Drive folders and Docs server-side needs the exact same kind of delegation, and reusing `hub-app@` avoids a second Workspace Admin authorization (a second OAuth Client ID to register) plus cross-project IAM grants just to touch Firestore. The case against: `tag-automation-503720` was deliberately set up as its own thing, possibly meant to serve TAG systems beyond just this Hub. **Ask the user which project before deploying anything** — don't assume.

Regardless of project choice: keep this as actual Cloud Functions, not Next.js API routes. The user was explicit about "strictly GCF."

# What already exists that this must integrate with, not duplicate

- `hub/lib/dashboard/location-config.ts` reads `locations/{id}.slackChannelId` and `locations/{id}.driveFolderId` from Firestore — this is what the Hub's client-owner dashboard (`/dashboard`) already displays (a Slack message feed widget and a Documents/Drive widget). **The provisioning function's whole job, for the Slack+Drive half of this, is to write those two fields once it creates the channel and folder.** Nothing else in the Hub needs to change for that half to light up — the read side is already built and tested.
- `hub/lib/slack.ts` is an existing *read-only* Slack client (bot token from `SLACK_BOT_TOKEN`, `conversations.history` + `users.info`) used by the dashboard widget. It deliberately does not create channels or invite anyone — this task's provisioning function needs channel-creation scopes (`channels:manage`, `conversations:create`, inviting the bot itself), which is new scope beyond what's already granted. Check what scopes the existing Slack app actually has before assuming; may need to request more in the Slack app config.
- `hub/lib/auth/admin.ts` has the `setUserClaims` pattern and the `serviceAccountId` keyless-delegation approach — follow it for any new Google API integration (Docs, Drive) rather than introducing a service-account key file. Key files are explicitly avoided everywhere else in this codebase.
- `hub/docs/client-fields.md` §7b documents the Slack telemetry fields (`slack.awaitingReply` etc.) and is explicit that message *bodies* are never persisted to Firestore, only timestamps and author class — if this pipeline touches Slack messages at all (it shouldn't need to, for pure provisioning), respect that boundary.
- The Firestore document shape: `locations/{locationId}` already holds `slackChannelId` and `driveFolderId` per `location-config.ts`'s `LocationConfig` type. Extend that same document, don't create a parallel one.

# What to actually build

1. **Client intake form.** Where does this live — in the Hub itself (a new Next.js route, e.g. `/onboarding/intake` or similar, consistent with the existing `/onboarding` nav item already gated to `tag_csm`/`tag_exec`) or somewhere else? Decide with the user; the Hub already has the auth, session, and Firestore access this would need, so building it there is the likely default unless there's a reason not to.
2. **Provisioning automation** (the actual GCF): triggered by intake submission (or a GHL webhook — ask which), creates a Slack channel for the client (single-channel guest pattern, matching Epic 9's existing design — the client is invited as a guest with no other Slack access), creates a Drive folder (a Shared Drive subfolder, per the precedent already set for the Hub's Documents widget — see `hub/app/dashboard/widgets/documents-widget.tsx`'s comments on why a Shared Drive rather than a personal mailbox's My Drive), and writes `slackChannelId`/`driveFolderId` back onto `locations/{id}`.
3. **Client doc creation** — a Google Doc created per client (in that same Drive folder), presumably seeded from intake answers.
4. **AI-generated UVP/copy** — written into a **separate tab** of that same doc, generated from the intake form's answers. This needs: an LLM call (which provider/API — Anthropic, given this is a Claude-built codebase? ask), the Google Docs API's tabbed-document support (this is a newer Docs API feature — verify the current API surface rather than assuming, tab support was added relatively recently and the exact request shape matters), and a prompt design for turning raw intake answers into UVP/positioning copy — that prompt does not exist yet and needs to be written from scratch, informed by whatever the intake form actually asks.

# Constraints carried over from this session's decisions

- No service-account key files, ever — keyless delegation via IAM Credentials API only, matching every other Google integration in this repo.
- Respect the existing Firestore document boundary (`locations/{id}` for this stuff, nothing new invented without a reason).
- The single-channel-guest Slack pattern (Epic 9) is deliberate — a client should end up with access to exactly their own channel, nothing more.
- Whatever this writes to `locations/{id}`, verify against `hub/lib/dashboard/location-config.ts`'s actual field names (`slackChannelId`, `driveFolderId`) so the dashboard widgets pick it up without needing a Hub-side change.

# Before writing code

Confirm with the user: which GCP project, the intake form's actual field list (this drives both the doc-seeding and the AI-copy prompt), the trigger mechanism, and the LLM provider for copy generation. These are real forks, not details to guess past.
