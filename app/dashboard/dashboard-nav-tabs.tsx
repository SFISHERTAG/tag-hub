'use client';

import { useState } from 'react';

type Screen = 'dashboard' | 'creatives' | 'calls' | 'resources';

export interface DashboardNavTabsProps {
  currentScreen: Screen;
  onScreenChange: (screen: Screen) => void;
}

export function DashboardNavTabs({
  currentScreen,
  onScreenChange,
}: DashboardNavTabsProps) {
  const tabs: { id: Screen; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'creatives', label: 'Creatives' },
    { id: 'calls', label: 'Calls' },
    { id: 'resources', label: 'Resources' },
  ];

  return (
    <div className="border-b border-line bg-surface">
      <nav
        className="flex gap-0 overflow-x-auto"
        aria-label="Dashboard sections"
      >
        {tabs.map((tab) => {
          const isActive = currentScreen === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onScreenChange(tab.id)}
              className={`relative flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-accent'
                  : 'text-ink-2 hover:text-ink'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
