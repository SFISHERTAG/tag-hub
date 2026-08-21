/**
 * KPI Card Component
 * Displays key performance indicators with metrics and trends
 * Uses TAG design system with Tailwind CSS
 */

interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function KPICard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon,
}: KPICardProps) {
  const changeToneMap = {
    positive: 'text-ok',
    negative: 'text-danger',
    neutral: 'text-ink-2',
  };

  const isGoldValue = label === 'ROAS';

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 lift">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">
            {label}
          </p>
          <p
            className={`mt-2 text-3xl font-bold ${
              isGoldValue ? 'text-accent' : 'text-ink'
            }`}
          >
            {value}
          </p>
          {change && (
            <p
              className={`mt-1 text-xs font-semibold ${changeToneMap[changeType]}`}
            >
              {change}
            </p>
          )}
        </div>
        {icon && <div className="ml-2 text-lg">{icon}</div>}
      </div>
    </div>
  );
}

export default KPICard;
