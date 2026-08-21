# Resweep deploy runbook

Four things need doing by hand before or alongside the resweep fixes going
out. All four need GCP, GHL, or Cloud SQL credentials, so none of them can be
done from an agent session. Each section states what breaks if it is skipped,
so you can sequence them against your own risk appetite rather than trusting
an ordering someone else picked.

Written against `high-findings-port`, branched from `main` at `9ff5549`.

Verify before you start, because `main` moves:

```bash
git log --oneline -1 main
```

---

## 1. Migration 006, before any fresh database deploy

**What breaks without it.** Nothing on the existing database. Every *clean*
deploy, though, dies at 006 with `relation "csm" already exists`, because 003
creates `csm` and 006 then tries to rename `csm_directory` onto that name. No
fresh deploy of this schema has ever got past it.

**First, find out which state the database is actually in.** The fix behaves
differently for each, and it is worth knowing which one you have.

```bash
gcloud sql connect tag-postgres --user=tag_app_user --database=tag_automation
```

Then, at the psql prompt:

```sql
SELECT to_regclass('public.csm') AS csm, to_regclass('public.csm_directory') AS csm_directory;
```

Read the result:

- `csm` set, `csm_directory` null: already consolidated. 006 is a no-op. Nothing to do beyond recording that.
- `csm` null, `csm_directory` set: the original intent. 006 renames it.
- Both set: the interesting case. 006 copies any rows `csm` is missing, then drops `csm_directory`. Check what you would be merging first:

```sql
SELECT count(*) FROM csm;
SELECT count(*) FROM csm_directory;
SELECT email FROM csm_directory EXCEPT SELECT email FROM csm;
```

That last query is the set of reporting lines that exist only in the old
table. They are what the copy preserves. If it returns rows, take a backup
before proceeding, because the migration drops the source table afterwards:

```sql
CREATE TABLE csm_directory_backup AS SELECT * FROM csm_directory;
```

**Then apply it.** There is no migration runner in this repo; the SQL files
are applied by hand.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f functions/sql/006_rename_csm_directory_to_csm.sql
```

It is written as idempotent `DO` blocks, so re-running it is safe. Confirm:

```sql
SELECT to_regclass('public.csm'), to_regclass('public.csm_directory');
```

You want `csm` set and `csm_directory` null.

---

## 2. Webhook secrets, and the Phase 1 cutover

**What breaks without it.** Phase 1 provisioning returns 500 on every call,
and so does `/api/onboarding/intake-submit`. This is deliberate: the checks
fail closed. An unauthenticated Phase 1 call writes a caller-supplied email
into the OTP whitelist, which is what gates real sign-in, so "open" was never
an acceptable failure mode. But it does mean the secret has to exist on both
sides before the code goes live.

**Where each secret is consumed.** Worth having straight before you start:

| Secret | Consumed by | Enforcing? |
|---|---|---|
| `PHASE1_WEBHOOK_SECRET` | `functions/` Phase 1 only | Yes, rejects |
| `PHASE2_WEBHOOK_SECRET` | Cloud Run app (inbound + outbound) and `functions/` Phase 2 | App: rejects. Functions: warns |
| `PHASE3_WEBHOOK_SECRET` | Cloud Run app (inbound + outbound) and `functions/` Phase 3 | App: rejects. Functions: warns |

`functions/package.json`'s deploy scripts already mount all three.
`cloudbuild.yaml` did not mount the two the app needs; that is fixed on this
branch, which is why the app side has to be deployed *after* the secrets
exist, not before.

**Step 1 — check what is already there.** Some of these may exist already.

```bash
gcloud secrets list --filter="name~webhook-secret" --format="table(name,createTime)"
```

**Step 2 — create whichever are missing.** Generate the value locally; do not
reuse anything that has been pasted into a chat, a ticket, or a terminal
someone else can scroll back through.

```bash
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create phase1-webhook-secret --data-file=-
```

Repeat for `phase2-webhook-secret` and `phase3-webhook-secret`. If a secret
already exists and you are rotating rather than creating, use
`gcloud secrets versions add <name> --data-file=-` instead.

**Step 3 — grant the runtime service account access.** Both the Cloud Run
service and the functions run as `hub-app@tag-success-hub.iam.gserviceaccount.com`.

```bash
for s in phase1-webhook-secret phase2-webhook-secret phase3-webhook-secret; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member=serviceAccount:hub-app@tag-success-hub.iam.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done
```

**Step 4 — read the Phase 1 value back, once, to configure GHL.** You need
the plaintext exactly once, to paste into the GHL webhook config.

```bash
gcloud secrets versions access latest --secret=phase1-webhook-secret
```

**Step 5 — configure the GHL webhook before deploying the function.** In GHL,
on the "Initiate Onboarding" webhook that fires on Closed Won, add a header:

```
Authorization: Bearer <the value from step 4>
```

Do this first. The currently deployed Phase 1 does not require the header and
ignores it, so adding it early is harmless. Deploying the new code first is
what creates an outage window.

**Step 6 — deploy.**

```bash
npm --prefix functions run deploy:phase1
```

Then the app, once the phase2/phase3 secrets exist:

```bash
gcloud builds submit --config cloudbuild.yaml
```

Note there is no Cloud Build trigger on this project, so a manual submit is
the only path, and it must carry the Firebase substitutions or sign-in breaks.

**Step 7 — verify with a real call, not by reading config.**

```bash
curl -i -X POST "$PHASE1_URL" -H 'Content-Type: application/json' -d '{}'
```

Expect `401`. That proves the check is live. Then run one real onboarding
through GHL end to end and confirm it provisions. A 500 rather than a 401
means the secret is not mounted; check the revision's env.

---

## 3. Org policy is blocking `--allow-unauthenticated`

**This one is not ours to fix and it blocks everything else in section 2.**

A previous session reported that deploying with `--allow-unauthenticated`
failed:

> One or more users named in the policy do not belong to a permitted
> customer, perhaps due to an organization policy.

The effect: the function has no invoker binding, so GHL receives a **403 from
Google before any of our code runs**. Our bearer-token check never executes.
Fixing the secrets does not help until this is resolved.

I could not verify this from a code session, and the Org Policy API is not
enabled on the project, so the specific constraint could not be read. Almost
certainly `constraints/iam.allowedPolicyMemberDomains`, which blocks
`allUsers` bindings.

**What to ask an org admin for**, in their terms:

- The project is `tag-success-hub`. The resources are three gen2 Cloud
  Functions in `us-central1`: `phase1-provisioning`, `phase2-intake-submit`,
  `phase3-meta-setup`.
- They need to receive unauthenticated HTTPS POSTs from GoHighLevel, a
  third-party SaaS that cannot present a Google identity. So `allUsers` needs
  `roles/run.invoker` on those three, or an exception to whichever
  `allowedPolicyMemberDomains` constraint is denying it.
- The endpoints are not unprotected. Each authenticates the caller with a
  shared bearer token checked in application code, and Phase 1 rejects
  outright on a missing or wrong token.

To read the constraint yourself, first:

```bash
gcloud services enable orgpolicy.googleapis.com --project=tag-success-hub
gcloud org-policies describe iam.allowedPolicyMemberDomains --project=tag-success-hub --effective
```

**The alternative, if no exception is granted:** put an authenticating
front-end in front of the functions — an API Gateway or a Cloud Run service
with an API key — and repoint the GHL webhooks at it. That is a design change,
not a config change, and worth a decision before anyone starts it.

---

## 4. GHL PIT rotation: verify by invocation, not by reading

**What may be silently broken.** Two GHL Private Integration Tokens were
reportedly pasted into chats and are being rotated. The deployed functions
mount `ghl-pit:latest`.

The trap: **`:latest` resolves at instance start, not per request.** So a
function whose mounted version holds a rotated, now-dead token will boot
perfectly cleanly, pass every health check, and then fail at its first real
GHL call. It presents as an unrelated runtime bug, not as an auth problem.
Warm instances keep the old value until they are replaced.

Reading the secret does not tell you whether the running instances have it.

**Procedure:**

```bash
gcloud secrets versions list ghl-pit --format="table(name,state,createTime)"
```

If the newest enabled version is not the rotated-in one, add it:

```bash
printf '%s' '<new PIT>' | gcloud secrets versions add ghl-pit --data-file=-
```

Then **redeploy** — adding a version alone changes nothing for running
instances:

```bash
npm --prefix functions run deploy
```

Then force a cold start and make a real call that touches GHL. A successful
provisioning run is the only proof that counts.

Once you are confident, disable the old versions so a rollback cannot
silently reintroduce a leaked token:

```bash
gcloud secrets versions disable <old-version> --secret=ghl-pit
```

---

## Also worth knowing

**Unset and failing quietly.** A previous session reported these as unset:
`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_FROM`, `TAG_TEAM_EMAIL`,
`GOOGLE_GEMINI_API_KEY`. Unverified from here. `TAG_TEAM_EMAIL` in particular
is interpolated straight into a Phase 3 Slack message, so if it is unset that
message reads "Support: undefined".

**`functions/` tests run in no gate.** The root vitest config excludes
`functions/**`, and `check:functions` is build plus lint only. Those 17 tests
only run if someone runs `npx vitest run` from `functions/` by hand. Worth
wiring into CI.

**`functions/node_modules` drifts.** `@google/genai` was declared in
`package.json` but not installed locally, so `tsc` failed until
`npm --prefix functions install`. Do a clean install in CI rather than
trusting the checked-out tree.

**The app build needs `FIREBASE_API_KEY` set.** `lib/config.ts` validates at
module load, so `npm run build` fails at page-data collection without it, with
a clear `ConfigError`. That is the config gate working, not a bug, but it does
mean a bare `npm run build` in a fresh worktree fails until you export it.
