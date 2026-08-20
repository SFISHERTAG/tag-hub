# Role, scope, and authority — proposed model

**Status: proposal.** No code changes. Written to answer "a closer could also be the closing
manager and needs metrics scoped to them — how should this be structured?"

The short answer: there are **three** axes, the codebase has **two**, and everything that
feels awkward right now is the missing third one.

---

## The premise

Closer, setter, CSD, CSM, owner — every role is driven by the same numbers. What differs is
**which numbers they get shown** and **whose rows are in them**. So the model needs to
express "same metric, different lens" cleanly, or every new role becomes a new special case.

---

## What already exists

**Axis 1 — Role decides which widgets and views.** `WidgetDefinition.availableFor: Role[]`
(`lib/dashboard/widget-definitions.ts:37`) gates each widget by role, and `getAvailableWidgets(role)`
is the accessor. Roles are worn as **hats** — a permission ceiling in custom claims, a chosen
view in a cookie (`lib/auth/roles.ts`).

**Axis 2 — Location decides which tenancy.** `RoleGrant = { role, locations[] }`
(`lib/auth/session.ts:25`), enforced by `requireLocationAccess`.

**Already built, and better than expected: per-hat dashboard customization.** Configs are
keyed `(uid, role)` — `dashboard_configs`, `loadDashboardConfig(uid, role)`,
`saveDashboardConfig` (`lib/dashboard/customization.ts:18,45`), with UI at
`app/dashboard/customize/`. So **one person already gets a different saved dashboard per hat**,
automatically. A closer who is also the closing manager keeps two distinct layouts today with
no new work. Widget choices are re-validated server-side against the role
(`app/dashboard/customize/actions.ts:28`) — the same double-authorization pattern used
elsewhere. **A setter customizing their own metrics view is a solved problem.**

---

## What is missing

**Axis 3 — whose rows.** Nothing expresses it. Within one tenancy, a closer and a closing
manager both hold `locations: [X]`, and no field distinguishes *my* calls from *the team's*
calls. `availableFor` controls which widget you may place; nothing controls what fills it.

This is the entire gap. It is why the closer/closing-manager case has no clean answer today.

---

## Proposed: put scope on the grant, not the role

```ts
type RoleGrant = {
  role: Role;
  locations: string[];
  scope: "self" | "team" | "tenancy";  // whose rows this hat sees
  team?: string[];                      // uids, when scope === "team"
  can?: Capability[];                   // authority — see below
};
```

**Why on the grant rather than baked into the role:** the same role legitimately means
different scope for different people. A solo founder-closer and a closer at a twelve-person
firm hold the same role; you may want to give a senior closer team visibility without
promoting them to manager. Encode scope in the role name and you mint a new role every time
scope varies — which is how role lists become unmanageable.

**The closer who is also the closing manager** then holds two grants:

```ts
[
  { role: "client_closer", locations: [X], scope: "self" },
  { role: "client_manager", locations: [X], scope: "team", team: [uidA, uidB] },
]
```

Switching hats changes the lens *and* the rows. Their two dashboard layouts are already kept
apart by the `(uid, role)` key. Nothing else has to know.

**The founder** from the intake brief holds four grants — `client_owner` at `tenancy` scope,
their working roles at `self` — with `client_owner` first so it is the default hat.

### The work this implies

One resolver, used everywhere, in the shape of the existing `requireLocationAccess` but a
level finer: `resolveScope(session) → { locations, uids | "all" }`, and every metric fetcher
takes that filter instead of a bare `locationId`. That is the real cost — not the type
change, but threading the filter through each fetcher and making sure none of them forget.
Same failure mode CLAUDE.md already flags for tenant isolation: a fetcher that ignores the
filter silently shows one person another person's numbers.

Widgets stay role-gated for *availability* and become scope-driven for *content*.

---

## The same conflation one layer down: data vs. presentation

**The ask:** view ROAS as a line, a bare number, a heat map — whatever suits. The visual is a
choice about *reading* the number, not a property of the number.

**Today the two are welded together.** `WIDGET_REGISTRY` has eleven entries, each a
data-plus-visual bundle: `spend_roas`, `leads_funnel`, `kpi_summary`, `pipeline_board`. And
`app/dashboard/widget-grid.tsx:66–90+` renders them with a hardcoded `if / else if` chain on
`placement.widgetId`, one branch per id. So "ROAS as a bar chart instead" is not a setting —
it is a twelfth registry entry and another branch in the chain. That chain grows linearly
with (metrics × visuals), which is the shape of a problem that gets worse forever.

### Split them

**Metric** — a named data source. Declares its *shape*, who may see it, and nothing about
appearance:

```ts
type Metric = {
  id: "roas" | "spend" | "leads" | "show_rate" | ...;
  shape: "scalar" | "timeseries" | "categorical" | "funnel" | "matrix";
  availableFor: Role[];           // as today
  // fetched through the scope resolver above
};
```

**Visual** — a renderer, declaring which shapes it can draw:

```ts
type Visual = {
  id: "number" | "line" | "bar" | "donut" | "heatmap" | "sparkline" | "table";
  accepts: Shape[];
};
```

**Widget instance** — what a user actually saves on their dashboard:

```ts
{ metricId: "roas", visualId: "line", size: {...}, options: {...} }
```

**The compatibility rule does the work.** A visual may render a metric only if
`visual.accepts.includes(metric.shape)`. That is what stops the picker offering nonsense — a
heat map of a single scalar — without anyone hand-maintaining a matrix. Add a metric and every
compatible visual works on it immediately; add a visual and it works on every metric of the
shapes it accepts. The if-chain becomes a lookup.

**Some of the vocabulary already exists.** `app/ui.tsx` has `Stat` (the bare number), `Donut`,
and `BarChart` with `Segment` / `BarSeries` types. Those are three visuals already written
against generic data shapes rather than against ROAS specifically. Line and heat map would be
new; the pattern is established.

### How it composes with everything above

```
widget = metric  ×  visual  ×  scope
         what      how it     whose
         number    is drawn   rows
```

Three independent choices. Role gates which metrics are offered; scope decides whose rows
fill them; the user picks the visual. Each axis can change without touching the other two —
which is the actual test of whether the split is right.

### Migration

Saved dashboards reference the old bundled ids, so keep a compatibility map:
`spend_roas → { metric: "roas", visual: "line" }`, and so on for the eleven. Existing configs
keep working, the if-chain is deleted in one step rather than eleven, and nobody's dashboard
resets. Worth doing in that order — a rewrite that silently empties every saved dashboard
would be a bad first impression of a feature whose whole point is personalisation.

---

## Authority is a fourth thing, and it is not a role

Carried over from `docs/ONBOARDING_INTAKE_WIZARD_BRIEF.md` §3f: what you may *change* is
separate from what you may *see*. Today all authority is `admin`, TAG-wide, gating four
surfaces. A tenancy-bounded authority belongs as a capability on the grant (`can` above),
not as another job-title role — and specifically should not be named `client_admin`, since
nothing prevents a future `role.includes("admin")` shortcut from matching it.

---

## Naming — one rename that is actually justified

The client roles are asymmetric with TAG's:

| TAG | Client |
|---|---|
| `tag_sales_manager` / `tag_sales` | `client_manager` / `client_closer` |
| `tag_setter_manager` / `tag_setter` | `client_setter_manager` / `client_setter` |

`client_manager` is labelled **"Closing manager"** and described as "Closer performance and
pipeline health" (`lib/auth/role-labels.ts:41,57`). So the closing-manager role exists — it is
just the only manager role that does not say what it manages, sitting directly beside
`client_setter_manager`, which does. Reading the constant alone, "client manager" plausibly
means "manages the client", which is a CSM's job, not a closer manager's.

**`client_manager` → `client_closer_manager`** restores the symmetry and removes a real
ambiguity. Cost is the same as any role rename — the string lives in stored custom claims,
so it needs a claims migration plus a back-compat read, or users silently lose access at next
sign-in. Unlike a `client_owner` rename, the reason here is substantive rather than cosmetic.
