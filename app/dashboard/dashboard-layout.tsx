'use client';

import { KPICard } from './kpi-card';
import { Panel } from '../ui';

interface DashboardLayoutProps {
  accountName?: string;
  kpis?: {
    label: string;
    value: string | number;
    change?: string;
    changeType?: 'positive' | 'negative' | 'neutral';
  }[];
  children?: React.ReactNode;
}

/**
 * Performance Chart Component
 * Simple bar chart showing 7-day ROAS trend
 */
function PerformanceChart() {
  const bars = [
    { height: 42, color: 'bg-ok' },
    { height: 55, color: 'bg-ok' },
    { height: 65, color: 'bg-ok' },
    { height: 72, color: 'bg-accent' },
    { height: 78, color: 'bg-accent' },
    { height: 85, color: 'bg-accent' },
    { height: 92, color: 'bg-info' },
  ];

  return (
    <Panel title="30-Day Performance" meta="Daily ROAS trend">
      <div className="flex items-end justify-between gap-2 h-48 bg-sunken rounded-lg p-4">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm transition-opacity hover:opacity-80 ${bar.color}`}
            style={{ height: `${bar.height}%` }}
          />
        ))}
      </div>
    </Panel>
  );
}

/**
 * Health Metric Component
 * Progress bar with status indicator
 */
interface HealthMetricProps {
  name: string;
  percentage: number;
  status: 'ok' | 'warn' | 'danger';
}

function HealthMetric({ name, percentage, status }: HealthMetricProps) {
  const statusMap = {
    ok: { text: 'On track', color: 'bg-ok text-white' },
    warn: { text: 'Watch', color: 'bg-warn text-white' },
    danger: { text: 'Critical', color: 'bg-danger text-white' },
  };

  const barColorMap = {
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-ink">{name}</span>
        <span className={`text-xs font-semibold px-2 py-1 rounded ${statusMap[status].color}`}>
          {statusMap[status].text}
        </span>
      </div>
      <div className="h-1.5 bg-sunken rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColorMap[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Dashboard Layout Component
 * Main dashboard view with KPIs, charts, and health metrics
 */
export function DashboardLayout({
  accountName = 'Acme Growth Marketing',
  kpis,
  children,
}: DashboardLayoutProps) {
  const defaultKpis = kpis || [
    {
      label: 'ROAS',
      value: '4.2×',
      change: '↑ 12% vs last month',
      changeType: 'positive' as const,
    },
    {
      label: 'Monthly Spend',
      value: '$24,580',
      change: 'On budget',
      changeType: 'neutral' as const,
    },
    {
      label: 'Conversion Rate',
      value: '3.8%',
      change: '⚠️ 0.2% below target',
      changeType: 'negative' as const,
    },
    {
      label: 'Cost per Lead',
      value: '$42',
      change: '↓ 8% optimized',
      changeType: 'positive' as const,
    },
  ];

  const healthMetrics = [
    { name: 'ROAS Target', percentage: 85, status: 'ok' as const },
    { name: 'Conversion', percentage: 65, status: 'warn' as const },
    { name: 'CAC Ratio', percentage: 78, status: 'ok' as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">
            Campaign performance and key metrics
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 text-sm font-semibold rounded-md border border-line bg-surface text-ink hover:bg-raised transition-colors">
            📊 Export
          </button>
          <button className="px-3 py-2 text-sm font-semibold rounded-md bg-accent text-accent-ink hover:opacity-90 transition-opacity">
            ⚙️ Custom KPIs
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {defaultKpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart />
        </div>

        <Panel title="Health Check">
          <div className="space-y-4">
            {healthMetrics.map((metric) => (
              <HealthMetric key={metric.name} {...metric} />
            ))}
          </div>
        </Panel>
      </div>

      {/* Additional content slot */}
      {children}
    </div>
  );
}

export default DashboardLayout;
