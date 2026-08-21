# Deploying the Hub app

There is exactly one supported way to deploy `tag-hub-git`, and using the other
one takes sign-in down for everybody. That is not a style preference, so this
document leads with it.

## Use this

```bash
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=SHORT_SHA=<sha>-<label>,_FIREBASE_API_KEY=<key>,_FIREBASE_AUTH_DOMAIN=<domain>
```

## Never use this

```bash
gcloud run deploy tag-hub-git --source .     # takes sign-in down
```

## Why the difference is invisible and expensive

`--source` does not read `cloudbuild.yaml`. It builds the image its own way, so
everything that file does is skipped:

- the `--build-arg=NEXT_PUBLIC_FIREBASE_API_KEY=...` lines that inline the
  Firebase web config into the client bundle, and
- the `check-substitutions` step written specifically to fail the build when
  `_FIREBASE_API_KEY` is empty.

The guard against shipping a broken sign-in lives inside the file a source
deploy bypasses. So the safeguard cannot fire in the one case it exists for, and
the deploy reports success.

`NEXT_PUBLIC_*` values are inlined at **build** time, not read at runtime. A
revision missing them looks completely healthy: the container starts, health
checks pass, every page renders, and the runtime env genuinely should not
contain them. Only the browser fails, and only at the last step of sign-in.

## What the failure looks like, because it is well disguised

`lib/auth/client.ts` throws when the config is absent:

```
Firebase web config missing. Set NEXT_PUBLIC_FIREBASE_API_KEY, ...
```

That throw happens in the browser, between two server calls, where nothing
surfaces it. The observable sequence is:

```
POST /api/auth/otp/request   200
POST /api/auth/otp/verify    200      <- the code was correct and is now consumed
                                      <- clientAuth() throws here, silently
                                      <- no POST /api/auth/session ever follows
POST /api/auth/otp/verify    401      <- the user retries; the code is already used
```

The user sees **"That code is not right."** `verifyCode` returns the same
`invalid` reason for a wrong code and for no code on file, so a build
misconfiguration presents as a typo. On 2026-08-21 this cost about four and a
half hours, most of it spent reading OTP code that was working correctly.

**The tell is a `200` verify with no `/api/auth/session` after it.** If you see
that, stop reading auth code and go look at the bundle.

## Diagnosing in two commands

Which command built a revision, from the image repo alone:

```bash
gcloud run revisions describe <revision> --region=us-central1 \
  --format="value(spec.containers[0].image)"
```

| Image repo | Built by |
|---|---|
| `hub/tag-hub-git@...` | `cloudbuild.yaml`, correct |
| `cloud-run-source-deploy/...` | `gcloud run deploy --source`, broken |

`hub` is `cloudbuild.yaml`'s `_REPO`; `cloud-run-source-deploy` is the repo
`--source` creates. That single field is the whole diagnosis.

Whether the config actually reached the browser:

```bash
curl -s https://hub.taxadvisorygrowth.com/signin \
  | grep -oE '/_next/static/[^"]+\.js' | sort -u \
  | while read c; do curl -s "https://hub.taxadvisorygrowth.com$c"; done \
  | grep -c 'AIza'
```

Non-zero means the key is inlined and sign-in will work. Zero means it is broken
for everyone, whatever the build reported. **Run this after every deploy.** It is
the check that would have caught this in seconds and was never run.

## Recovering

Revisions keep their own image, so rolling back needs no rebuild:

```bash
gcloud run services update-traffic tag-hub-git --region=us-central1 \
  --to-revisions=<last-good-revision>=100
```

Pick the most recent revision whose image is in the `hub/` repo. Then re-run the
bundle check above against the live URL, because a rollback that restores the
wrong revision fails exactly as quietly as the original problem.

One caveat: a revision also captures its own environment, so rolling back drops
any secret or variable added since it was created. Check what you are trading:

```bash
gcloud run revisions describe <revision> --region=us-central1 \
  --format="value(spec.containers[0].env[].name)"
```

If you need the old image *and* the current configuration, deploy the known-good
image digest as a new revision rather than shifting traffic backwards.

## The substitutions, and why they are not secrets

`_FIREBASE_API_KEY` and `_FIREBASE_AUTH_DOMAIN` come from `.env.local` in the
main checkout. A Firebase web API key is a public identifier, not a credential:
it identifies the project to Google's auth service and authorises nothing on its
own. It ships in the client bundle by design, which is why it can be passed as a
build substitution.

`SHORT_SHA` is empty on a manual submit and produces an unusable image tag, so
pass it explicitly. It is also the only record of which commit a revision came
from, since a manual build carries no commit metadata — without it, "what is
running in production" has no answer.
