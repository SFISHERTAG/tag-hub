import { ROLES, ROLE_LIST, type Role } from '../../core/models/role.model';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  /** Which hats see this item. Cosmetic: the route guard is authoritative. */
  readonly permission: readonly Role[];
}

/**
 * The single source of truth for navigation.
 *
 * One list, two presentations. The side rail and the bottom bar both render
 * from this, which is what makes "one responsive shell, not two layouts" true
 * rather than aspirational: there is no second list to drift.
 *
 * Every item declares the hats that see it, and the template gates on that with
 * *hasPermission. This is cosmetic by contract. The route guard decides what is
 * reachable and the API decides what is returnable, so a hidden link is a
 * courtesy, never a control.
 *
 * The rule these permissions must obey: an item's list has to be a subset of
 * what its route guard allows. Showing a link the guard refuses sends people
 * into a redirect; hiding one the guard permits makes a feature undiscoverable.
 *
 * Each entry below names the guard it is a subset of. Those guards live in the
 * feature `*.routes.ts` files and are NOT imported here: layout/ must not
 * import features/ (eslint `no-restricted-imports`), and importing them would
 * also pull every feature's routes module into the initial bundle. The two
 * lists are kept in step by hand, which is why each one is annotated.
 *
 * `tag_csd` is called out because they were the bug. In the Next app's nav they
 * matched zero entries, so a CS Director signed in to an empty tab bar, and the
 * team_health_rollup widget built for them was unreachable. A director sees the
 * whole department, so they belong anywhere a CSM belongs and then some. After
 * this pass they match five entries: Dashboard, Portfolio, Clients, Training
 * and Knowledge base. It was six until story 10.9 moved Report a bug into the
 * user menu.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    // Subset of DASHBOARD_ROLES (features/dashboard/dashboard.routes.ts), which
    // is ROLE_LIST. Spelled the same way rather than hand-copied: a role added
    // to ROLES is a role with a dashboard, and a hand-written list is the one
    // that goes stale and reintroduces the empty-nav bug for the new hat.
    // Which widgets appear is decided by the widget registry and enforced
    // server-side, not by hiding the whole page.
    permission: ROLE_LIST,
  },
  {
    path: '/portfolio',
    label: 'Portfolio',
    icon: 'business',
    // Equal to PORTFOLIO_ROLES (features/portfolio/portfolio.routes.ts).
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM, ROLES.TAG_SALES_MANAGER],
  },
  {
    path: '/clients',
    label: 'Clients',
    icon: 'groups',
    // Equal to CLIENT_BOOK_ROLES (features/clients/clients.routes.ts).
    // ADMIN added: the guard and `GET /api/clients` both admit admin, so
    // without it an admin could reach the book by typing the URL and had no
    // link to it. Matching the endpoint beats narrowing the guard.
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM, ROLES.ADMIN],
  },
  {
    path: '/onboarding',
    label: 'Onboarding',
    icon: 'checklist',
    // Equal to ONBOARDING_ROLES (features/onboarding/onboarding.routes.ts),
    // which mirrors ONBOARDING_ROLES in app/api/onboarding/_launch.ts.
    // TAG_CSD removed: this entry was wider than both the guard and the API, so
    // a CS Director clicking it was bounced. If a director should have
    // onboarding, the endpoint has to say so first — widening the nav alone
    // just moves the bounce.
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSM],
  },
  {
    path: '/flow',
    label: 'FLOW',
    icon: 'record_voice_over',
    // Equal to FLOW_ROLES (features/flow/flow.routes.ts), which is the legacy
    // page's allowlist. Two corrections: CLIENT_MANAGER dropped (never in that
    // allowlist, so the link bounced), TAG_SETTER and CLIENT_SETTER added (they
    // were in it, so the scripts were undiscoverable for the people reading
    // them on a booked call).
    permission: [
      ROLES.TAG_EXEC,
      ROLES.TAG_SALES_MANAGER,
      ROLES.TAG_SALES,
      ROLES.TAG_SETTER,
      ROLES.CLIENT_CLOSER,
      ROLES.CLIENT_SETTER,
    ],
  },
  {
    path: '/setter',
    label: 'Setter',
    icon: 'speed',
    // Equal to SETTER_ROLES (features/setter/setter.routes.ts), which mirrors
    // the gate in app/api/setter/dashboard/route.ts exactly. The two
    // setter-manager hats are removed: the endpoint refuses them, so the link
    // was a redirect. A manager view needs an endpoint before it needs a link.
    permission: [ROLES.TAG_EXEC, ROLES.TAG_SETTER, ROLES.CLIENT_SETTER],
  },
  {
    path: '/courses',
    label: 'Training',
    icon: 'school',
    // Subset of COURSE_ROLES (features/courses/courses.routes.ts), which is
    // ROLE_LIST. `GET /api/courses` gates on authentication only.
    permission: ROLE_LIST,
  },
  {
    path: '/knowledge-base',
    label: 'Knowledge base',
    icon: 'menu_book',
    // Equal to KNOWLEDGE_BASE_ROLES (features/knowledge-base/
    // knowledge-base.routes.ts), which mirrors INTERNAL_ROLES behind
    // isInternalRole in lib/auth/session.ts — the gate the endpoint checks.
    permission: [
      ROLES.ADMIN,
      ROLES.TAG_EXEC,
      ROLES.TAG_CSD,
      ROLES.TAG_CSM,
      ROLES.TAG_SALES_MANAGER,
      ROLES.TAG_SALES,
      ROLES.TAG_SETTER_MANAGER,
      ROLES.TAG_SETTER,
    ],
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    // Equal to ADMIN_ROLES (features/admin/admin.routes.ts).
    permission: [ROLES.ADMIN],
  },
  // Report a bug used to sit here, last, with a note calling it "the obvious
  // first candidate to move into a bottom-nav overflow sheet when one lands".
  // Story 10.9 landed the user menu, which is that overflow, and moved it there.
  // The route and its guard are unchanged; only the entry point moved, so it now
  // appears in exactly one place instead of competing with nine destinations.
];

/**
 * NOT in this list, and the omission is deliberate: the GHL client workspace
 * (`/l/:locationId/pipeline|today|contacts|follow-up`).
 *
 * `NavItem.path` is a fixed string bound straight to `routerLink`, and there is
 * no fixed string for a route with a tenant parameter in it. A `/l` entry would
 * match no route and fail the navigation, which is worse than no entry.
 *
 * The consequence is real and is flagged rather than papered over: the five
 * client hats reach their own pipeline only through a link that does not exist
 * yet, because Portfolio (the one screen that navigates into `/l/{id}`) is
 * TAG-internal. Closing it needs the shell to resolve an active location
 * (`session.impersonation?.locationId`, else the single entry in
 * `session.locations`) and a `locationScoped` flag here — a change to
 * layout/shell, which is outside what this pass owns.
 */
