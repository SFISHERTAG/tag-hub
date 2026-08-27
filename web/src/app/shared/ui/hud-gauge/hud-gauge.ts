import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Geometry of the dial, in the units of the 100x100 viewBox. */
const CENTRE = 50;
const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Fraction of the full circle the dial spans. 0.75 leaves the gap at the bottom. */
const SWEEP = 0.75;
/** Degrees to rotate the start point so that gap sits bottom-centre. */
const START_ANGLE = 135;

/**
 * A radial dial for a single number.
 *
 * The HUD direction's signature element, and the reason it is drawn rather
 * than themed: Material has no radial gauge, and producing one by overriding a
 * progress-spinner's internals would need the deep selectors CLAUDE.md bans.
 * Plain SVG owes nothing to Material, so it costs no override at all.
 *
 * Colour still comes from the token system. The arcs carry no attributes of
 * their own; `stroke` is set in the stylesheet from `--mat-sys-*`, so this
 * follows a theme change like every other surface and declares no raw hex.
 *
 * Presentational only. It takes a number and draws it. It does not know where
 * the number came from, and in particular does not know whether the number is
 * real — several dashboard metrics are still fabricated, and disclosing that
 * is `SampleDataNotice`'s job on the surface that composes this, not this
 * component's. A gauge that quietly rendered a sample value as a confident
 * dial would be the exact failure that contract exists to prevent.
 */
@Component({
  selector: 'app-hud-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hud-gauge.html',
  styleUrl: './hud-gauge.scss',
})
export class HudGauge {
  readonly value = input.required<number>();
  /** Full-scale reading. Values above it clamp to a full dial rather than overdrawing. */
  readonly max = input(100);
  /** Caption under the reading. */
  readonly label = input.required<string>();
  /** Suffix on the reading, e.g. '%'. Empty renders nothing. */
  readonly unit = input('');
  /**
   * Optional qualitative tone for the arc. The department dial replaced a
   * tile whose colour said good/warn/bad at a glance; a dial rendering 23 and
   * 95 identically dropped that signal. Null keeps the theme's default arc.
   */
  readonly tone = input<'positive' | 'caution' | 'negative' | null>(null);

  protected readonly centre = CENTRE;
  protected readonly radius = RADIUS;
  protected readonly rotation = `rotate(${START_ANGLE} ${CENTRE} ${CENTRE})`;

  /**
   * Clamped to 0..1. A negative reading or one past `max` is a data problem,
   * but a dial that draws backwards or laps itself turns it into a visual lie,
   * so the geometry is bounded here and the caller keeps the raw number.
   */
  protected readonly fraction = computed(() => {
    const max = this.max();
    if (!Number.isFinite(max) || max <= 0) return 0;
    const raw = this.value();
    if (!Number.isFinite(raw)) return 0;
    return Math.min(Math.max(raw / max, 0), 1);
  });

  /** Full dial, drawn once as the unfilled track. */
  protected readonly trackDash = `${SWEEP * CIRCUMFERENCE} ${CIRCUMFERENCE}`;

  /** The filled portion, laid over the track. */
  protected readonly valueDash = computed(
    () => `${this.fraction() * SWEEP * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
  );

  /**
   * Whether to render the value arc at all. Absent beats zero-length: the
   * round linecap renders a zero-length dash as a dot at the start angle, so
   * an "empty" dial showed a phantom reading for 0, negative and NaN inputs.
   */
  protected readonly showArc = computed(() => this.fraction() > 0);

  /** A number worth printing. NaN rendered as the literal text "NaN%". */
  protected readonly hasReading = computed(() => Number.isFinite(this.value()));

  /** Screen-reader text: the dial is decorative, this sentence is the content. */
  protected readonly readout = computed(() =>
    this.hasReading()
      ? `${this.label()}: ${this.value()}${this.unit()}`
      : `${this.label()}: no reading`,
  );
}
