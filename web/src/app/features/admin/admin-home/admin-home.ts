import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { PageShell } from '../../../shared/ui';

interface AdminSection {
  readonly path: string;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

/**
 * The four things an admin can administer, and nothing else.
 *
 * The Next app had no `/admin` index: the nav pointed at `/admin` and every
 * sub-page linked only back to its own list, so the only way from Users to
 * Tenants was to know the URL. One index costs a route and removes that.
 *
 * Real anchors rather than click handlers, so each is keyboard reachable and
 * openable in a new tab. Each destination re-runs `permissionGuard`, and the
 * API behind it re-checks the role regardless.
 */
const SECTIONS: readonly AdminSection[] = [
  {
    path: 'users',
    label: 'Users',
    description: 'Roles, groups and CS reporting lines.',
    icon: 'group',
  },
  {
    path: 'tenants',
    label: 'Tenants',
    description: 'Client entitlements, owner model and Meta ids.',
    icon: 'business',
  },
  {
    path: 'courses',
    label: 'Courses',
    description: 'Training content: sections, lessons and checklists.',
    icon: 'school',
  },
  {
    path: 'knowledge-base',
    label: 'Knowledge base',
    description: 'The CSM operating manual, with version history.',
    icon: 'menu_book',
  },
];

@Component({
  selector: 'app-admin-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, MatIconModule, PageShell],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.scss',
})
export class AdminHome {
  protected readonly sections = SECTIONS;
}
