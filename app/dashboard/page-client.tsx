'use client';

import { useState, ReactNode } from 'react';
import { DashboardNavTabs } from './dashboard-nav-tabs';
import { DashboardLayout } from './dashboard-layout';
import { CreativesScreen } from './creatives/creatives-screen';
import { CallsScreen } from './calls/calls-screen';
import { ResourcesScreen } from './resources/resources-screen';

interface DashboardPageClientProps {
  accountName: string;
  dashboardContent: ReactNode;
}

export function DashboardPageClient({
  accountName,
  dashboardContent,
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

        {currentScreen === 'creatives' && <CreativesScreen />}

        {currentScreen === 'calls' && <CallsScreen />}

        {currentScreen === 'resources' && <ResourcesScreen />}
      </div>
    </div>
  );
}
