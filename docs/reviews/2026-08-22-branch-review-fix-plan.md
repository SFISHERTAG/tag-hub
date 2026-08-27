# Fix plan: branch review findings (2026-08-22)

Paste everything below this line into a fresh session as its opening prompt.

---

Fix the confirmed findings from the 2026-08-22 adversarial review of branch
`claude/product-polish-assessment-d53e4e` (9 commits, 55a7475..35fa08c). Every
finding below was verified against the code with quoted lines; re-read each
cited site before changing it, and if the code has moved since, re-verify the
mechanism rather than pattern-matching the description. Work the streams in
order. Nothing here is user-reachable yet (no route reads a metric), so fix
before wiring, not after.

Ground rules, non-negotiable:
- Red-green: write the failing test that captures the finding FIRST, watch it
  fail, then fix. Several findings exist because a test pinned the happy path
  only (e.g. one 'showed' fixture).
- Do not weaken the guards to make fixes easy. Fail-closed stays fail-closed.
- Story discipline: these touch Story 7.6/7.7 files. Stage the story doc with
  the code in the same commit; the pre-commit hook enforces it. Add dated
  repair notes to `docs/stories/7.6-*.md` / `7.7-*.md` for what you change.
- Gates per CLAUDE.md: root `tsc --noEmit` + lint + vitest; `npm run
  check:functions` if functions/ is touched; full Angular gate if web/ is
  touched. Only green output counts.
- One commit per stream (or tighter). No `--no-verify`.

## Stream 1 — Metric semantics (lib/sources/metric-source.ts, lib/dashboard/metrics.ts)
Every registered metric currently computes a number that does not match its
name. Fix the semantics, not the labels.

1.1 `readOpportunities` fetches `{ status: "all" }` and `SourceRow` drops
status, so `pipeline_open_value` sums won/lost/abandoned monetaryValue and
`pipeline_by_stage` buckets dead deals. Add `status` to what the adapter can
filter on (either query with `status: "open"` for these metrics, or carry
status on SourceRow and filter in the metric via the query — prefer pushing it
into the SourceQuery so the recording-fake test can assert it, consistent with
the push-down principle in test/metric-scope.test.ts).

1.2 Silent truncation: `getOpportunities` caps at limit 100 and ignores
`meta.nextPageUrl` (declared in SearchResponse, never read). Implement
pagination in lib/ghl/opportunities.ts (follow nextPageUrl), or make the
adapter fail loudly on a full page rather than sum a clipped set. Silent
truncation is the confidently-wrong-number failure this registry exists to
prevent — do not leave it as a comment.

1.3 Stock vs flow: `pipeline_open_value` is a point-in-time stock, but the
opportunities dataset goes through `withinPeriod` on `createdAt`, so an open
deal created before period.from vanishes. Decide per metric whether the period
applies (open value: no period filter on createdAt; by-stage: same). The
adapter needs a way for a metric to say "current state" vs "events in period"
— add it to SourceQuery rather than special-casing a dataset.

1.4 `appointments_booked` counts every calendar event including cancelled /
noshow / invalid (readAppointments emits value:1 for all, status only in the
bucket which the scalar discards). Filter to statuses that mean "booked"
(decide: new+confirmed+showed?) and pin it with fixtures for cancelled and
noshow — the current test uses a single 'showed' fixture and catches nothing.

1.5 Ad spend window: `readAdSpend` reduces the period to a day count;
`lib/meta/ads.ts timeRange()` anchors at `new Date()`, so any historical
period returns the trailing window mislabeled as the requested one, and the
ad_spend branch skips withinPeriod so nothing can catch it. Two options:
teach lib/meta/ads.ts a real since/until range (Meta insights supports
time_range), or make readAdSpend REFUSE a period that is not "trailing N days
ending now" with a typed error, same refuse-don't-guess stance as
UnsupportedScopeError. Do not ship the mislabel.

1.6 Shared ad accounts: readAdSpend fetches per location with no dedup by
metaAdAccountId — two tenants sharing an account double the reported spend.
Dedup by account id across the queried locations. Also stop paying for the
trailing-7-day insights call (`spend7d`) this path discards.

1.7 NaN dates: `at: Date.parse(...)` with no validity check; NaN rows are
silently dropped by withinPeriod. Guard the parse: an unparseable date is a
loud error or a counted-and-logged exclusion, never a silent drop (repo error
contract: no error-as-empty).

## Stream 2 — Claims write path (lib/auth, functions/src/auth.ts, app/api/admin)

2.1 WORST FINDING: `functions/src/auth.ts` mergeGrants replaces a matched
grant with `{ ...grant }` and the functions-side RoleGrant type has NO team
field — re-provisioning (documented retry path) silently deletes admin-set
scope/team. Add scope/team to the functions RoleGrant type and make
mergeGrants preserve the existing grant's scope/team when the incoming grant
does not carry them. Note CLAUDE.md: functions/ must stay in sync with
lib/auth/session.ts claim shape — the file header says so. Test in
functions/ workspace; run `npm run check:functions`.

2.2 `lib/auth/admin.ts` userExists callback: bare `catch { return false }`
conflates transient Admin SDK failures with 'user does not exist', so an
outage blocks valid team writes with a message naming real uids as missing.
Rethrow unless `error.code === 'auth/user-not-found'` (copy the pattern from
functions/src/auth.ts ensureUser). While there: replace N getUser calls with
one `getUsers([{uid},...])` batch — it returns notFound directly.

2.3 Group routes: setUserClaims now throws GrantValidationError but only
app/api/admin/users/[uid]/role/route.ts catches it. groups/[groupId]/route.ts
and groups/[groupId]/members/route.ts surface it as a masked 500, and the
per-member Promise.all can partially write before a sibling rejects. Catch →
400 in both routes (share a helper with the role route), and validate ONCE
before the fan-out (normaliseGrants + size check are pure — run them on the
grant before mapping members) so identical-grant failures cannot be partial.

2.4 Ordering: `assignIndividualRole` runs `detachFromCurrentGroup` BEFORE
setUserClaims validation, so a rejected grant ('nothing was written') has
already removed the user from their group. Validate first (call the pure
normaliseGrants/assertWithinClaimLimit before detaching, or move detach after
setUserClaims succeeds). Add a test proving a failed validation leaves group
membership untouched.

2.5 Ghost team member: user-row seeds the team control from stored claim uids
but options come from the live directory — a deleted account becomes an
invisible, undeselectable value that 400s every save. In user-row, render a
chip/option for stored uids missing from peers() (labeled 'unknown user
<uid>') so it can be deselected; or drop-and-warn on reset(). Spec it.

2.6 `readScope` in the role route treats `''` as "clear" — for any
nonconforming caller that is a silent destructive clear where every other bad
value 400s. Delete the `''` branch; let it fall through to the 400. Then
simplify the Angular side: FormControl<ScopeLevel | null> with
[value]="null" for 'Role default', removing the '' sentinel and both
translations (finding: three encodings of one concept).

2.7 Decide (do not silently change): setUserClaims writes `{roles: grants}`
and setCustomUserClaims REPLACES all claims, wiping legacy keys
(scripts/create-user.mjs writes `{...customClaims, role}` and its users show
role:null in the directory, which reads only `claims.roles`). Either preserve
unknown claim keys read-modify-write style, or migrate: make user-directory
parse the legacy shape too (via parseRoleGrants — see 4.2), and update
create-user.mjs to write the roles-array shape. Pick one, document in the
story doc.

## Stream 3 — Boundary hardening (the 7.6 guarantee)

3.1 SourceQuery is unbranded+exported, requireTenancyScope checks only uids,
and the ad_spend path (getTenant → getAdSpend) has NO access check — unlike
opportunities/appointments which pass through ghl()'s requireLocationAccess.
Any server code can hand-write a query and read another tenant's spend. Brand
SourceQuery the way ScopeFilter is branded (unique symbol, scopedQuery as the
only minter, unsafeQueryForTests escape hatch mirroring unsafeScopeForTests),
and update the canary in test/metric-scope.test.ts (it hand-writes a query —
route it through the test constructor). This closes the bypass at the type
layer, same mechanism 7.6 already established.

3.2 availableFor mismatch: all three metrics advertise to CLIENT_CLOSER
(self) and CLIENT_MANAGER (team), whom the adapter always rejects. Until
Story 7.8 lands the uid mapping, narrow availableFor to the tenancy-default
roles (TAG_EXEC, TAG_CSM) with a comment naming 7.8 as what restores the
rest — an advertised widget that always errors is worse than an absent one.
Add a registry test asserting every metric's availableFor roles resolve (via
DEFAULT_SCOPE_BY_ROLE) to a scope the adapter accepts, so the mismatch cannot
recur when roles or datasets change.

3.3 The file-level `/* eslint-disable import/no-restricted-paths */` in
app/api/clients/_lib/client-record.ts and
app/api/clients/[clientId]/creatives/route.ts suppresses EVERY zone in those
files (all zones live under one rule id). Scope the disable to the specific
import lines (eslint-disable-next-line) so future violations still fire.

## Stream 4 — UI + theme

4.1 Material overlays (mat-select panels, mat-menu, mat-dialog) render
borderless on the new 1.06–1.26:1 fills; _theme.scss's own comment says any
surface on these tiers must draw a border. Fix once in _theme.scss via M3
token overrides for overlay containers (per CLAUDE.md: token overrides, no
::ng-deep, no !important; verify the token names against the installed
Material version's docs). Verify in the browser at mobile width: open the
role select and a dialog, screenshot.

4.2 hud-gauge: (a) at fraction 0 the round linecap renders a dot at the start
angle — draw nothing at zero (e.g. [attr.visibility] or skip the value circle
when fraction()===0); (b) the readout and aria-label print the RAW value, so
NaN renders 'NaN%' — display the clamped/sanitized value or an explicit
placeholder. Extend the spec: assert the readout text for NaN and the
no-value-circle-at-zero case (current tests only read stroke-dasharray).

4.3 Department dial lost the scoreTone red/amber/green signal (the removed
tile had tone: scoreTone(avg); HudGauge is always gold). Add an optional
tone/status input to HudGauge that switches the arc's token (still zero raw
hex — map tones to --mat-sys-* tokens in scss classes), and pass
scoreTone(summary.avgHealthScore) from the department widget. Also delete the
now-dead 'caution' member of the tile tone union and its scss rule.

## Stream 5 — Consolidation (single commit, mechanical)

5.1 ScopeLevel is defined 4x (grants.ts, scope.ts, session.ts inline
predicate, web model). Canonical home: lib/auth/grants.ts exports ScopeLevel,
SCOPE_LEVELS, isScopeLevel; session.ts parseRoleGrants and scope.ts import
them. The web copy stays (boundary) but add a drift test in the root suite
comparing the web file's literal to SCOPE_LEVELS (precedent:
test/field-catalog-drift.test.ts).

5.2 user-directory.ts hand-copies parseRoleGrants' tolerant parsing while the
export's doc says only the test may import it. Resolve the contradiction: let
user-directory call parseRoleGrants (it becomes the shared claims reader; fix
the doc), which also gives the directory the legacy-shape branch for free
(see 2.7). Collapse GrantClaim to RoleGrant (structurally identical; three
names for one shape).

5.3 BUNDLED_WIDGET_METRICS is all-null machinery; isValidInstance is
production-dead. Either wire isValidInstance into the future saved-dashboard
resolution path NOW (a stub that the widget endpoint will call), or simplify
the map to a documented readonly id list with the WIDGET_REGISTRY sync test
kept. Don't leave a validator only tests run.

5.4 check-story-status.mjs and eslint.config.mjs each encode the integration
path map; they drifted in unison once already (that's why this branch exists).
Extract one shared manifest (a small .mjs both import, or JSON) and make both
read it.

Out of scope, do not do here: Story 7.8 (uid mapping), Meta credentials, the
overview-tab race is IN scope though — add the requestId guard copied from
clients-book.ts (private requestId=0; capture ++this.requestId before await;
bail if changed after), and make the effect track only the id (computed(() =>
this.client().id)) so unrelated client-field refreshes stop re-firing it.
[That belongs to Stream 4; treat it as 4.4.]

Also fix while passing (low risk, note in commits): em dashes in the two
runtime error strings in lib/auth/grants.ts (CLAUDE.md: no em dashes — the
rule is dead in docs but these are user-facing strings; use a comma or
period); the orphaned doc comment in lib/ghl/opportunities.ts:87.

Definition of done: every stream's findings have a failing-then-passing test,
all gates green, story docs updated in the same commits, and a final summary
naming any finding you decided NOT to fix and why.
