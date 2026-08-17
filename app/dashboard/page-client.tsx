'use client';

import { PageTabs } from './page-tabs';
import { WidgetGrid } from './widget-grid';
import type { DashboardConfig } from '@/lib/dashboard/widget';
import type { CsmBookSummary, DepartmentSummary } from '@/lib/dashboard/team-rollup';

interface DashboardPageClientProps {
  config: DashboardConfig;
  currentPageId: string;
  userEmail: string;
  teamHealthRollup?: CsmBookSummary[];
  departmentOverview?: DepartmentSummary;
}

export function DashboardPageClient({
  config,
  currentPageId,
  userEmail,
  teamHealthRollup,
  departmentOverview,
}: DashboardPageClientProps) {
  const currentPage = config.pages.find((p) => p.id === currentPageId);

  if (!currentPage) {
    return (
      <div className="rounded-lg border border-warn/30 bg-warn-tint p-6 text-warn">
        <h2 className="text-base font-semibold">Page not found</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-chrome-ink-2">{userEmail}</p>
        </div>
      </div>

      {/* Page Tabs */}
      {config.pages.length > 1 && (
        <PageTabs pages={config.pages} currentPageId={currentPageId} />
      )}

      {/* Current Page */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-ink">{currentPage.title}</h2>
        {currentPage.widgets.length > 0 ? (
          <WidgetGrid
            widgets={currentPage.widgets}
            teamHealthRollup={teamHealthRollup}
            departmentOverview={departmentOverview}
          />
        ) : (
          <div className="rounded-lg border border-chrome-line bg-chrome p-8 text-center">
            <p className="text-chrome-ink-2">
              No widgets added yet.{' '}
              <a
                href="/dashboard/customize"
                className="font-medium text-accent hover:underline"
              >
                Customize your dashboard
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
