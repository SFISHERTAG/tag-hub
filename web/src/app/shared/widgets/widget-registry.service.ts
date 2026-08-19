import { Injectable, Type } from '@angular/core';
import type { Role } from '../../core/models/role.model';
import type { WidgetDefinition } from './widget.model';

/**
 * Port of lib/dashboard/widget-definitions.ts's WIDGET_REGISTRY. Keep the two
 * in sync — this is metadata only (id, title, availableFor, size), never
 * widget data itself, so the dashboard shell can resolve placements by id +
 * permission without knowing anything about GHL/Meta/Google/Slack.
 */
const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  pipeline_board: {
    id: 'pipeline_board',
    title: 'Top Deals',
    availableFor: ['client_closer', 'client_manager', 'tag_exec', 'tag_csm'],
    defaultSize: { cols: 2, rows: 2 },
    description: 'Highest-value deals in your pipeline, ranked',
  },
  day_view: {
    id: 'day_view',
    title: "Today's Schedule",
    availableFor: ['client_closer', 'tag_exec'],
    defaultSize: { cols: 2, rows: 1 },
    description: 'Appointments and calls for today',
  },
  leads_funnel: {
    id: 'leads_funnel',
    title: 'Leads Funnel',
    availableFor: ['client_owner', 'client_manager', 'tag_exec', 'tag_csm'],
    defaultSize: { cols: 1, rows: 1 },
    description: 'Lead, booked, showed, closed counts',
  },
  spend_roas: {
    id: 'spend_roas',
    title: 'Spend & ROAS',
    availableFor: ['client_owner', 'tag_exec'],
    defaultSize: { cols: 2, rows: 1 },
    description: 'Ad spend and return on ad spend',
  },
  client_health: {
    id: 'client_health',
    title: 'Client Health',
    availableFor: ['tag_csm', 'tag_csd', 'tag_exec'],
    defaultSize: { cols: 1, rows: 1 },
    description: 'Health signals and escalation flags',
  },
  portfolio: {
    id: 'portfolio',
    title: 'Portfolio',
    availableFor: ['tag_csm', 'tag_csd', 'tag_exec'],
    defaultSize: { cols: 2, rows: 2 },
    description: 'All clients and their status',
  },
  team_performance: {
    id: 'team_performance',
    title: 'Team Performance',
    availableFor: ['tag_sales_manager', 'tag_exec'],
    defaultSize: { cols: 2, rows: 1 },
    description: 'Rep and team metrics',
  },
  team_health_rollup: {
    id: 'team_health_rollup',
    title: 'Team Health',
    availableFor: ['tag_csd'],
    defaultSize: { cols: 2, rows: 2 },
    description: 'Every CSM on your team, worst book first',
  },
  department_overview: {
    id: 'department_overview',
    title: 'Department Overview',
    availableFor: ['tag_exec'],
    defaultSize: { cols: 2, rows: 2 },
    description: 'Department-wide totals and which books need attention',
  },
  kpi_summary: {
    id: 'kpi_summary',
    title: 'KPI Summary',
    availableFor: ['client_owner', 'client_manager', 'tag_exec', 'tag_csm'],
    defaultSize: { cols: 4, rows: 1 },
    description: 'Spend, ROAS, cost per lead, and booking rate at a glance',
  },
  owner_calendar: {
    id: 'owner_calendar',
    title: 'My Calendar',
    availableFor: ['client_owner', 'tag_exec'],
    defaultSize: { cols: 4, rows: 2 },
    description: 'Your own scheduled calls — month view and upcoming list',
  },
  // documents / slack: not yet in the backend registry either (confirmed
  // unwired in Phase 0 recon) — add here in the same commit that adds them
  // to lib/dashboard/widget-definitions.ts, with a real availableFor list.
};

/** Loader for a widget's standalone component, keyed by widget id. Populated as each widget lands in Phase 3 — the registry itself never imports a feature module. */
export type WidgetLoader = () => Promise<Type<unknown>>;

@Injectable({ providedIn: 'root' })
export class WidgetRegistryService {
  private readonly loaders = new Map<string, WidgetLoader>();

  getDefinition(id: string): WidgetDefinition | undefined {
    return WIDGET_REGISTRY[id];
  }

  getAvailableWidgets(role: Role): WidgetDefinition[] {
    return Object.values(WIDGET_REGISTRY).filter((w) => w.availableFor.includes(role));
  }

  /** Called once per widget id from that widget's own feature module — keeps shared/ free of feature imports. */
  registerLoader(id: string, loader: WidgetLoader): void {
    this.loaders.set(id, loader);
  }

  loadComponent(id: string): Promise<Type<unknown>> {
    const loader = this.loaders.get(id);
    if (!loader) {
      return Promise.reject(new Error(`No widget component registered for id "${id}"`));
    }
    return loader();
  }
}
