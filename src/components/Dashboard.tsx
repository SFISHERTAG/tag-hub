import React, { useState } from 'react';
import './Dashboard.css';

interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

interface ChartBarProps {
  height: number;
  color: string;
}

interface DashboardProps {
  accountName?: string;
}

/**
 * KPI Card Component
 * Displays a key performance indicator with value and trend
 */
const KPICard: React.FC<KPICardProps> = ({ label, value, change, changeType = 'neutral' }) => {
  const changeColorMap = {
    positive: 'var(--color-success)',
    negative: 'var(--color-danger)',
    neutral: 'var(--color-text-secondary)',
  };

  return (
    <div className="kpi-card">
      <p className="kpi-label">{label}</p>
      <h2 className="kpi-value" style={{
        color: label === 'ROAS' ? 'var(--color-gold)' : 'var(--color-fg)'
      }}>
        {value}
      </h2>
      {change && (
        <p className="kpi-change" style={{ color: changeColorMap[changeType] }}>
          {change}
        </p>
      )}
    </div>
  );
};

/**
 * Performance Chart Component
 * Simple bar chart showing daily trend data
 */
const PerformanceChart: React.FC<{ data: ChartBarProps[] }> = ({ data }) => {
  return (
    <div className="card elevated">
      <h2 className="chart-title">30-Day Performance</h2>
      <div className="chart-bars">
        {data.map((bar, index) => (
          <div
            key={index}
            className="chart-bar"
            style={{
              height: `${bar.height}%`,
              backgroundColor: bar.color,
            }}
          />
        ))}
      </div>
      <p className="chart-label">Daily ROAS trend</p>
    </div>
  );
};

/**
 * Health Check Component
 * Shows progress bars for key metrics
 */
interface HealthMetric {
  name: string;
  percentage: number;
  status: 'on-track' | 'warning' | 'critical';
}

const HealthCheck: React.FC<{ metrics: HealthMetric[] }> = ({ metrics }) => {
  const statusColors = {
    'on-track': 'var(--color-success)',
    'warning': 'var(--color-warning)',
    'critical': 'var(--color-danger)',
  };

  const statusLabels = {
    'on-track': 'On track',
    'warning': 'Watch',
    'critical': 'Critical',
  };

  return (
    <div className="card elevated">
      <h2 className="chart-title">Health Check</h2>
      <div className="health-metrics">
        {metrics.map((metric) => (
          <div key={metric.name} className="health-metric">
            <div className="health-header">
              <span className="health-name">{metric.name}</span>
              <span
                className="health-status"
                style={{
                  backgroundColor: `${statusColors[metric.status]}20`,
                  color: statusColors[metric.status],
                }}
              >
                {statusLabels[metric.status]}
              </span>
            </div>
            <div className="health-bar-container">
              <div
                className="health-bar"
                style={{
                  width: `${metric.percentage}%`,
                  backgroundColor: statusColors[metric.status],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Dashboard Component
 * Main dashboard view with KPIs, charts, and health metrics
 */
export const Dashboard: React.FC<DashboardProps> = ({ accountName = 'Acme Growth Marketing' }) => {
  const kpiData: KPICardProps[] = [
    {
      label: 'ROAS',
      value: '4.2x',
      change: '↑ 12% vs last month',
      changeType: 'positive',
    },
    {
      label: 'Monthly Spend',
      value: '$24,580',
      change: 'On budget',
      changeType: 'neutral',
    },
    {
      label: 'Conversion Rate',
      value: '3.8%',
      change: '⚠️ 0.2% below target',
      changeType: 'negative',
    },
    {
      label: 'Cost per Lead',
      value: '$42',
      change: '↓ 8% optimized',
      changeType: 'positive',
    },
  ];

  const chartData: ChartBarProps[] = [
    { height: 42, color: 'var(--color-success)' },
    { height: 55, color: 'var(--color-success)' },
    { height: 65, color: 'var(--color-success)' },
    { height: 72, color: 'var(--color-gold)' },
    { height: 78, color: 'var(--color-gold)' },
    { height: 85, color: 'var(--color-gold)' },
    { height: 92, color: '#207f7f' },
  ];

  const healthMetrics: HealthMetric[] = [
    { name: 'ROAS Target', percentage: 85, status: 'on-track' },
    { name: 'Conversion', percentage: 65, status: 'warning' },
    { name: 'CAC Ratio', percentage: 78, status: 'on-track' },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p className="dashboard-subtitle">Your campaign performance and key metrics</p>
        </div>
        <div className="dashboard-buttons">
          <button className="btn">📊 Export</button>
          <button className="btn primary">⚙️ Custom KPIs</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpiData.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <PerformanceChart data={chartData} />
        <HealthCheck metrics={healthMetrics} />
      </div>
    </div>
  );
};

export default Dashboard;
