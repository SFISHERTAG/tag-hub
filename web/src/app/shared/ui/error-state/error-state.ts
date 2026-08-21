import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * The visible half of the error contract.
 *
 * lib/api/errorInterceptor.ts and the Angular errorInterceptor both refuse to
 * swallow a failure; this is where the surviving typed error is shown. Feed it
 * `ApiError.message` — the server's sentence, not the transport's. The Next
 * app's version rendered the raw HttpErrorResponse, so a mistyped code told
 * people "Http failure response ... 401 Unauthorized".
 *
 * A failed read is retryable by definition, so the retry button is on by
 * default; pass `[retryable]="false"` where re-running the call cannot help.
 */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './error-state.html',
  styleUrl: './error-state.scss',
})
export class ErrorState {
  readonly message = input.required<string>();
  /** Optional second line: the context an ApiError carries, or a next step. */
  readonly detail = input<string | null>(null);
  readonly icon = input('error_outline');
  readonly retryable = input(true);
  readonly retryLabel = input('Try again');

  readonly retry = output<void>();
}
