import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { EmptyState } from './empty-state';

/**
 * Story: an empty result must read as words, never as a zero. On an operations
 * dashboard a placeholder "0" is indistinguishable from a real reading, and
 * someone will make a call on it — which is why the Next app's Pending block
 * showed nothing numeric, and why this one shows a sentence.
 *
 * The action is opt-in for the same class of reason: a button that does nothing
 * because the screen never wired it up is worse than no button.
 */

function setup(inputs: Partial<{ icon: string; message: string; hint: string | null; actionLabel: string | null }> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [EmptyState],
    providers: [provideZonelessChangeDetection()],
  });

  const fixture = TestBed.createComponent(EmptyState);
  fixture.componentRef.setInput('message', inputs.message ?? 'No clients yet.');
  if (inputs.icon !== undefined) fixture.componentRef.setInput('icon', inputs.icon);
  if (inputs.hint !== undefined) fixture.componentRef.setInput('hint', inputs.hint);
  if (inputs.actionLabel !== undefined) {
    fixture.componentRef.setInput('actionLabel', inputs.actionLabel);
  }
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
}

describe('EmptyState', () => {
  it('shows the message', () => {
    const { host } = setup({ message: 'No clients yet.' });

    expect(host.textContent).toContain('No clients yet.');
  });

  it('shows nothing numeric of its own', () => {
    // The rule this component exists for: no placeholder zero, ever.
    const { host } = setup({ message: 'No spend recorded.' });

    expect(host.textContent).not.toMatch(/\d/);
  });

  it('renders no button when no action label is given', () => {
    const { host } = setup();

    expect(host.querySelector('button')).toBeNull();
  });

  it('renders a button and emits when it is clicked', () => {
    const { fixture, host, component } = setup({ actionLabel: 'Add client' });
    const clicks = vi.fn();
    component.action.subscribe(clicks);

    const button = host.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Add client');

    button?.click();
    fixture.detectChanges();

    expect(clicks).toHaveBeenCalledTimes(1);
  });

  it('shows a hint only when given one', () => {
    expect(setup().host.querySelector('.empty-state__hint')).toBeNull();
    expect(setup({ hint: 'Clients appear once onboarding completes.' }).host.textContent).toContain(
      'Clients appear once onboarding completes.',
    );
  });

  it('uses a default icon and accepts an override', () => {
    expect(setup().host.querySelector('mat-icon')?.textContent?.trim()).toBe('inbox');
    expect(setup({ icon: 'search_off' }).host.querySelector('mat-icon')?.textContent?.trim()).toBe(
      'search_off',
    );
  });

  it('hides the icon from assistive tech', () => {
    // Decoration. The message is the content.
    const { host } = setup();

    expect(host.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
