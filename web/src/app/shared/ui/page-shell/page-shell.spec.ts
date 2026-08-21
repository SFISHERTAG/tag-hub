import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PageShell } from './page-shell';

/**
 * Story: this is the one heading block for every ported screen, so the things
 * worth pinning are the ones a second implementation would get subtly wrong.
 *
 * The title has to be an h1. A screen reader navigates by the document outline,
 * and a "title" rendered as a styled div leaves a page with no outline at all —
 * which is what the Next app shipped on five of its screens.
 *
 * And a page with no actions must not pay for the header's flex gap, or every
 * heading in the app sits a few pixels off from every other one.
 */

@Component({
  selector: 'app-page-shell-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell],
  template: `
    <app-page-shell title="Clients" [subtitle]="subtitle()">
      @if (withActions()) {
        <button pageActions type="button" class="host-action">Add client</button>
      }
      <p class="host-content">Projected body</p>
    </app-page-shell>
  `,
})
class PageShellHost {
  readonly subtitle = signal<string | null>(null);
  readonly withActions = signal(false);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [PageShellHost],
    providers: [provideZonelessChangeDetection()],
  });

  const fixture = TestBed.createComponent(PageShellHost);
  fixture.detectChanges();
  return { fixture, host: fixture.nativeElement as HTMLElement, component: fixture.componentInstance };
}

describe('PageShell', () => {
  it('renders the title as the page h1', () => {
    const { host } = setup();

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Clients');
  });

  it('takes a static attribute as an input without leaking it to the DOM', () => {
    // `title` is also a global HTML attribute. If Angular left it on the host
    // element, every page heading would carry a native browser tooltip.
    const { host } = setup();

    expect(host.querySelector('app-page-shell')?.getAttribute('title')).toBeNull();
  });

  it('omits the subtitle when there is none', () => {
    const { host } = setup();

    expect(host.querySelector('.page-shell__subtitle')).toBeNull();
  });

  it('renders a subtitle when given one', () => {
    const { fixture, host, component } = setup();
    component.subtitle.set('Everyone in your book');
    fixture.detectChanges();

    expect(host.querySelector('.page-shell__subtitle')?.textContent?.trim()).toBe(
      'Everyone in your book',
    );
  });

  it('projects page content', () => {
    const { host } = setup();

    expect(host.querySelector('.host-content')?.textContent).toBe('Projected body');
  });

  it('projects actions into the header, not the body', () => {
    const { fixture, host, component } = setup();
    component.withActions.set(true);
    fixture.detectChanges();

    const action = host.querySelector('.host-action');
    expect(action).not.toBeNull();
    expect(action?.closest('.page-shell__actions')).not.toBeNull();
  });

  it('renders no action element when a page projects none', () => {
    // Elements, not nodes: an action gated by @if or *hasPermission leaves a
    // comment anchor in the slot even when it renders nothing, which is why
    // the header's layout must not depend on :empty matching.
    const { host } = setup();

    expect(host.querySelector('.page-shell__actions')?.childElementCount).toBe(0);
  });
});
