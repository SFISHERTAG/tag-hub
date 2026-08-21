# TAG Design System Integration Guide

This guide shows how to integrate the new TAG design components with the existing Hub app's Tailwind CSS setup.

## Color Mapping

The new components use CSS variables, but Hub uses Tailwind classes. Here's the mapping:

| New Component | Tailwind Equivalent |
|---|---|
| `--color-gold` | `text-accent` / `bg-accent` |
| `--color-success` | `text-ok` / `bg-ok` / `bg-ok-tint` |
| `--color-warning` | `text-warn` / `bg-warn-tint` |
| `--color-danger` | `text-danger` / `bg-danger-tint` |
| `--color-fg` | `text-ink` |
| `--color-text-secondary` | `text-ink-2` |
| `--color-border` | `border-line` |
| `--color-surface` | `bg-surface` |
| `--color-bg` | `bg-canvas` |

## Adapting Components

### Option 1: Use existing Hub components

The Hub already has `Panel`, `Fold`, `Stat`, and `Badge` components. Use these instead of creating new ones:

```tsx
import { Panel, Stat, Fold } from "@/app/ui";

export function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
      
      <div className="grid grid-cols-4 gap-3">
        <Stat label="ROAS" value="4.2×" tone="ok" />
        <Stat label="Monthly Spend" value="$24,580" tone="neutral" />
        <Stat label="Conv. Rate" value="3.8%" tone="warn" />
        <Stat label="Cost/Lead" value="$42" tone="neutral" />
      </div>

      <Panel title="Performance">
        {/* Chart content */}
      </Panel>
    </div>
  );
}
```

### Option 2: Create Tailwind-based components

If you want to use the new components, adapt them to use Tailwind classes:

```tsx
interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export function KPICard({ label, value, change, changeType = 'neutral' }: KPICardProps) {
  const changeToneMap = {
    positive: 'text-ok',
    negative: 'text-danger',
    neutral: 'text-ink-2',
  };

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 lift">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <p className="mt-2 text-3xl font-bold text-accent">{value}</p>
      {change && <p className={`mt-1 text-xs font-semibold ${changeToneMap[changeType]}`}>{change}</p>}
    </div>
  );
}
```

## Integration Steps

### 1. Update Dashboard Page

Replace `app/dashboard/page.tsx` widgets to use the new KPI cards:

```tsx
// app/dashboard/page.tsx
import { KPICard } from './kpi-card';

export default async function DashboardPage() {
  // ... existing session checks ...

  const kpis = [
    { label: 'ROAS', value: '4.2x', change: '↑ 12%', changeType: 'positive' },
    { label: 'Spend', value: '$24,580', change: 'On budget' },
    // ...
  ];

  return (
    <DarkScope>
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        
        <div className="grid grid-cols-4 gap-3">
          {kpis.map(kpi => <KPICard key={kpi.label} {...kpi} />)}
        </div>
        
        {/* Rest of dashboard... */}
      </div>
    </DarkScope>
  );
}
```

### 2. Create Modal Component (using Tailwind)

```tsx
// app/modals/creative-approval-modal.tsx
'use client';

interface CreativeApprovalModalProps {
  isOpen: boolean;
  creative?: {
    id: string;
    title: string;
    platform: string;
    format: string;
  };
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function CreativeApprovalModal({
  isOpen,
  creative,
  onClose,
  onApprove,
  onReject,
}: CreativeApprovalModalProps) {
  if (!isOpen || !creative) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/80 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface border border-line rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-line px-6 py-4 flex items-center justify-between sticky top-0 bg-surface">
            <h2 className="text-lg font-semibold text-ink">{creative.title}</h2>
            <button onClick={onClose} className="text-ink-2 hover:text-ink">✕</button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="bg-slate-600 rounded-lg h-64 mb-6 flex items-center justify-center">
              <span className="text-white font-semibold">{creative.platform} — {creative.format}</span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-line px-6 py-4 flex gap-3">
            <button
              onClick={() => onApprove?.(creative.id)}
              className="flex-1 px-4 py-2 bg-ok text-white rounded-md font-semibold hover:opacity-90"
            >
              Approve
            </button>
            <button
              onClick={() => onReject?.(creative.id)}
              className="flex-1 px-4 py-2 bg-danger text-white rounded-md font-semibold hover:opacity-90"
            >
              Request Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

### 3. Navigation Tabs

Hub already has navigation in `app/nav.tsx`. The new tabbed interface can extend it:

```tsx
// Use the existing nav system and enhance with the Success Portal tabs
// Add tab switching logic to app/layout.tsx or create a useNavigation hook
```

## Best Practices

1. **Use existing components first** - Hub's `Panel`, `Stat`, `Fold`, and `Badge` already implement the design system
2. **Extend, don't replace** - Create new components as wrappers around existing ones
3. **Stick to Tailwind classes** - Use the defined color tokens (text-ink, bg-surface, etc.)
4. **Dark mode is built-in** - All Tailwind classes automatically respond to `data-theme="dark"`
5. **Use lift utility** - For shadows/elevation, use the `lift` class instead of `box-shadow`

## Next Steps

1. Identify which Success Portal screens to implement (Dashboard, Creatives, Calls, Resources)
2. Map each screen to existing Hub pages or create new ones
3. Build components incrementally, testing each in both light and dark modes
4. Use `DarkScope` wrapper for dark sections if needed
