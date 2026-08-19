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

/** Below this width the shell switches from a permanent side rail to a bottom nav bar. */
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
  selector: 'app-root',
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
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly breakpointObserver = inject(BreakpointObserver);

  protected readonly title = signal('TAG Cockpit');
  protected readonly navItems = NAV_ITEMS;

  /** true = wide layout (permanent sidenav), false = narrow layout (bottom nav). */
  protected readonly isWide = toSignal(
    this.breakpointObserver.observe(SIDENAV_BREAKPOINT).pipe(map((state) => state.matches)),
    { initialValue: false },
  );
}
