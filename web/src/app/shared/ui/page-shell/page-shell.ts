import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The frame every ported screen sits in: one h1, an optional line of context,
 * an optional action cluster, then the page's own content.
 *
 * It exists so the four feature stories do not each invent their own heading
 * block. The Next app had five spellings of the same header and they drifted;
 * a screen that renders its title as a styled div is also a screen with no
 * document outline, which is what a screen reader navigates by.
 *
 * Actions project through the `pageActions` attribute selector rather than a
 * second input, because an action is a button with its own permission gating
 * and its own click handler — passing it as data would mean this component
 * knowing about roles, which shared/ must never do.
 *
 *   <app-page-shell title="Clients" subtitle="Everyone in your book">
 *     <button pageActions matButton="filled" (click)="add()">Add client</button>
 *     <app-data-table ... />
 *   </app-page-shell>
 */
@Component({
  selector: 'app-page-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.scss',
  // `title` is also a global HTML attribute, and Ivy writes a STATIC attribute
  // to the DOM even when a directive claims it as an input. Without this,
  // `<app-page-shell title="Clients">` gives the whole page section a native
  // browser tooltip. Clearing it here costs nothing: the heading is rendered
  // from the input either way.
  host: { '[attr.title]': 'null' },
})
export class PageShell {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
