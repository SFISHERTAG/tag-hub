# Review prompt — silent defects

A reusable review for the class of bug that passes every gate and still breaks in
production. Paste the prompt below into a session, or run it as a workflow.

## Why this exists

On 2026-08-20 a day's work surfaced roughly a dozen real defects. Not one was
caught by types, lint, or the test suite, and every gate was green throughout.
They fell into exactly three shapes, and this review hunts those three.

**They share one property: nothing exercised the broken path.** Tests passing is
not evidence that a path runs. Ask what actually calls it.

---

## The three classes

### 1. Environment-dependent correctness

Code whose correctness depends on a value that differs between where it runs and
where it was tested. Locally correct, remotely wrong, and no test can see it
because the test runs locally.

Today's instance: route handlers built an absolute URL from
`request.nextUrl.origin`. Inside Cloud Run that is the container's own bind
address, so signing out sent people to `https://0.0.0.0:8080/signin`. Locally
`nextUrl.origin` resolves to the request's own origin, so it looked fine and
tested fine.

Hunt for: origin, host and base-URL construction from request objects;
`window.location` assumptions; `process.env.NODE_ENV` branches that change
behaviour rather than verbosity; hardcoded `localhost` or ports; filesystem paths
that assume a working directory; timezone and locale assumptions; anything
reading a bind address, container hostname, or `PORT`.

The tell: **would this value be different in Cloud Run than on a laptop?** If
yes, and nothing asserts the production shape, it is a finding.

### 2. Unexecuted code

Code that exists, compiles, is tested, and has never run. Its API is fixed by
nothing, so it is free to be wrong.

Today's instances: `fail()` had diverged in signature across the network
boundary with zero callers on one side; the `*hasPermission` directive had never
rendered, its only importer being its own spec; `permissionGuard`'s allow path
had never executed because no route declared `data.permission`; and
`app/setter/setter-dashboard.tsx` polls `POST /api/setter/metrics` every ten
seconds, an endpoint that does not exist on disk.

Hunt for: exported symbols with no importer outside their own spec; components
no template renders; branches no route or test reaches; endpoints with no
caller; and the inverse, callers of endpoints that do not exist. For anything
with exactly one consumer, ask whether that consumer is a test.

The tell: **grep for real callers, excluding the file itself and its spec.** A
test that instantiates a thing in a host built for the test is not a consumer.

### 3. Split-brain constants

The same value required to be identical in two or more places, with nothing
binding them. Correct on the day it is written, wrong the first time one side
moves.

Today's instances: the Google client id in the Angular bundle and in
`cloudbuild.yaml`, where a mismatch fails every sign-in with a wrong-recipient
error; `GHL_REDIRECT_URI` in the deploy config and on the GHL Marketplace app,
where a mismatch breaks the OAuth install; the role list, which existed in three
copies and where one was missing six roles including `admin`.

Hunt for: constants duplicated across the client/server boundary; values that
must match an external system's configuration; env vars compared against
hardcoded literals; any comment saying "keep in sync with".

The tell: **if I change one, does anything fail before production does?** If
nothing does, propose the check that would.

---

## The prompt

> Review this repository for silent defects: bugs that pass types, lint and the
> full test suite, and still break in production. Do not report style, naming,
> or anything a linter already catches.
>
> Hunt exactly three classes.
>
> **Environment-dependent correctness.** Code whose behaviour depends on a value
> that differs between a laptop and the deployed environment. Request origins,
> hosts, base URLs, bind addresses, ports, `NODE_ENV` branches that change
> behaviour, hardcoded localhost, working-directory assumptions, timezones. For
> each, state what the value is locally, what it is in production, and the
> user-visible symptom.
>
> **Unexecuted code.** Exports whose only importer is their own spec. Components
> no template renders. Branches no route or test reaches. Endpoints with no
> caller, and callers of endpoints that do not exist. Prove it by grepping for
> real consumers, excluding the file itself and its tests. State what would have
> to happen for the code to run for the first time.
>
> **Split-brain constants.** Values required to be identical in two or more
> places with nothing enforcing it, including values that must match an external
> system's configuration. For each, name both locations, say what breaks when
> they diverge, and propose the specific check that would catch it.
>
> Rules of evidence. Open the file, do not infer from names. Quote the line and
> give its path and number. For every finding say concretely how it surfaces:
> which flow, which user, what they see. A finding you cannot trace to a symptom
> goes in a Low-confidence section, not the main list.
>
> Do not fix anything. Report only, ranked by whether it is currently breaking
> something, could break on the next deploy, or is latent.

---

## Notes for whoever runs this

Run it against a **deployed** state, not just a branch. Two of today's findings
only became visible by comparing what is running in production against what is
committed.

Give it `Bash`, `Read`, `Glob` and `Grep`. Withhold `Write` and `Edit` so
"report only" is structural rather than a request.

The highest-value single question to ask of any finding: **what would have to be
true for this to have ever worked?** For the sign-out redirect the answer was
"the server and the browser agree on the hostname", which is false in Cloud Run
and true on a laptop, and that is the whole bug.
