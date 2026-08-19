import React from 'react';
import './Navigation.css';

export type NavigationTab = 'dashboard' | 'creatives' | 'calls' | 'resources' | 'account';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onSignOut?: () => void;
  isCsm?: boolean;
}

const tabs: Array<{ id: NavigationTab; label: string; icon?: string; showForCsm?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'creatives', label: 'Creatives' },
  { id: 'calls', label: 'Calls' },
  { id: 'resources', label: 'Resources' },
  { id: 'account', label: 'Account', showForCsm: true },
];

/**
 * Navigation Tab Component
 * Individual tab button with active state
 */
const NavTab: React.FC<{
  id: NavigationTab;
  label: string;
  isActive: boolean;
  onClick: (id: NavigationTab) => void;
}> = ({ id, label, isActive, onClick }) => {
  return (
    <button
      className={`nav-tab ${isActive ? 'active' : ''}`}
      onClick={() => onClick(id)}
      role="tab"
      aria-selected={isActive}
    >
      {label}
    </button>
  );
};

/**
 * Navigation Component
 * Bottom navigation bar with tab switching
 */
export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onSignOut,
  isCsm = false,
}) => {
  const visibleTabs = tabs.filter((tab) => !tab.showForCsm || isCsm);

  return (
    <nav className="navigation" role="navigation">
      <div className="nav-tabs" role="tablist">
        {visibleTabs.map((tab) => (
          <NavTab
            key={tab.id}
            id={tab.id}
            label={tab.label}
            isActive={activeTab === tab.id}
            onClick={onTabChange}
          />
        ))}
      </div>

      <div className="nav-actions">
        <button
          className="btn nav-signout"
          onClick={onSignOut}
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
