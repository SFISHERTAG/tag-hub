# Deploying the Hub app

Rewritten 2026-08-22 after a deploy where every documented check gave the wrong
answer. The old version described the Next-era app and was actively harmful once
the Angular migration landed: its verification step reported a false outage, and
its diagnosis step reported a false positive. Both are corrected below.

## The one command

```bash
KEY=$(grep -m1 '^NEXT_PUBLIC_FIREBASE_API_KEY=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
DOM=$(grep -m1 '^NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=<sha>-<label>,_FIREBASE_API_KEY="$KEY",_FIREBASE_AUTH_DOMAIN="$DOM"
```

Never `gcloud run deploy --source .`. It does not read `cloudbuild.yaml`, so it
skips the build args and the `check-substitutions` guard that exists to stop a
broken build. The guard lives inside the file a source deploy bypasses.

`SHORT_SHA` is empty on a manual submit and yields an unusable tag, so pass it.
It is also the only record of which commit a revision came from.

## Read this before trusting any check below

**The client is Angular. Auth is server-side.** `/signin` is served by the
Angular app (`main-*.js`), not by Next. `web/` has no `firebase` dependency and
no `apiKey` anywhere in it. Sign-in posts to `/api/auth/otp/request` and
`/api/auth/otp/verify`, and the Firebase credential is used **server-side** via
the `FIREBASE_API_KEY` environment variable.

Everything that follows depends on that, and the previous version of this
document did not know it.

## Verifying a deploy

Run all three. The first two are the ones that matter.

```bash
# 1. Sign-in reaches the auth API. This is the real check.
curl -s -X POST https://hub.taxadvisorygrowth.com/api/auth/otp/request \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://hub.taxadvisorygrowth.com' \
  --data '{"email":"diagnostic-probe@invalid.test"}' -w "\n%{http_code}\n"
# expect {"ok":true} and 200

# 2. The CSRF origin guard is live.
curl -s -o /dev/null -X POST https://hub.taxadvisorygrowth.com/api/auth/otp/request \
  -H 'Content-Type: application/json' \
  --data '{"email":"x@invalid.test"}' -w "%{http_code}\n"
# expect 403

# 3. The page serves the Angular bundle.
curl -s https://hub.taxadvisorygrowth.com/signin | grep -oE 'src="main-[^"]+\.js"'
# expect one match
```

Use a `@invalid.test` address. A real address sends a real OTP email, and the
endpoint rate-limits, so repeat probes return `cooldown` — which is a pass, not
a failure.

### The check that used to be here, and why it is gone

The old runbook grepped the client bundle for `AIza`:

```bash
# OBSOLETE. Reports a false outage on the current app. Do not use.
curl -s .../signin | grep -oE '/_next/static/[^"]+\.js' | ... | grep -c 'AIza'
```

That was correct when sign-in was a Next page using the Firebase web SDK in the
browser, where `NEXT_PUBLIC_*` values are inlined at build time and a missing
one breaks only the last step of sign-in. The 2026-08-21 incident behind it was
real.

It is now wrong in both directions. `/signin` is Angular, so there are no
`_next` chunks on it and the grep matches nothing. **Zero is the correct,
healthy result.** On 2026-08-22 a good deploy was rolled back because this check
returned zero and the runbook said that meant a total sign-in outage. There
should be no Firebase key in the client bundle; if one ever appears, that is the
thing worth investigating.

## Diagnosis: the image repo is a hint, not proof

| Image repo | Built by |
|---|---|
| `hub/tag-hub-git@...` | `cloudbuild.yaml` |
| `cloud-run-source-deploy/...` | `gcloud run deploy --source` |

Useful, but the old text called this "the whole diagnosis" and it is not. Two
traps:

**Read the serving revision, not the template.** `spec.template.spec.containers[0].image`
is what the *next* revision would use. It can name a source-built image while a
perfectly good cloudbuild image is serving. Ask what is actually taking traffic:

```bash
gcloud run services describe tag-hub-git --region=us-central1 \
  --format="value(status.traffic[].revisionName,status.traffic[].percent)"
```

**A source-built image is not automatically broken.** One was serving correctly
for days. The repo field tells you which command ran, not whether the result
works. Check behaviour, not provenance.

## The trap that hides a successful deploy

**A green build does not mean anything is serving it.**

Traffic can be pinned to a specific revision, usually left over from a rollback
that was never undone. While pinned, every deploy builds fine, creates a READY
revision, and serves nothing. Revisions 00017 through 00019 were all built and
all ignored this way, which is also why nobody noticed the cloudbuild path had
been broken for days.

Check, and unpin if the pin is stale:

```bash
gcloud run services describe tag-hub-git --region=us-central1 \
  --format="yaml(status.traffic)"      # latestRevision: true means unpinned

gcloud run services update-traffic tag-hub-git --region=us-central1 --to-latest
```

### Testing a revision without giving it traffic

```bash
gcloud run services update-traffic tag-hub-git --region=us-central1 \
  --set-tags=diag=<revision> --to-revisions=<current>=100
# gives https://diag---tag-hub-git-vdsoboedgq-uc.a.run.app at 0% traffic
gcloud run services update-traffic tag-hub-git --region=us-central1 \
  --to-latest --remove-tags=diag
```

Worth the extra minute before promoting. Note the tagged URL is a different
origin, so auth probes against it still need the `Origin` header above.

## Rolling back

```bash
gcloud run services update-traffic tag-hub-git --region=us-central1 \
  --to-revisions=<last-good-revision>=100
```

No rebuild needed; revisions keep their own image. But a revision also captures
its own **environment**, so rolling back drops any variable added since. That is
not cosmetic here: `00020` added `APP_ORIGIN`, `FIREBASE_API_KEY`,
`GOOGLE_SIGNIN_CLIENT_ID`, `PHASE2_WEBHOOK_SECRET` and `PHASE3_WEBHOOK_SECRET`.
Rolling back past it silently removes all five.

```bash
gcloud run revisions describe <revision> --region=us-central1 \
  --format="value(spec.containers[0].env[].name)"
```

If you need the old image *and* the current config, deploy the known-good digest
as a new revision instead of shifting traffic backwards.

## Two build defects that are fixed, recorded so they are not reintroduced

**`npm ci` and the `prepare` hook.** The Dockerfile copies `package.json` alone,
runs `npm ci`, and only copies the rest of the tree twenty lines later. `npm ci`
runs `prepare`, which ran `node scripts/install-hooks.mjs` — a file not present
at that layer. `npm ci` exited 1 and no image was ever produced. Added by
`1c3da2e`, a worktree-isolation change that took the production build down
silently, because the only deploys afterwards used `--source`. Fixed with
`|| true` in the `prepare` script. If you add anything to `prepare`, it must
tolerate running in a container with no git and no `scripts/`.

**The upload.** A submit packed 4.1 GiB across 192,089 files, 3.4 GiB of which
was `.claude/worktrees` — every other session's checkout with its own
`node_modules`. `.dockerignore` already dropped it from the image, so the waste
was invisible: correct image, enormous upload. `.gitignore` cannot fix it
because 238 files under `.claude` are tracked. `.gcloudignore` now handles it,
and it needs the `#!include:.gitignore` directive because creating the file at
all disables gcloud's auto-generation from `.gitignore`. Current submit: 228.7
MiB, 9,906 files.

## The substitutions are not secrets

`_FIREBASE_API_KEY` and `_FIREBASE_AUTH_DOMAIN` come from `.env.local`. A
Firebase web API key is a public identifier: it names the project to Google's
auth service and authorises nothing by itself.

They are still passed as build args rather than committed, and they are still
required — `check-substitutions` fails the build when `_FIREBASE_API_KEY` is
empty. Keep that guard. It is the reason a source deploy is forbidden.
