# Release verification plan

**Written:** 2026-08-21, against `f55143b`
**Authors:** two Claude sessions working the same repo, findings confirmed
independently by both before being written down

The Angular migration is on `main`. Nobody has loaded a screen from it. This
plan is how it gets verified and how it reaches production, in an order where
each step's output is what makes the next one safe.

## Decisions already taken

- **Phase 1b is a `--no-traffic` revision, not a local run.** Sam's call,
  2026-08-21, on the argument in Phase 1b below.
- **Production holds on `4687084` until 1a and 1b both pass.** Traffic shifts
  only after the artefact itself has been walked.
- **The tenant to enter is Casey Williams Co.** Sam's call, 2026-08-21. It is
  already the designated test client throughout the Phase 3 docs, so entering it
  does not distort a real client's `daysSinceLastAction`. Enter that tenant and
  no other. Its `locationId` is not recorded here because it lives in Firestore;
  read it from the clients list at walk time.
- **Sam supplies the sign-in code.** The OTP goes to his own inbox, so step 1 of
  the smoke list is his to perform or to relay. Note that the Phase 3 docs use a
  separate `test@` account for this flow; if that account still works it is the
  better choice, because it keeps a verification walk out of the real staff
  audit trail.

## Phase 0: get it off the laptop

**Done 2026-08-21.** `origin/main` was `fe332b2`, the full Next application.
Local `main` was five commits ahead and unpushed, and no remote branch contained
`198c768`. The entire migration, 37,341 lines, existed on one machine.

Two consequences that outlived the push and matter for reading anything from
before it:

- **Every green CI run before 2026-08-21 validated the Next app.** CI runs
  against `origin/main`. The gates run locally on the Angular tree were real,
  but CI had never seen the code.
- `deploy-method-guard` (`4542c48`) fast-forwards onto `main`. It is the only
  piece of the 2026-08-21 outage knowledge not yet on trunk, and the guard
  against that outage lives inside the file the broken command skips, so
  documentation is the only guard that functions. Land it.

## Phase 1a: run the application

Owner: the session with the browser-console context from the outage.

**A local run talks to production.** `.env.local` sets
`GOOGLE_CLOUD_PROJECT=tag-success-hub`. This is real Firestore and the real GHL
location. Read freely. Eight routes write.

**`impersonation/enter` is the one that does not look like a write.** Entering a
tenant appends to `locations/{id}/auditLog`, and `daysSinceLastAction` reads that
as a CSM check-in for the 30-day escalation rule. Walking three client tenants to
look at screens resets three clients' staleness clocks and can hide a genuinely
neglected client from the escalation view. Treat entering a tenant as a
deliberate act on one chosen tenant, not as navigation. That tenant is Casey
Williams Co, per the decision above.

Do not touch during a walk: appointment status, opportunity close, opportunity
stage, follow-up config, dashboard config, onboarding checklist task. Those write
to real GHL. Signing in writes and deletes an OTP doc in production Firestore,
which is self-cleaning and fine.

### Smoke list

1. **Sign in.** Request a code, enter it once. Verify returns 200 **with**
   `Set-Cookie`, and there is **no** `/api/auth/session` call after it. The
   session is minted server-side now; a `session` call means the old
   client-side path has come back.
2. **Console clean.** A `securetoken.googleapis.com` 400 is stale Firebase
   persistence in your own browser, not a server fault. Clear site data rather
   than chasing it.
3. `/dashboard` — widgets render, and the sample-data banner appears over health
   scores. Its absence is a regression.
4. `/portfolio` — tenant list renders. One unreachable tenant must not empty the
   list.
5. `/clients`, `/clients/:id` — the tenant gate lives here.
6. `/l/:locationId/pipeline`, `/today`, `/contacts`, `/follow-up` — the GHL
   module. `today` is the richest.
7. `/flow`, `/setter`, `/courses`, `/knowledge-base`, `/bug-reports`, `/admin`.
8. `/success` — **expected miss.** It redirects silently to `/dashboard` via the
   wildcard route rather than 404ing, so a click-through would never reveal it.
   Confirming the redirect confirms the gap.
9. `curl /api/does/not/exist` — must be 404 or 401 JSON, never 200 `text/html`.
   This was a real defect in the SPA rewrite and is worth re-checking against a
   running server.

**General failure signature:** a 200 on a server call followed by nothing. The
2026-08-21 outage was two successful server calls with a silent client-side
throw between them.

## Phase 1b: verify the artefact

**A local run proves the application logic and cannot prove the artefact.** Every
fault in the 2026-08-21 outage was invisible locally: the bundle shipped without
Firebase config because `gcloud run deploy --source` skipped `cloudbuild.yaml`'s
build args, and locally that config comes from `.env.local` and always works.
`next start` warns it does not work with `output: standalone`, so the local
server is not the production server. The SPA rewrite, the same-origin cookie on
the real domain, and the Docker build are all unexercised locally.

Build the image via `gcloud builds submit --config=cloudbuild.yaml`, never
`--source`. Deploy it `--no-traffic`. Hit it on its revision-specific URL and run
the same smoke list, plus:

    curl -s <revision-url>/signin \
      | grep -oE '/_next/static/[^"]+\.js' | sort -u \
      | while read c; do curl -s "<revision-url>$c"; done \
      | grep -c 'AIza'

Non-zero means the Firebase config is inlined. Zero means sign-in is broken for
everyone regardless of what the build reported.

Production stays on `4687084` throughout, and abandoning the revision is one
command.

## Phase 2: reconcile status against what was found

Stories **10.5, 10.6 and 10.7 all read Draft while their routes appear to
work**: the GHL module declares `l/:locationId` with pipeline, today, contacts,
contact detail and follow-up; dashboard has its customize route; clients has list
and detail.

This is the mirror of the defect fixed in `4bb05ef`. There, tables claimed less
than the code had. Here, code ran ahead of the stories inside one large commit.

**No story moves off Draft on the strength of a directory listing.** Each moves
only with the route that proves it, taken from the smoke run. `/success` becomes
a real task on whichever story owns it.

## Phase 3: shift traffic

Only after 1a and 1b both pass. Three ordering constraints in the ~109-commit
gap between `4687084` and trunk:

| Item | Consequence if ignored |
| --- | --- |
| Migration 006 has never been applied | Any fresh database stops there. The idempotent fix is on trunk. `RESWEEP_DEPLOY_RUNBOOK.md` §1 has the detection query and a backup step for the case where it drops a populated table |
| `PHASE2_WEBHOOK_SECRET`, `PHASE3_WEBHOOK_SECRET` | In Secret Manager and mounted in `cloudbuild.yaml`, but revision `00016` predates them. Each revision carries its own env snapshot, so rolling traffic backwards drops anything added since |
| Dockerfile `web-deps` stage, node:24 builder | Both on trunk. A build from the pre-push `origin/main` fails the moment it reaches Angular |

## Stated limits of this plan

- **`4687084` is known to work for sign-in.** It has not been diffed against
  trunk feature by feature. "Hold production on 4687084" means it is a known-good
  fallback for the one flow that was verified today, not that everything on it
  is confirmed.
- **75 of 76 endpoints have no tests.** `198c768` says so itself. The two
  defects its review found, a missing API path returning 200 HTML and six
  `/api/clients` routes gated on role alone, were caught by reading rather than
  by a test. A green gate does not speak to the other 75.
- **The gates reported green on the Angular tree were run locally**, before the
  push. CI has only just received this code.
