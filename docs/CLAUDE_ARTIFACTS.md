# Claude artifacts — index

Published Claude artifacts relevant to this repo. Recorded here because they live outside
git and are easy to lose track of; the URLs are the only handle on them.

Fetch any of them with WebFetch, or open in a browser. Listed newest first, as of 2026-08-20.

| Artifact | URL | Updated |
|---|---|---|
| TAG Hub Sweep 3 | https://claude.ai/code/artifact/1cd41882-1b81-4ee6-8fe0-7f7041ecde7d | 2026-08-20 |
| Hub ALB Cutover | https://claude.ai/code/artifact/ea6ac2a3-a91b-4396-9c19-b3c84dd5cd9a | 2026-08-20 |
| TAG Hub Full Resweep | https://claude.ai/code/artifact/94faf3a5-6112-43fb-a81f-c60789ad716c | 2026-08-20 |
| Hub Domain Cutover | https://claude.ai/code/artifact/9aee95fb-1845-4a59-a534-8fbb789f447e | 2026-08-20 |
| Angular Phase 3 Readiness | https://claude.ai/code/artifact/7145c1c1-52d2-40e8-be44-5cbc937c587a | 2026-08-20 |
| TAG Hub Launch Audit | https://claude.ai/code/artifact/ab0362f4-f36e-4a3d-a4ef-70cbd8720561 | 2026-08-18 |
| Hotpath Studio logo | https://claude.ai/code/artifact/fa6948d1-0573-4bc6-88c0-a3bebc79612e | 2026-08-15 |
| (untitled — "Shared artifact link") | https://claude.ai/code/artifact/2fbf949e-f0e0-4172-b7b5-5ea2616c0284 | 2026-08-06 |

All eight are owned by Sam; none are shared-in from others.

**Read Sweep 3's addendum before quoting its Critical section.** The report's blast-radius
paragraph says an unauthenticated Phase 1 call is "not a sign-in bypass". That was true of the
tree it reviewed (`a030707`) and is false now: `0a1c3b7` ("Story 1.8: provision the client's Hub
user at Phase 1") landed afterwards and wired in `provisionClientOwner`, which creates a real
Firebase Auth user and grants `client_owner` plus four roles for a caller-supplied email — and
sign-in gates on Firebase user existence. The "Design calls" section added after the criticals
records the correction, and the enforcement (`requireWebhookSecret` on Phase 1) is on main as of
`8765776`. Note `auth/otpWhitelist` is a red herring in both directions: nothing has ever read it.

**Note:** "TAG Hub Full Resweep" is very likely the resweep referenced in
`/Users/home/projects/hotpath/context.md` — the findings it says stay on TAG's own timeline,
separate from the Hot Path extraction. Read it before acting on any resweep claim.

**"Hub ALB Cutover" now has an in-repo counterpart:** `docs/ALB_CUTOVER_RUNBOOK.md`. The
artifact is the prettier read; the markdown is the one that survives and can be diffed. Prefer
the markdown, and re-verify either against current Google docs before running anything — both
are a 2026-08-20 snapshot of a `gcloud` surface that drifts.

**Also outside git, but in-repo as files:** `Success_Portal.dc.html` and
`TAG_Design_System.dc.html` at the repo root are Claude Design canvases, not published
artifacts. Different thing, same lineage — worth a look for design language before building
any new onboarding UI.

**Keeping this current:** this table is a snapshot, not a live view. Re-list with the
Artifact tool (`action: "list"`) rather than trusting it after a few weeks.
