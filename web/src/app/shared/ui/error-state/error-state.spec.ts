import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ErrorState } from './error-state';

/**
 * Story: this is the visible end of the error contract. lib/api's interceptor
 * and the Angular errorInterceptor both refuse to swallow a failure, and this
 * is where the surviving typed error is read by a person.
 *
 * Two things are load-bearing. The message is announced (role="alert"), because
 * a failed background refresh that renders silently is indistinguishable from
 * one that worked. And retry is offered by default, because the failure this
 * component exists for — a dropped request, a 500 — is usually transient; the
 * escape hatch is for the cases where re-running it cannot help.
 */

function setup(
  inputs: Partial<{ message: string; detail: string | null; retryable: boolean; retryLabel: string }> = {},
) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ErrorState],
    providers: [provideZonelessChangeDetection()],
  });

  const fixture = TestBed.createComponent(ErrorState);
  fixture.componentRef.setInput('message', inputs.message ?? 'That did not load.');
  if (inputs.detail !== undefined) fixture.componentRef.setInput('detail', inputs.detail);
  if (inputs.retryable !== undefined) fixture.componentRef.setInput('retryable', inputs.retryable);
  if (inputs.retryLabel !== undefined) fixture.componentRef.setInput('retryLabel', inputs.retryLabel);
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
}

describe('ErrorState', () => {
  it('shows the message it was given', () => {
    // Feed it ApiError.message — the server's sentence. The Next app rendered
    // the raw HttpErrorResponse, so a mistyped code read as
    // "Http failure response ... 401 Unauthorized".
    const { host } = setup({ message: 'That code is not right.' });

    expect(host.textContent).toContain('That code is not right.');
  });

  it('announces itself', () => {
    const { host } = setup();

    expect(host.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('offers retry by default and emits on click', () => {
    const { fixture, host, component } = setup();
    const retries = vi.fn();
    component.retry.subscribe(retries);

    const button = host.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Try again');

    button?.click();
    fixture.detectChanges();

    expect(retries).toHaveBeenCalledTimes(1);
  });

  it('drops the button when retrying cannot help', () => {
    const { host } = setup({ retryable: false });

    expect(host.querySelector('button')).toBeNull();
  });

  it('accepts a specific retry label', () => {
    const { host } = setup({ retryLabel: 'Reload portfolio' });

    expect(host.querySelector('button')?.textContent?.trim()).toBe('Reload portfolio');
  });

  it('shows a detail line only when given one', () => {
    expect(setup().host.querySelector('.error-state__detail')).toBeNull();
    expect(setup({ detail: 'GET /api/clients' }).host.textContent).toContain('GET /api/clients');
  });
});
