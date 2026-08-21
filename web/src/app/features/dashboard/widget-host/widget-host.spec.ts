import { TestBed } from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  type Type,
  provideZonelessChangeDetection,
} from '@angular/core';
import { WidgetHost } from './widget-host';
import { WidgetRegistryService, type WidgetLoader } from '../../../shared/widgets/widget-registry.service';
import { PermissionService } from '../../../core/services/permission.service';
import { ROLES, type Role } from '../../../core/models/role.model';

/**
 * Story: this is the component that keeps the dashboard shell ignorant of what
 * a widget is, so the behaviour worth pinning is that it never guesses.
 *
 * Four not-rendered states, deliberately distinct, because they have different
 * fixes: an id that is not in the registry, an id this hat may not use, a
 * definition with no component behind it yet, and a chunk that failed to load.
 * Collapsing them into one "something went wrong" tile is what makes a
 * dashboard feel broken rather than incomplete.
 *
 * The permission branch is cosmetic and this file says so out loud: the server
 * strips those placements on read and every widget data endpoint returns 403
 * regardless. A passing test here is not evidence of a security control.
 */

@Component({
  selector: 'app-fake-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p>fake widget body</p>',
})
class FakeWidget {}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(
  widgetId: string,
  options: { role?: Role; loaders?: Record<string, WidgetLoader> } = {},
) {
  const role = options.role ?? ROLES.TAG_CSM;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [WidgetHost],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: PermissionService,
        useValue: {
          currentRole: () => role,
          hasAnyRole: (allowed: readonly Role[]) => allowed.includes(role),
        },
      },
    ],
  });

  // Same root instance the component will inject, so registrations here are the
  // ones it resolves against.
  const registry = TestBed.inject(WidgetRegistryService);
  for (const [id, loader] of Object.entries(options.loaders ?? {})) {
    registry.registerLoader(id, loader);
  }

  const fixture = TestBed.createComponent(WidgetHost);
  fixture.componentRef.setInput('widgetId', widgetId);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, text: (): string => fixture.nativeElement.textContent ?? '' };
}

const fakeLoader: WidgetLoader = () => Promise.resolve(FakeWidget as Type<unknown>);

describe('WidgetHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the registered component for an entitled widget', async () => {
    const { text } = await setup('portfolio', { loaders: { portfolio: fakeLoader } });

    expect(text()).toContain('Portfolio');
    expect(text()).toContain('fake widget body');
  });

  it('says a widget is not built rather than rendering an empty tile', async () => {
    // In the shared registry, no loader registered: the honest state for a
    // widget whose screen has not landed.
    const { text } = await setup('team_performance', { role: ROLES.TAG_EXEC });

    expect(text()).toContain('Team Performance');
    expect(text()).toContain('Not built yet');
  });

  it('names the widget from the registry even when it cannot render it', async () => {
    const { text } = await setup('team_performance', { role: ROLES.TAG_EXEC });

    // A tile with no title is indistinguishable from a layout bug.
    expect(text()).toContain('Rep and team metrics');
  });

  it('tells a hat that cannot use a widget why, not that it is broken', async () => {
    // team_health_rollup is CSD-only in the shared registry.
    const { text } = await setup('team_health_rollup', {
      role: ROLES.TAG_CSM,
      loaders: { team_health_rollup: fakeLoader },
    });

    expect(text()).toContain('not available for the hat you are wearing');
    expect(text()).not.toContain('fake widget body');
  });

  it('reports an id the registry has never heard of as removable', async () => {
    const { text } = await setup('a_widget_that_was_deleted');

    expect(text()).toContain('no longer exists');
  });

  it('survives a chunk that fails to load instead of taking the page down', async () => {
    const { text } = await setup('portfolio', {
      loaders: { portfolio: () => Promise.reject(new Error('network')) },
    });

    expect(text()).toContain('Not built yet');
  });

  it('follows a changed id instead of leaving the previous widget rendered', async () => {
    const { fixture, text } = await setup('portfolio', { loaders: { portfolio: fakeLoader } });
    expect(text()).toContain('fake widget body');

    fixture.componentRef.setInput('widgetId', 'a_widget_that_was_deleted');
    fixture.detectChanges();
    await settle();
    fixture.detectChanges();

    expect(text()).not.toContain('fake widget body');
    expect(text()).toContain('no longer exists');
  });
});
