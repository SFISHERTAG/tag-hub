import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type LoadingVariant = 'spinner' | 'skeleton';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * One loading treatment, two shapes, and a hard rule about motion.
 *
 * `skeleton` is the default for anything with known structure (a table, a list
 * of cards) because it holds the layout still; `spinner` is for a small area
 * where a skeleton would be a lie about what is coming.
 *
 * Reduced motion is honoured twice over, deliberately. The shimmer is a CSS
 * animation, so a media query switches it off without JavaScript. The spinner
 * cannot be stopped that way — Material's own keyframes drive it, and the only
 * ways to reach them are `::ng-deep` or `!important`, both banned. So when the
 * viewer has asked for reduced motion the spinner is not rendered at all: the
 * component falls back to the static skeleton plus its label. Fewer moving
 * pixels is the correct answer to that request anyway.
 */
@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressSpinnerModule],
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.scss',
})
export class LoadingState {
  readonly variant = input<LoadingVariant>('skeleton');
  /** Announced to assistive tech, and shown next to the spinner. */
  readonly label = input('Loading');
  /** Skeleton bars to draw. Match it to the rows you are waiting for. */
  readonly rows = input(3);

  private readonly reducedMotion = signal(false);

  protected readonly showSpinner = computed(
    () => this.variant() === 'spinner' && !this.reducedMotion(),
  );

  protected readonly skeletonRows = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index),
  );

  constructor() {
    const query = inject(MediaMatcher).matchMedia(REDUCED_MOTION_QUERY);
    this.reducedMotion.set(query.matches);

    const onChange = (event: MediaQueryListEvent): void => this.reducedMotion.set(event.matches);
    query.addEventListener?.('change', onChange);
    inject(DestroyRef).onDestroy(() => query.removeEventListener?.('change', onChange));
  }
}
