import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Bootstrap host, and deliberately nothing else.
 *
 * This used to BE the shell: toolbar, sidenav, nav list, the lot. As the root
 * component that put five Material modules into the initial bundle for every
 * visitor, including a signed-out one who only ever reaches /signin. The shell
 * now lives at layout/shell and loads behind a guarded lazy route, so its cost
 * falls on the people who actually see it.
 *
 * Keep this component empty. Anything imported here is paid for on first paint
 * by everyone, forever.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
