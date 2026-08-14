'use client';

import { useState, ReactNode } from 'react';
import { DashboardNavTabs } from './dashboard-nav-tabs';
import { DashboardLayout } from './dashboard-layout';
import { CreativesScreen } from './creatives/creatives-screen';
import { CallsScreen } from './calls/calls-screen';
import { ResourcesScreen } from './resources/resources-screen';
import type { CreativeForDisplay, CallForDisplay, ResourceForDisplay } from '@/lib/dashboard/data-fetchers';

interface DashboardPageClientProps {
  accountName: string;
  dashboardContent: ReactNode;
  initialCreatives: CreativeForDisplay[];
  initialCalls: CallForDisplay[];
  initialResources: ResourceForDisplay[];
  initialUpcomingCalls: CallForDisplay[];
}

export function DashboardPageClient({
  accountName,
  dashboardContent,
  initialCreatives,
  initialCalls,
  initialResources,
  initialUpcomingCalls,
}: DashboardPageClientProps) {
  const [currentScreen, setCurrentScreen] = useState<
    'dashboard' | 'creatives' | 'calls' | 'resources'
  >('dashboard');

  return (
    <div className="space-y-0">
      {/* Navigation Tabs */}
      <div className="sticky top-[calc(3.5rem+1.5rem)] z-20 bg-surface/95 backdrop-blur-sm">
        <DashboardNavTabs
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      </div>

      {/* Content Area */}
      <div className="space-y-6 p-4 sm:p-6">
        {currentScreen === 'dashboard' && (
          <DashboardLayout accountName={accountName}>
            {dashboardContent}
          </DashboardLayout>
        )}

        {currentScreen === 'creatives' && (
          <CreativesScreen initialData={initialCreatives} />
        )}

        {currentScreen === 'calls' && (
          <CallsScreen initialData={initialCalls} upcomingData={initialUpcomingCalls} />
        )}

        {currentScreen === 'resources' && (
          <ResourcesScreen initialData={initialResources} />
        )}
      </div>
    </div>
  );
}
