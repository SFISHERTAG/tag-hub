import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { WidgetRegistryService } from './widget-registry.service';
import { ROLES } from '../../core/models/role.model';

/**
 * Story: the registry is what lets the dashboard shell stay ignorant of GHL,
 * Meta, Drive and Slack. Placements resolve by id and by required permission,
 * and each widget's own feature module registers its loader, so `shared/` never
 * imports a feature. These tests pin the parts of that contract a refactor could
 * quietly break.
 *
 * The role lists here are asserted against real product decisions, not against
 * whatever the file currently says — a test that reads the implementation back
 * to itself would have happily accepted tag_csd seeing nothing.
 */

@Component({ selector: 'app-fake-widget', template: '' })
class FakeWidget {}

describe('WidgetRegistryService', () => {
  let registry: WidgetRegistryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(WidgetRegistryService);
  });

  it('returns a definition by id', () => {
    const definition = registry.getDefinition('portfolio');

    expect(definition?.title).toBe('Portfolio');
    expect(definition?.defaultSize).toEqual({ cols: 2, rows: 2 });
  });

  it('returns undefined for an unknown id rather than throwing', () => {
    // A stale placement in a saved layout must not take the dashboard down.
    expect(registry.getDefinition('widget_that_was_removed')).toBeUndefined();
  });

  /**
   * Six roles resolve to an empty dashboard, identically here and in
   * lib/dashboard/widget-definitions.ts. Listing them makes that a reviewed
   * decision rather than an accident, and makes any *other* role going empty a
   * test failure.
   *
   * Not all six are equally defensible. `admin` is narrow by design and works
   * out of /admin. The four setter roles nominally have /setter, which polls an
   * endpoint that does not exist on disk. `tag_sales` is the odd one: the role
   * exists for TAG's own pipeline, `pipeline_board` is exactly that widget, and
   * its availableFor omits them. Resolving these belongs with the dashboard
   * story, not here.
   */
  const ROLES_WITHOUT_WIDGETS: readonly string[] = [
    ROLES.ADMIN,
    ROLES.TAG_SALES,
    ROLES.TAG_SETTER_MANAGER,
    ROLES.TAG_SETTER,
    ROLES.CLIENT_SETTER_MANAGER,
    ROLES.CLIENT_SETTER,
  ];

  it('gives every role a dashboard, except the six known to be empty', () => {
    for (const role of Object.values(ROLES)) {
      const count = registry.getAvailableWidgets(role).length;
      if (ROLES_WITHOUT_WIDGETS.includes(role)) {
        // If one of these gains a widget, delete it from the list above rather
        // than loosening this test.
        expect(count, `${role} is listed as empty but now has widgets`).toBe(0);
      } else {
        expect(count, `${role} has no widgets and would render a blank page`).toBeGreaterThan(0);
      }
    }
  });

  it('gives tag_csd the team health rollup', () => {
    const ids = registry.getAvailableWidgets(ROLES.TAG_CSD).map((w) => w.id);

    // The CS Director's whole reason for a dashboard: every CSM's book.
    expect(ids).toContain('team_health_rollup');
  });

  it('does not leak department-wide widgets to a client role', () => {
    const ids = registry.getAvailableWidgets(ROLES.CLIENT_OWNER).map((w) => w.id);

    expect(ids).not.toContain('department_overview');
    expect(ids).not.toContain('team_health_rollup');
    expect(ids).not.toContain('portfolio');
  });

  it('filters strictly by availableFor', () => {
    const forCloser = registry.getAvailableWidgets(ROLES.CLIENT_CLOSER);

    expect(forCloser.every((w) => w.availableFor.includes(ROLES.CLIENT_CLOSER))).toBe(true);
  });

  it('resolves a registered loader', async () => {
    registry.registerLoader('portfolio', () => Promise.resolve(FakeWidget));

    await expect(registry.loadComponent('portfolio')).resolves.toBe(FakeWidget);
  });

  it('rejects with a named id when no loader is registered', async () => {
    // The dashboard renders placements from saved config, so this is reachable
    // whenever a layout outlives the widget it references. The id has to be in
    // the message or the failure is unattributable.
    await expect(registry.loadComponent('day_view')).rejects.toThrow(/day_view/);
  });

  it('lets a later registration replace an earlier one', () => {
    registry.registerLoader('portfolio', () => Promise.resolve(FakeWidget));
    registry.registerLoader('portfolio', () => Promise.resolve(FakeWidget));

    // Hot module replacement in dev re-runs registration; a throw on re-register
    // would make the dev server unusable.
    expect(() => registry.registerLoader('portfolio', () => Promise.resolve(FakeWidget))).not.toThrow();
  });
});
