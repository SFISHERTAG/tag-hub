import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { NAV_ITEMS } from '../nav/nav-items';
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
    HasPermissionDirective,
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
