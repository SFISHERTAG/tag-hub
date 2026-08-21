import {
  MAX_COLS,
  MAX_ROWS,
  MIN_COLS,
  canGrow,
  canShrink,
  moveWidget,
  resizeWidget,
  toggleWidget,
  withPage,
} from './layout-edit';
import type {
  DashboardConfig,
  DashboardPage,
  WidgetDefinition,
  WidgetPlacement,
} from '../../../shared/widgets/widget.model';
import { ROLES } from '../../../core/models/role.model';

/**
 * Story: these functions decide what gets PUT to `/api/dashboard/config`, and
 * that endpoint rejects an out-of-range size with a 400. So the two things
 * worth pinning are that a size can never leave 1..4, and that no edit mutates
 * the layout the screen is currently displaying.
 *
 * The second matters because the customize screen is optimistic: it applies an
 * edit, then saves, then rolls back if the save fails. Rollback only works if
 * the previous layout was never touched in the first place.
 */

function placement(widgetId: string, cols = 1, rows = 1): WidgetPlacement {
  return { id: widgetId, widgetId, position: { x: 0, y: 0 }, size: { cols, rows } };
}

function page(widgets: WidgetPlacement[]): DashboardPage {
  return { id: 'main', title: 'Main', widgets };
}

function definition(id: string, cols = 2, rows = 1): WidgetDefinition {
  return {
    id,
    title: id,
    availableFor: [ROLES.TAG_CSM],
    defaultSize: { cols, rows },
  };
}

describe('layout-edit', () => {
  describe('toggleWidget', () => {
    it('adds a widget at its declared default size', () => {
      const result = toggleWidget(page([]), 'portfolio', [definition('portfolio', 2, 2)]);

      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0]?.size).toEqual({ cols: 2, rows: 2 });
    });

    it('uses the widget id as the placement id, so saving twice is not a diff', () => {
      const available = [definition('portfolio')];
      const first = toggleWidget(page([]), 'portfolio', available);
      const second = toggleWidget(page([]), 'portfolio', available);

      // The clock-based suffix this replaced produced a different id on every
      // render, so re-saving an unchanged layout looked like a change.
      expect(first.widgets[0]?.id).toBe('portfolio');
      expect(first.widgets[0]?.id).toBe(second.widgets[0]?.id);
    });

    it('removes a widget that is already on the page', () => {
      const result = toggleWidget(page([placement('portfolio')]), 'portfolio', [
        definition('portfolio'),
      ]);

      expect(result.widgets).toEqual([]);
    });

    it('ignores a widget the picker does not offer rather than throwing', () => {
      const original = page([]);
      const result = toggleWidget(original, 'not_a_widget', [definition('portfolio')]);

      expect(result).toBe(original);
    });

    it('brings an over-large declared default inside the endpoint bounds', () => {
      const result = toggleWidget(page([]), 'huge', [definition('huge', 9, 9)]);

      // Otherwise the picker produces a layout the endpoint refuses to save,
      // and the 400 lands on whoever clicked rather than whoever declared it.
      expect(result.widgets[0]?.size).toEqual({ cols: MAX_COLS, rows: MAX_ROWS });
    });

    it('does not mutate the page it was given', () => {
      const original = page([placement('portfolio')]);
      const snapshot = structuredClone(original);

      toggleWidget(original, 'client_health', [definition('client_health')]);

      expect(original).toEqual(snapshot);
    });
  });

  describe('moveWidget', () => {
    it('swaps a placement with its neighbour', () => {
      const original = page([placement('a'), placement('b'), placement('c')]);

      const result = moveWidget(original, 1, -1);

      expect(result.widgets.map((w) => w.widgetId)).toEqual(['b', 'a', 'c']);
    });

    it('is a no-op past either end', () => {
      const original = page([placement('a'), placement('b')]);

      expect(moveWidget(original, 0, -1)).toBe(original);
      expect(moveWidget(original, 1, 1)).toBe(original);
      expect(moveWidget(original, 7, 1)).toBe(original);
    });

    it('does not mutate the page it was given', () => {
      const original = page([placement('a'), placement('b')]);
      const snapshot = structuredClone(original);

      moveWidget(original, 0, 1);

      expect(original).toEqual(snapshot);
    });
  });

  describe('resizeWidget', () => {
    it('grows and shrinks on one axis only', () => {
      const original = page([placement('a', 2, 2)]);

      expect(resizeWidget(original, 0, 'cols', 1).widgets[0]?.size).toEqual({ cols: 3, rows: 2 });
      expect(resizeWidget(original, 0, 'rows', -1).widgets[0]?.size).toEqual({ cols: 2, rows: 1 });
    });

    it('refuses to leave the range the endpoint accepts', () => {
      const atMax = page([placement('a', MAX_COLS, MAX_ROWS)]);
      const atMin = page([placement('a', MIN_COLS, 1)]);

      expect(resizeWidget(atMax, 0, 'cols', 1)).toBe(atMax);
      expect(resizeWidget(atMax, 0, 'rows', 1)).toBe(atMax);
      expect(resizeWidget(atMin, 0, 'cols', -1)).toBe(atMin);
      expect(resizeWidget(atMin, 0, 'rows', -1)).toBe(atMin);
    });

    it('allows four rows, matching the endpoint', () => {
      // The reference implementation capped rows at 3 in the UI while the API
      // accepted 4 — a control refusing a value the server would have taken.
      const original = page([placement('a', 1, 3)]);

      expect(resizeWidget(original, 0, 'rows', 1).widgets[0]?.size.rows).toBe(4);
    });

    it('is a no-op for an index that is not there', () => {
      const original = page([placement('a')]);

      expect(resizeWidget(original, 4, 'cols', 1)).toBe(original);
    });
  });

  describe('canGrow / canShrink', () => {
    it('matches the bounds resizeWidget enforces, so a live button never no-ops', () => {
      const small = placement('a', MIN_COLS, 1);
      const large = placement('a', MAX_COLS, MAX_ROWS);

      expect(canShrink(small, 'cols')).toBe(false);
      expect(canGrow(small, 'cols')).toBe(true);
      expect(canGrow(large, 'cols')).toBe(false);
      expect(canGrow(large, 'rows')).toBe(false);
      expect(canShrink(large, 'rows')).toBe(true);
    });
  });

  describe('withPage', () => {
    it('replaces one page and leaves the rest of the config alone', () => {
      const config: DashboardConfig = {
        role: ROLES.TAG_CSM,
        pages: [page([]), { id: 'other', title: 'Other', widgets: [placement('a')] }],
        currentPage: 0,
        updatedAt: 1,
      };

      const result = withPage(config, page([placement('portfolio')]));

      expect(result.pages[0]?.widgets).toHaveLength(1);
      expect(result.pages[1]).toBe(config.pages[1]);
      expect(result.role).toBe(config.role);
      expect(config.pages[0]?.widgets).toEqual([]);
    });
  });
});
