import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MediaMatcher } from '@angular/cdk/layout';
import { LoadingState } from './loading-state';

/**
 * Story: the reduced-motion promise is the whole reason this component exists
 * rather than a bare <mat-spinner> in each screen.
 *
 * Half of it is CSS — a media query kills the skeleton shimmer — but the
 * spinner's animation lives inside Material's own styles, and the only ways to
 * reach it from here are ::ng-deep or !important, both banned by CLAUDE.md. So
 * the component answers the request the honest way: when reduced motion is
 * asked for, the spinner is not rendered at all and the static skeleton stands
 * in. These tests pin that, because "we respect reduced motion" is exactly the
 * kind of claim that quietly stops being true.
 */

class FakeQuery {
  private readonly listeners = new Set<(event: MediaQueryListEvent) => void>();

  constructor(public matches: boolean) {}

  addEventListener(_type: string, listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MediaQueryListEvent) => void): void {
    this.listeners.delete(listener);
  }

  emit(matches: boolean): void {
    this.matches = matches;
    for (const listener of this.listeners) {
      listener({ matches } as MediaQueryListEvent);
    }
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function setup(
  inputs: Partial<{ variant: 'spinner' | 'skeleton'; rows: number; label: string }> = {},
  reducedMotion = false,
) {
  const query = new FakeQuery(reducedMotion);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [LoadingState],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MediaMatcher, useValue: { matchMedia: () => query } },
    ],
  });

  const fixture = TestBed.createComponent(LoadingState);
  if (inputs.variant !== undefined) fixture.componentRef.setInput('variant', inputs.variant);
  if (inputs.rows !== undefined) fixture.componentRef.setInput('rows', inputs.rows);
  if (inputs.label !== undefined) fixture.componentRef.setInput('label', inputs.label);
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement, query };
}

describe('LoadingState', () => {
  it('draws a skeleton by default', () => {
    const { host } = setup();

    expect(host.querySelectorAll('.loading-state__bar').length).toBe(3);
    expect(host.querySelector('mat-spinner')).toBeNull();
  });

  it('draws one bar per row asked for', () => {
    expect(setup({ rows: 6 }).host.querySelectorAll('.loading-state__bar').length).toBe(6);
  });

  it('never draws zero bars', () => {
    // A skeleton with no bars is an invisible loading state, which reads as an
    // empty screen.
    expect(setup({ rows: 0 }).host.querySelectorAll('.loading-state__bar').length).toBe(1);
  });

  it('draws a spinner when asked and motion is allowed', () => {
    const { host } = setup({ variant: 'spinner' });

    expect(host.querySelector('mat-spinner')).not.toBeNull();
  });

  it('drops the spinner when reduced motion is preferred', () => {
    const { host } = setup({ variant: 'spinner' }, true);

    // The substitution, not a workaround: Material's spinner keyframes cannot
    // be stopped from here without ::ng-deep or !important.
    expect(host.querySelector('mat-spinner')).toBeNull();
    expect(host.querySelectorAll('.loading-state__bar').length).toBeGreaterThan(0);
  });

  it('reacts to the preference changing mid-life', () => {
    const { fixture, host, query } = setup({ variant: 'spinner' });
    expect(host.querySelector('mat-spinner')).not.toBeNull();

    query.emit(true);
    fixture.detectChanges();

    expect(host.querySelector('mat-spinner')).toBeNull();
  });

  it('stops listening when destroyed', () => {
    // A media query listener outliving its component is a leak on every screen
    // that ever showed a spinner.
    const { fixture, query } = setup({ variant: 'spinner' });
    expect(query.listenerCount).toBe(1);

    fixture.destroy();

    expect(query.listenerCount).toBe(0);
  });

  it('announces what is loading', () => {
    const { host } = setup({ label: 'Loading clients' });
    const status = host.querySelector('[role="status"]');

    expect(status?.getAttribute('aria-label')).toBe('Loading clients');
  });

  it('keeps the skeleton out of the accessibility tree', () => {
    // The role="status" label is the announcement; a stack of decorative bars
    // announced individually is noise.
    const { host } = setup();

    expect(host.querySelector('.loading-state__skeleton')?.getAttribute('aria-hidden')).toBe('true');
  });
});
