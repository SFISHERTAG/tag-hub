import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';

interface WorkspaceTab {
  readonly path: string;
  readonly label: string;
}

/**
 * The four screens that make up one client's day, and the frame around them.
 *
 * Ports `legacy/l/[locationId]/layout.tsx` in the part that matters: a single
 * place where every route under a location lives, so a screen added here
 * inherits the access check by construction instead of remembering to declare
 * one. The guards sit on the route (ghl.routes.ts), not in this component —
 * a component that renders is already too late to refuse anything.
 *
 * NOT ported from that layout: the tenant name header, the freshness indicator
 * and the location switcher. All three need endpoints that do not exist on this
 * branch (tenant lookup, dashboard freshness), and a switcher listing raw
 * location ids would be worse than the portfolio screen that already does this
 * job properly. Flagged in the story report rather than half-built.
 */
@Component({
  selector: 'app-location-workspace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, MatTabsModule],
  templateUrl: './location-workspace.html',
  styleUrl: './location-workspace.scss',
})
export class LocationWorkspace {
  /** Relative links: the workspace route owns `:locationId`, so `['pipeline']`
   * resolves under whichever client is open without the id appearing here. */
  protected readonly tabs: readonly WorkspaceTab[] = [
    { path: 'pipeline', label: 'Pipeline' },
    { path: 'today', label: 'Today' },
    { path: 'contacts', label: 'Contacts' },
    { path: 'follow-up', label: 'Follow-up' },
  ];
}
