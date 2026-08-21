# Deploying TAG Hub

**Last verified:** 2026-08-20 against live GCP state.

> Corrects this file's previous claim of an automatic push-to-main Cloud Build
> trigger. That trigger does not exist and never did. `gcloud builds triggers
> list --project=tag-success-hub` returns 0 items. **Pushing to `main` deploys
> nothing.**

---

## How a deploy actually happens

Manually, with `gcloud builds submit`, from a checkout of exactly what should
ship. Cloud Build then builds the image, pushes it to Artifact Registry, and
runs `gcloud run deploy`, all per `cloudbuild.yaml`.

```bash
gcloud builds submit \
  --project=tag-success-hub \
  --config=cloudbuild.yaml \
  --substitutions="SHORT_SHA=<sha>-<label>,_FIREBASE_API_KEY=<key>,_FIREBASE_AUTH_DOMAIN=<domain>" \
  .
```

### The two substitutions are not optional

Both traps below fail silently, and both are invisible on `next dev`.

1. **`_FIREBASE_API_KEY` and `_FIREBASE_AUTH_DOMAIN` default to `""`** in
   `cloudbuild.yaml`, with a comment saying the trigger supplies them. There is
   no trigger. Omit them and you ship an image whose `lib/auth/client.ts` throws
   on `clientAuth()`, so sign-in dies at the code-verification step while the
   page itself looks fine. Take the values from `.env.local`. The Firebase web
   API key is public by design and is not a secret.

2. **`$SHORT_SHA` is empty on a manual submit.** Cloud Build only populates it
   for builds it triggered itself, so `cloudbuild.yaml`'s image tag resolves to
   a bare `tag-hub-git:` and the build fails. Pass it explicitly. The `-local`
   suffix on the older `d5795ae-local` image is a previous instance of exactly
   this.

### Deploying a subset of a branch

`gcloud builds submit` uploads the working tree, not a git ref, so ship a
worktree that contains precisely the intended commits rather than trusting the
branch you happen to be on:

```bash
git worktree add /tmp/deploy <commit-currently-in-production> --detach
git -C /tmp/deploy cherry-pick <commit>
# submit from /tmp/deploy, then:
git tag deploy/<label>-<sha> <sha>   # keeps the deployed commit reachable
git worktree remove /tmp/deploy
```

---

## What is live right now

| | |
|---|---|
| Service | `tag-hub-git`, region `us-central1` |
| URL | https://tag-hub-git-vdsoboedgq-uc.a.run.app |
| Revision | `tag-hub-git-00014-8k7` |
| Image | `tag-hub-git:9ad54f4-redirect` |

That image is commit `d5795ae` plus two cherry-picked commits: the sign-in
autofill work (`deploy/signin-bd12902`) and the host-relative redirect fix
(`deploy/redirect-9ad54f4`).

**`main` is not production.** As of 2026-08-20, `main` is 13 commits behind
`claude/signin-autofill-improvements-97e3fd`, and production is a cherry-picked
subset of neither. Never infer what is live from git history. Check the running
revision's image tag:

```bash
gcloud run services describe tag-hub-git --region=us-central1 \
  --format="value(status.latestReadyRevisionName,spec.template.spec.containers[0].image)"
```

---

## Verifying a deploy

```bash
# Which revision is serving, and is it taking traffic
gcloud run services describe tag-hub-git --region=us-central1 \
  --format="value(status.traffic[0].revisionName,status.traffic[0].percent)"

# Logs
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=tag-hub-git" \
  --limit=50
```

`gcloud builds list --filter="source.repoSource.branchName:main"` appears in
older notes and matches nothing, because manual submits have a storage source
rather than a repo source. Use `gcloud builds list --limit=5`.

---

## Rolling back

Shift traffic to a known-good revision. This is instant and needs no rebuild:

```bash
gcloud run services update-traffic tag-hub-git --region=us-central1 \
  --to-revisions=tag-hub-git-00013-5fc=100
```

Recent revisions, newest first: `00014-8k7`, `00013-5fc`, `00012-kbw`,
`00011-2mk`, `00010-4nq`. List them with `gcloud run revisions list
--service=tag-hub-git --region=us-central1`.

Older notes here suggested redeploying an image tagged `:previous`. No such tag
exists; that command would fail.

---

## Configuration

`cloudbuild.yaml` is the single source of truth for what production runs with,
and it is commented with the reasoning behind each value. Do not maintain a
second copy of the environment here, which is how the previous version of this
file drifted.

Two things worth knowing without opening it:

- Secrets come from Secret Manager (`GHL_CLIENT_SECRET`, `SLACK_BOT_TOKEN`,
  `DB_PASSWORD`). Nothing secret is passed as a substitution.
- `--set-env-vars` replaces the entire set on every deploy, so a variable that
  is not listed in `cloudbuild.yaml` does not exist in production, no matter
  what a previous revision had. `GHL_LOCATION_ID_TAG_GROWTH` was added in code
  without being added there, and every internal-role hit on `/closer/flow` 500'd
  until it was.

---

## Postgres schema

Status unverified in this pass. The `automation_logs` schema below was written
for a first-time setup on the production database; confirm whether it is
already installed before running it.

```sql
-- Run this once on production database:
CREATE TABLE automation_logs (
  id SERIAL PRIMARY KEY,
  location_id VARCHAR(255) NOT NULL,
  phase VARCHAR(10) NOT NULL,
  event VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  details JSONB,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT automation_logs_phase_check CHECK (phase IN ('phase1', 'phase2', 'phase3')),
  CONSTRAINT automation_logs_status_check CHECK (status IN ('started', 'in_progress', 'completed', 'error'))
);

CREATE INDEX idx_automation_logs_location_id ON automation_logs(location_id);
CREATE INDEX idx_automation_logs_phase ON automation_logs(phase);
CREATE INDEX idx_automation_logs_status ON automation_logs(status);
CREATE INDEX idx_automation_logs_created_at ON automation_logs(created_at);
CREATE INDEX idx_automation_logs_location_phase ON automation_logs(location_id, phase);

-- Create views for monitoring
CREATE VIEW client_automation_status AS
SELECT DISTINCT ON (location_id)
  location_id,
  phase,
  event,
  status,
  created_at
FROM automation_logs
ORDER BY location_id, created_at DESC;

CREATE VIEW automation_errors AS
SELECT *
FROM automation_logs
WHERE status = 'error' OR error IS NOT NULL;
```

---

## History: Phase 3 deployment, 2026-08-16

Kept as a record. The claims in it about automatic deployment were wrong.

Commit `f3b02fc` was pushed to `main` in the belief that this triggered a Cloud
Build job. It did not, because no trigger exists. Any Phase 3 code that reached
production did so through a later manual `gcloud builds submit`, not through
that push.

Phase 3 verification that was outstanding at the time, and is not tracked
anywhere else:

- Test Phase 1 trigger with GHL
- Test Phase 2 form submission
- Verify Phase 3 fires automatically
- Check Postgres logs for all events
- Monitor Slack notifications
- Check email delivery
