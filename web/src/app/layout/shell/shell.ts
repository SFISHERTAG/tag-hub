import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { map } from 'rxjs';

/**
 * The one responsive shell: mat-toolbar + mat-sidenav at >=840px, mat-toolbar +
 * bottom nav below it, one component tree either way.
 *
 * Lives here rather than in app.ts, and is lazy-loaded, for a measured reason.
 * As the root component it put mat-list, mat-sidenav, mat-icon, mat-toolbar and
 * cdk/scrolling into the initial bundle — about 75 kB of chrome downloaded by
 * every visitor, including a signed-out one whose only destination is /signin.
 * Behind a lazy route guarded by authGuard, none of that loads until there is a
 * session to show it to.
 *
 * Below this width the shell switches from a permanent side rail to a bottom nav bar.
 */
const SIDENAV_BREAKPOINT = '(min-width: 840px)';

interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
}

/** Placeholder nav — each feature area's route is added as its module lands in Phase 3. */
const NAV_ITEMS: readonly NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/portfolio', label: 'Portfolio', icon: 'business' },
  { path: '/csm-dashboard', label: 'CSM', icon: 'groups' },
  { path: '/onboarding', label: 'Onboarding', icon: 'checklist' },
  { path: '/closer', label: 'FLOW', icon: 'record_voice_over' },
  { path: '/setter', label: 'Setter', icon: 'speed' },
  { path: '/admin', label: 'Admin', icon: 'admin_panel_settings' },
];

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly title = signal('TAG Cockpit');
  protected readonly navItems = NAV_ITEMS;

  /** true = wide layout (permanent sidenav), false = narrow layout (bottom nav). */
  protected readonly isWide = toSignal(
    this.breakpointObserver.observe(SIDENAV_BREAKPOINT).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
