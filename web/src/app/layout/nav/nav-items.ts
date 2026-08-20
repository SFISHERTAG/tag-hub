import { ROLES, type Role } from '../../core/models/role.model';

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
 * When feature routes land, their `data.permission` and the entry here are set
 * together.
 *
 * `tag_csd` is called out because they were the bug. In the Next app's nav they
 * matched zero entries, so a CS Director signed in to an empty tab bar, and the
 * team_health_rollup widget built for them was unreachable. A director sees the
 * whole department, so they belong anywhere a CSM belongs and then some.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    // Everyone gets a dashboard; which widgets appear is decided by the widget
    // registry, not by hiding the whole page.
    permission: [
      ROLES.ADMIN,
      ROLES.TAG_EXEC,
      ROLES.TAG_CSD,
      ROLES.TAG_CSM,
      ROLES.TAG_SALES_MANAGER,
      ROLES.TAG_SALES,
      ROLES.TAG_SETTER_MANAGER,
      ROLES.TAG_SETTER,
      ROLES.CLIENT_OWNER,
      ROLES.CLIENT_MANAGER,
      ROLES.CLIENT_CLOSER,
      ROLES.CLIENT_SETTER_MANAGER,
      ROLES.CLIENT_SETTER,
    ],
  },
  {
    path: '/portfolio',
    label: 'Portfolio',
    icon: 'business',
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM, ROLES.TAG_SALES_MANAGER],
  },
  {
    path: '/clients',
    label: 'Clients',
    icon: 'groups',
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM],
  },
  {
    path: '/onboarding',
    label: 'Onboarding',
    icon: 'checklist',
    permission: [ROLES.TAG_EXEC, ROLES.TAG_CSD, ROLES.TAG_CSM],
  },
  {
    path: '/flow',
    label: 'FLOW',
    icon: 'record_voice_over',
    permission: [
      ROLES.TAG_EXEC,
      ROLES.TAG_SALES_MANAGER,
      ROLES.TAG_SALES,
      ROLES.CLIENT_CLOSER,
      ROLES.CLIENT_MANAGER,
    ],
  },
  {
    path: '/setter',
    label: 'Setter',
    icon: 'speed',
    permission: [
      ROLES.TAG_EXEC,
      ROLES.TAG_SETTER_MANAGER,
      ROLES.TAG_SETTER,
      ROLES.CLIENT_SETTER_MANAGER,
      ROLES.CLIENT_SETTER,
    ],
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: 'admin_panel_settings',
    permission: [ROLES.ADMIN],
  },
];
