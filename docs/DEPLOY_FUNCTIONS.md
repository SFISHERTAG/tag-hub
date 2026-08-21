# Deploying the provisioning Cloud Functions

**State as of 2026-08-20: phase1-provisioning has never successfully run in production.**
It reports `ACTIVE` and has zero successful invocations. The only deploy, on 2026-08-13,
failed at container startup and every request since has hit a service that never booted.

Three code defects caused that and are fixed (see "Make the Cloud Functions bundle actually
load"). What remains is configuration, and configuration is the part this repo cannot do for
you.

---

## Why "ACTIVE" meant nothing

`gcloud functions describe` reported `state: ACTIVE` throughout. That is the *deployment*
succeeding, not the container running. The evidence of the real state was only in logs:

```
ERR_MODULE_NOT_FOUND: Cannot find module '/workspace/dist/webhooks/phase1-provisioning'
Container called exit(1) / Default STARTUP TCP probe failed
```

**Check logs, not state, after any deploy here.** The command is at the bottom of this file.

---

## What is already in place

| Secret Manager | Version | Note |
|---|---|---|
| `phase1-webhook-secret` | 1, enabled | ready |
| `slack-bot-token` | 1, enabled | ready |
| `tag-postgres-password` | 1, enabled | ready |
| `ghl-client-secret` | 2, enabled | ready |
| **`ghl-pit`** | **none** | **exists but is empty — blocks Phase 1** |

The deploy scripts now attach secrets via `--update-secrets` (additive, so a secret attached
by hand or by another phase is not silently detached).

---

## What is missing, and who can supply it

### 1. `ghl-pit` has no value

`getGhlToken()` reads `process.env.GHL_PIT` and throws `GHL_PIT not set`. Phase 1 calls it
before doing anything, so an empty secret means every invocation fails at the first GHL call —
after the container boots successfully, which makes it look like a different problem.

```bash
printf '%s' 'THE_GHL_PRIVATE_INTEGRATION_TOKEN' | \
  gcloud secrets versions add ghl-pit --data-file=-
```

### 2. Three secrets referenced by the deploy scripts do not exist yet

Phase 2 and Phase 3 reference these. Create them before running their deploys:

```bash
gcloud secrets create phase2-webhook-secret --replication-policy=automatic
gcloud secrets create phase3-webhook-secret --replication-policy=automatic
gcloud secrets create gemini-api-key       --replication-policy=automatic
gcloud secrets create meta-system-user-token --replication-policy=automatic
# then add a version to each, as above
```

### 3. Non-secret configuration is not set on any function

The deployed `phase1-provisioning` currently has exactly one environment variable,
`LOG_EXECUTION_ID=true`. Everything below is read by the code and unset in production. These
are configuration rather than credentials, so they go in `--update-env-vars`, not Secret
Manager:

`GHL_FORM_URL` · `TAG_SHARED_DRIVE_ID` · `TAG_TEAM_EMAIL` · `MAIL_HOST` · `MAIL_PORT` ·
`MAIL_USER` · `MAIL_FROM` · `META_SETUP_GUIDE_URL` · `META_SYSTEM_USER_ID` ·
`CLOUD_FUNCTIONS_URL` · `PHASE3_WEBHOOK_URL` · `DB_HOST` · `DB_PORT` · `DB_NAME` · `DB_USER`

`MAIL_PASS` and `DB_PASSWORD` are credentials and belong in Secret Manager
(`tag-postgres-password` already exists for the latter).

> `functions/.env.example` does not list `GHL_PIT`, `SLACK_BOT_TOKEN`, `TAG_SHARED_DRIVE_ID`
> or `GOOGLE_GEMINI_API_KEY`, all of which the code reads. Treat the code as the source of
> truth, not the template.

---

## Deploy order

The order matters because of how `requireWebhookSecret` fails.

1. **Put a value in `ghl-pit`** and create the missing secrets above.
2. **Set the non-secret configuration** on each function.
3. **Set the same bearer token on the GHL webhook** as the value in `phase1-webhook-secret`.
4. **Deploy**: `npm run deploy:phase1` (then phase2, phase3, or `npm run deploy`).
5. **Read the logs.** Not the state.

Doing 4 before 3 does not fail open — it rejects every legitimate GHL call with 401. Doing 4
before 1 boots the container and then throws on the first GHL call. Neither is dangerous;
both look like different bugs than they are, which is why the order is written down.

**A missing secret is a 500, deliberately.** `requireWebhookSecret` refuses rather than
accepting a request it cannot verify, because failing open on a half-finished deploy is the
exact bug it exists to prevent.

---

## Verifying a deploy actually worked

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="phase1-provisioning"' --limit=20 --freshness=10m --format="value(timestamp,severity,textPayload)"
```

A healthy boot logs nothing alarming and the service accepts a request. A failed boot shows
`Container called exit(1)` and `STARTUP TCP probe failed`, while `describe` still says
`ACTIVE`.

---

## Still open

`--allow-unauthenticated` remains on all three deploys. That is now defensible rather than
accidental: the bearer token checked by `requireWebhookSecret` is the authentication, and GHL
cannot present a Google identity. It is worth revisiting if these ever move behind a gateway
that can.
