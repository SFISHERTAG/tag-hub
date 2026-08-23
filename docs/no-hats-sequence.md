# No-hats: the dependency re-cut

`docs/ROLES_AND_GRANTS_PLAN.md` §9 ends with an instruction rather than a
conclusion: "at least four stories do not compile in the order given. Re-cut
A/A2/B/C against a dependency graph before writing story docs." This is that
re-cut. The model in that document is unchanged and is not re-argued here.

## Reconciliation first: three of the plan's premises have moved

The plan was written against `origin/main` @ `f55143b`. Main is now `af5582d`.

| Plan says | Actually |
|---|---|
| `lib/auth/grants.ts` exists only on `claude/product-polish-assessment-d53e4e` | **On main.** The branch merged 2026-08-23 |
| `lib/sources/metric-source.ts` likewise | **On main** |
| "Land the branch before starting no-hats Story A" (§1.3) | **Done.** The sequencing precondition is satisfied |
| Story 0 adds migration `008`; Story G adds `009`; Story L adds `010` | **All three numbers are taken** (`008_course_subsection_media`, `009_course_visibility`, and `010` by story 11.6). Renumbered below |
| `switchRole` is never called from a component | **Still true.** Interface, three implementations, specs. Zero callers |

The last row is the one that matters: the live bug the plan was written to fix
is still live, and still has the shape the plan describes.

## The break: C must precede B

The plan orders A → A2 → B → C, and its own migration findings contradict that:

> Story B removes the client's only location source four stories before its
> replacement.

Story B makes `location-context.ts` the single tenant-scoped authority and
requires `?locationId=`. Story C introduces union reachability and renames
`Session.locations` to `reachableLocations`. B deletes the thing C replaces. Run
in the stated order there is a window where the client cannot resolve any
location at all.

**Re-cut: C before B.** C is additive — it widens `Session` and changes a name.
B is the removal, and a removal goes after its replacement exists, never before.
This also puts the cross-tenant leak fix (B) immediately before the gates that
depend on it, rather than four stories earlier with a gap behind it.

## The sequence

| # | Story | Depends on | Why here |
|---|---|---|---|
| 0 | Migration ledger + backfill 001–009 | — | Nothing tracks what SQL has been applied. 006 already failed once on a clean deploy. Three more migrations are coming |
| A | `grants` on the session, beside `currentRole`. Reduced `SessionPayload` | 0 | Additive. `currentRole` stays, so nothing breaks |
| — | *Switcher deletion moved from A to D (2026-08-23).* The switcher has no component caller, but it is reachable from a console and is currently the only way to change hat. Deleting it in A removes the workaround four stories before D removes the need for one | | |
| A2 | Registry truth: `scope` on both registries, `kpi_summary` split, sales roles on pipeline/day-view, widget-parity check | A | Independent of the location work. Ships the salesperson/ROAS rule and gives `tag_sales` widgets for the first time |
| **C** | Union reachability. `Session.locations` → `reachableLocations` | A | **Moved ahead of B.** Additive; creates the location source B will rely on |
| **B** | `location-context.ts` as the single tenant-scoped authority. Convert every tenant-scoped gate together. `?locationId=` required | C | **Moved after C.** Closes the cross-tenant leak. Every gate converts in one story, per the plan's own warning against a partial conversion |
| D | `hasAnyRoleAnywhere` at the remaining location-free gates | B | **The live bug dies here.** A founder reaches all five grants |
| F | `validateLocations(locations, role)` | A | Rejects `[]` for non-global and non-`[]` for global. Needs `GLOBAL_ROLES` from A |
| G | Tab tables and fold (`011`), typed 503 replacing catch-to-empty | 0, D | A transient DB error stops silently deleting layouts |
| H | Cut over to tabs. `?tab=` replaces `?locationId=`. Per-tab entitlement | G | One dashboard, one tab per old layout |
| I | Grant store, reconciler, templates, admin add/remove | H | A new role appears as a new tab |
| K | Delete `currentRole`, `availableRoles` and their mirrors | D | Pure removal. Nothing has read them since D |
| M | Retire `ROLE_COOKIE` from the clear loop, delete the constant | K | |
| J | Drag and drop | H | Last on purpose: presentational, must not block a security fix |
| L | Drop `dashboard_configs` (`012`) | H, live long enough to trust | Never in the same release as H |

**Migration numbers.** `001`–`009` exist; story 11.6 adds `010`. So the ledger is
**`011`**, the tab tables **`012`**, and the `dashboard_configs` drop **`013`**.
Re-confirm against `functions/sql/` when writing each one rather than trusting
this list, which has already been wrong once — the plan's own numbers were taken
before anyone reached them.

## Where the 22 open findings land

§9 lists them as a flat checklist, which is how they get skipped. Each belongs
to the story that can actually close it:

- **A** — group move must revoke global-role grants; one error type, not two.
- **A2** — widget-parity check between the two registries.
- **B** — `?locationId=` validation on `POST /api/dashboard/tabs`;
  `freshnessByLocation` must not disclose unreachable tenants.
- **C** — canonical merge rule must not let an add silently revoke locations.
- **F** — `{tag_csm, []}` must stay writable; rule 1 as stated forces
  over-granting.
- **G** — one unresolvable tab must not 403 the whole PUT; the reconciler must
  not hard-fail a read.
- **H** — the tab schema must distinguish a book tab from an unadopted tenant
  tab; three rules key off it.
- **I** — monotonic `revoked_at` must not convert a 60-second flap into
  permanent dormancy; absent-document seed needed for *both* writers.
- **Story 0** — the critical one. The fixture enforcing the grant-ordering fix
  runs in no gate (§10). A test nothing runs is not a test.

## What this does not change

The model, the claim shape, and the single-grant conjunction are exactly as
written in the plan. The claim shape in particular must not be touched: §4
explains that retyping `locations` drops every grant on rollback and signs out
every migrated user. That reasoning stands and this re-cut does not revisit it.
