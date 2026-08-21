import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * "There is nothing here" — said out loud, once, in one voice.
 *
 * The rule this encodes comes from the Next app's Pending block: an empty
 * result never renders a zero. On an operations dashboard a placeholder 0 is
 * indistinguishable from a real reading, and someone will make a call on it.
 * So an empty state shows words and, where there is something useful to do
 * about it, one button.
 *
 * The action is optional and opt-in: no `actionLabel`, no button. A dead
 * button in an empty state is worse than no button.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  /** Material Icons ligature name. */
  readonly icon = input('inbox');
  readonly message = input.required<string>();
  /** Second line: why it is empty, or what fills it. */
  readonly hint = input<string | null>(null);
  /** Omit to render no button at all. */
  readonly actionLabel = input<string | null>(null);

  readonly action = output<void>();
}
