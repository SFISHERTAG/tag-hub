# Action contract (writes from the dashboard)

## Why this exists

The product position is: **every tool on one surface, reported on and operated
without leaving the app.** Reporting alone is the dashboard category, which is
crowded and given away free. The differentiator is the verb.

The promise is absolute, which sets the bar: the first thing a user cannot do
here sends them back to Ads Manager or GHL, and once they are there they stay.
So a workflow is either fully operable or it is not claimed. Breadth of
half-connected integrations is worse than depth on one.

This document defines how a widget performs a write. It does not add a new
data store and does not change `docs/data-model.md`.

## Shape

A widget today declares identity, roles, and size (`lib/dashboard/widget-definitions.ts`).
An action widget additionally declares its verbs. Declaration, not
implementation: the registry stays client-safe and holds no integration code.

```ts
export type ActionBlastRadius = "reversible" | "irreversible";

export type WidgetAction = {
  /** Namespaced verb, matching the audit action string: "opportunity.stage_change". */
  id: string;
  /** Imperative label as shown on the control. "Move to Won", not "Stage change". */
  label: string;
  /** The permission required. A ROLES.* reference or a PermissionService key, never a literal. */
  requires: Role[];
  /**
   * Governs the confirm step, not whether one happens.
   * Every write confirms. Irreversible writes must also restate what cannot be undone.
   */
  blastRadius: ActionBlastRadius;
  /** Human sentence rendered in the confirm step, with the concrete target interpolated. */
  confirmText: (target: { label: string }) => string;
};
```

`WidgetDefinition` gains `actions?: WidgetAction[]`.

### How a declared action reaches the control that renders it

The declaration lives in the registry. The button has to be drawn somewhere,
and those are not the same place, so the channel between them is a design
decision rather than plumbing.

`WidgetHost` renders a widget through `*ngComponentOutlet` and passes it
**nothing**. Its template is one line, no inputs bound. Widgets are
self-sufficient: each injects a typed service and fetches its own data in its
own constructor. So there is no existing read channel through the host that a
write channel would parallel.

Three ways to close that gap:

- **(a) Metadata only.** The registry declaration carries permission and audit
  identity, and each widget hardcodes its own buttons. No host change, but the
  declaration and the rendering drift apart, which is the same two-sources-of-
  truth shape the registry parity guard exists to prevent.
- **(b) The host passes the definition down.** `*ngComponentOutlet` accepts
  inputs. Keeps the declaration authoritative, but makes the host a data
  conduit for the first time and every widget must accept an input it does not
  have today.
- **(c) A shared action bar renders alongside the widget**, reading the
  definition the host already holds. Widgets stay ignorant of actions
  entirely, and the confirm step lives in exactly one component.

**(c) is the choice, and it costs almost nothing.** `WidgetHost` already
computes `definition()` from the registry and already reads `title` and
`description` off it. The verbs are on the same object, in hand, at the point
where the tile is drawn. An action bar is a sibling element inside the existing
`mat-card`, not a new data path.

It also puts the confirm where the blast-radius rule wants it. One component
owns the dialog, so `irreversible` renders the same way for every verb in the
product, and no widget can author its own weaker confirm.

The widget still performs the write, through its own typed service, exactly as
it performs a read today. The bar decides *whether* the call happens. The
widget makes it.

## The four rules

1. **Every write confirms before it fires.** No exceptions by verb, by role, or
   by "this one is cheap." A mis-click may not spend money or move a client's
   deal. `blastRadius` changes what the confirm step says, never whether it
   appears.
2. **Every write logs.** `logAction(locationId, ...)` from `lib/audit/store.ts`,
   with `action` equal to the `WidgetAction.id`, and `auditEntryId` carried
   through when the actor is impersonating. A write with no audit row is a bug,
   not a fast path.
3. **Every write goes through the typed service layer.** `lib/ghl/*`,
   `lib/meta/*`, `lib/slack.ts`. No raw HTTP in a component, no cross-integration
   import. A widget that needs two integrations composes them at the API route,
   which is the same rule the read path already follows.
4. **The permission check is server-side.** `requires` gates the control's
   visibility, which is cosmetic. The route re-checks. A hidden button is not a
   security control.

## Failure

An action returns the same typed result the read path does. A failed write
surfaces the error to the user and logs it. Never silent-catch-to-empty, and
never an optimistic UI that shows a stage moved when the API refused. The user's
trust in "I do not have to leave the app" dies on the first write that lied.

## Known tension: confirm habituation

Every write confirms. That is the ruling and this document does not reopen it.

It has a real cost, and the cost is not friction. An operator who confirms forty
trivial notes a day learns to dismiss the dialog unread, and carries that
trained reflex into a live budget change on a real ad account. Uniform confirms
protect the trivial write by degrading the confirm on the one that matters.

Tripwire: if operators ask to disable confirms, that is the signal to revisit
the uniform rule deliberately. It is not licence to add a quiet opt-out. An
opt-out added under friction pressure lands on exactly the verbs that were
confirmed too often, which are the ones where habituation already did the
damage.

## Verb inventory

What the service layer can do today, and what "full operation" of GHL and Meta
requires beyond it. This is the honest gap, not a plan.

### GHL

| Verb | Status |
| --- | --- |
| Add note to contact | `lib/ghl/contacts.ts` `addNote` |
| Move opportunity stage | `lib/ghl/opportunities.ts` `updateOpportunityStage` |
| Close opportunity won/lost | `lib/ghl/opportunities.ts` `closeOpportunity` |
| Set appointment status | `lib/ghl/appointments.ts` `setAppointmentStatus` |
| Create opportunity | missing |
| Create or update contact | missing |
| Book or reschedule appointment | missing |
| Send SMS or email to contact | missing |
| Add or remove contact tag | missing |

### Meta

| Verb | Status |
| --- | --- |
| Unpause campaign | `lib/meta/campaigns.ts` `unpauseCampaign` |
| Pause campaign | missing |
| Set campaign or ad set budget | missing |
| Create campaign | missing |
| Create ad set with targeting | missing |
| Upload creative and create ad | missing |
| Pause or unpause an individual ad | missing |

### Slack

| Verb | Status |
| --- | --- |
| Post alert to channel | `lib/slack.ts` `postAlert` |
| Create channel canvas | `lib/slack.ts` `createChannelCanvas` |
| Post as the acting user rather than the app | missing |

### Google

`lib/google/drive.ts` is read-only in full. No write verb of any kind exists.

## Reading of the gap

GHL is roughly half a CRM you can operate: the verbs that exist cover working a
deal that already exists, and none cover creating one or contacting anyone.
Meta is a reporting integration with a single verb attached. "Launch campaigns"
does not exist in any form: no create, no budget, no creative upload. Campaign
creation is the largest single item here, since it is an ad set plus targeting
plus creative plus an ad, not one call.
