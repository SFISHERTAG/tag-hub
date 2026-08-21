import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { DashboardCustomize } from './dashboard-customize';
import { DashboardConfigService } from '../services/dashboard-config.service';
import { ok } from '../../../core/models/api-result.model';
import { ROLES } from '../../../core/models/role.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { DashboardConfig, WidgetDefinition } from '../../../shared/widgets/widget.model';
import type { DashboardConfigResponse, DashboardConfigSaveResponse } from '../services/dashboard.model';

/**
 * Story: this screen saves on every click, which makes one failure mode
 * unusually damaging — showing an edit that was refused.
 *
 * The Next version applied each edit locally, showed an error if the save
 * failed, and left the rejected layout on screen. The user watched their change
 * take effect, and the next page load silently undid it. So: an optimistic edit
 * with a real rollback, and the server's echo replacing the local copy on
 * success rather than the local copy standing in for it.
 *
 * The second theme is entitlement. The picker is not the boundary; a 403 from
 * the endpoint is. This screen has to survive one and say so.
 */

const load = vi.fn<() => Promise<ApiResult<DashboardConfigResponse>>>();
const save = vi.fn<(config: DashboardConfig) => Promise<ApiResult<DashboardConfigSaveResponse>>>();

function widget(id: string, title: string, cols = 2, rows = 1): WidgetDefinition {
  return {
    id,
    title,
    availableFor: [ROLES.TAG_CSM],
    defaultSize: { cols, rows },
    description: `${title} description`,
  };
}

function config(widgetIds: string[] = ['portfolio']): DashboardConfig {
  return {
    role: ROLES.TAG_CSM,
    pages: [
      {
        id: 'main',
        title: 'Main',
        widgets: widgetIds.map((id) => ({
          id,
          widgetId: id,
          position: { x: 0, y: 0 },
          size: { cols: 2, rows: 1 },
        })),
      },
    ],
    currentPage: 0,
    updatedAt: 100,
  };
}

function response(overrides: Partial<DashboardConfigResponse> = {}): DashboardConfigResponse {
  return {
    config: config(),
    currentPageId: 'main',
    availableWidgets: [widget('portfolio', 'Portfolio'), widget('client_health', 'Client Health')],
    removedWidgetIds: [],
    sampleDataWidgetIds: ['portfolio', 'client_health'],
    locationId: null,
    lastUpdated: { timestamp: null, source: null },
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DashboardCustomize],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: DashboardConfigService, useValue: { load, save } },
    ],
  });

  const fixture = TestBed.createComponent(DashboardCustomize);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, text: () => fixture.nativeElement.textContent ?? '' };
}

describe('DashboardCustomize', () => {
  beforeEach(() => {
    load.mockReset();
    save.mockReset();
    load.mockResolvedValue(ok(response()));
    save.mockImplementation((next) => Promise.resolve(ok({ ok: true as const, config: next })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the widgets on the page and the ones available to add', async () => {
    const { text } = await setup();

    expect(text()).toContain('On this page (1)');
    expect(text()).toContain('Portfolio');
    expect(text()).toContain('Client Health');
  });

  it('marks which widgets show fabricated numbers, before they are added', async () => {
    const { text } = await setup();

    // Cheapest place to learn it is the picker, not after the tile is live.
    expect(text()).toContain('sample data');
  });

  it('saves an added widget immediately', async () => {
    const { fixture } = await setup();

    fixture.componentInstance['toggle'](widget('client_health', 'Client Health'));
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]?.[0];
    expect(saved?.pages[0]?.widgets.map((w) => w.widgetId)).toEqual(['portfolio', 'client_health']);
  });

  it('rolls the layout back when the save is refused', async () => {
    const { fixture, text } = await setup();

    save.mockResolvedValue({
      data: null,
      error: {
        message: 'Widget "client_health" is not available for this role.',
        context: 'PUT /api/dashboard/config',
        status: 403,
      },
    });

    fixture.componentInstance['toggle'](widget('client_health', 'Client Health'));
    await settle();
    fixture.detectChanges();

    // The layout on screen is the layout that is stored. Anything else teaches
    // people to trust an edit that did not happen.
    expect(fixture.componentInstance['placements']().map((p) => p.widgetId)).toEqual(['portfolio']);
    expect(text()).toContain('not available for this role');
    expect(text()).toContain('has been undone');
  });

  it('takes the server echo as the stored layout, not the local copy', async () => {
    const { fixture } = await setup();

    save.mockResolvedValue(
      ok({ ok: true as const, config: { ...config(['portfolio']), updatedAt: 999 } }),
    );

    fixture.componentInstance['resize'](0, 'cols', 1);
    await settle();

    // The server stamps updatedAt; a local copy that kept 100 would disagree
    // with what is stored from the moment the save landed.
    expect(fixture.componentInstance['config']()?.updatedAt).toBe(999);
  });

  it('does not save when an edit changes nothing', async () => {
    load.mockResolvedValue(
      ok(
        response({
          config: {
            ...config(['portfolio']),
            pages: [
              {
                id: 'main',
                title: 'Main',
                widgets: [
                  {
                    id: 'portfolio',
                    widgetId: 'portfolio',
                    position: { x: 0, y: 0 },
                    size: { cols: 4, rows: 4 },
                  },
                ],
              },
            ],
          },
        }),
      ),
    );

    const { fixture } = await setup();

    // Already at the maximum on both axes: a PUT here would be a write that
    // looks like an edit and is not one.
    fixture.componentInstance['resize'](0, 'cols', 1);
    fixture.componentInstance['resize'](0, 'rows', 1);
    await settle();

    expect(save).not.toHaveBeenCalled();
  });

  it('shows a load failure as an error rather than an empty layout', async () => {
    load.mockResolvedValue({
      data: null,
      error: { message: 'Config unavailable.', context: 'GET /api/dashboard/config' },
    });

    const { text } = await setup();

    expect(text()).toContain('Config unavailable.');
    expect(text()).not.toContain('Nothing on this page yet');
  });
});
