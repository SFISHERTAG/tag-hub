# TAG Design System Implementation Guide

## Overview

This guide shows how to use the TAG design tokens to build React components that follow the design system defined in the Success Portal and TAG Design System documents.

## Files

- `design-tokens.json` - Design token definitions (colors, typography, spacing, etc.)
- `design-tokens.css` - CSS variables ready to use in your React app
- `success-portal.html` - Full interactive reference design (view in browser)
- `TAG_Design_System.dc.html` - Design system documentation

## Getting Started

### 1. Import CSS Variables

Add the design tokens CSS to your React app's global styles:

```tsx
// In your main App.tsx or globals.css
import './design-tokens.css';
```

### 2. Use CSS Variables in Components

```tsx
// Button component example
const Button = ({ children, variant = 'default' }) => {
  const styles = {
    default: {
      padding: 'var(--space-md) var(--space-lg)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      background: 'transparent',
      color: 'var(--color-fg)',
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--font-weight-semibold)',
    },
    primary: {
      padding: 'var(--space-md) var(--space-lg)',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      background: 'var(--color-gold)',
      color: '#050505',
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--font-weight-semibold)',
    },
  };

  return (
    <button style={styles[variant]}>
      {children}
    </button>
  );
};
```

## Design Tokens Reference

### Colors

#### Brand Colors
- Primary Gold: `--color-gold` (#e0a324)
- Secondary Gold: `--color-gold-secondary` (#cc901b)
- Dark Gold: `--color-gold-dark` (#a3730f)

#### Semantic Colors
- Success: `--color-success` (#1a6b45)
- Warning: `--color-warning` (#be5d1d)
- Danger: `--color-danger` (#b02a1f)

#### Neutrals (Automatic Light/Dark Mode)
- Background: `--color-bg`
- Foreground: `--color-fg`
- Surface: `--color-surface`
- Border: `--color-border`
- Text Secondary: `--color-text-secondary`

### Typography

#### Heading Sizes
```tsx
// H1: 28px, semibold
<h1>Main Heading</h1>

// H2: 20px, semibold
<h2>Section Heading</h2>

// H3: 16px, semibold
<h3>Subsection</h3>

// Body: 14px, regular
<p>Standard body text</p>

// Body Small: 13px, regular
<small>Secondary text</small>

// Label: 12px, semibold, uppercase
<label>FORM LABEL</label>
```

### Spacing Scale

Use these for consistent spacing:

```
xs  = 4px    (gaps between elements)
sm  = 8px    (small margins)
md  = 12px   (standard gaps)
lg  = 16px   (component padding)
xl  = 20px   (card padding)
2xl = 24px   (section spacing)
3xl = 28px   (large sections)
4xl = 32px   (major sections)
5xl = 40px   (extra large spacing)
```

Usage in React:

```tsx
const Box = ({ children, spacing = 'md' }) => {
  const paddingMap = {
    xs: 'var(--space-xs)',
    sm: 'var(--space-sm)',
    md: 'var(--space-md)',
    lg: 'var(--space-lg)',
    xl: 'var(--space-xl)',
  };

  return (
    <div style={{ padding: paddingMap[spacing] }}>
      {children}
    </div>
  );
};
```

## Component Examples

### KPI Card

From the Success Portal dashboard:

```tsx
interface KPICardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

const KPICard = ({ label, value, change, changeType = 'neutral' }: KPICardProps) => {
  const changeColors = {
    positive: 'var(--color-success)',
    negative: 'var(--color-danger)',
    neutral: 'var(--color-text-secondary)',
  };

  return (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      minWidth: '200px',
    }}>
      <p style={{ 
        fontSize: 'var(--text-label)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--space-md)',
      }}>
        {label}
      </p>
      <h2 style={{ 
        fontSize: 'var(--text-h2)',
        color: 'var(--color-gold)',
        marginBottom: 'var(--space-sm)',
      }}>
        {value}
      </h2>
      {change && (
        <p style={{ 
          fontSize: 'var(--text-body-sm)',
          color: changeColors[changeType],
          fontWeight: 'var(--font-weight-semibold)',
        }}>
          {change}
        </p>
      )}
    </div>
  );
};
```

### Button Variants

```tsx
const ButtonShowcase = () => (
  <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
    <button className="btn">Secondary</button>
    <button className="btn primary">Primary</button>
    <button className="btn success">Success</button>
    <button className="btn danger">Danger</button>
  </div>
);
```

### Badge Component

```tsx
const Badge = ({ label, variant = 'success' }) => {
  const variants = {
    success: {
      background: 'var(--color-success-tint)',
      color: 'var(--color-success)',
      border: '1px solid var(--color-success)',
    },
    warning: {
      background: 'rgb(190 93 29 / 0.1)',
      color: 'var(--color-warning)',
      border: '1px solid var(--color-warning)',
    },
    danger: {
      background: 'var(--color-danger-tint)',
      color: 'var(--color-danger)',
      border: '1px solid var(--color-danger)',
    },
  };

  return (
    <span className="badge" style={variants[variant]}>
      {label}
    </span>
  );
};
```

## Implementing Success Portal Components

### Dashboard KPI Grid

```tsx
const Dashboard = () => {
  const kpis = [
    { label: 'ROAS', value: '4.2x', change: '↑ 12% vs last month', changeType: 'positive' },
    { label: 'Monthly Spend', value: '$24,580', change: 'On budget', changeType: 'neutral' },
    { label: 'Conversion Rate', value: '3.8%', change: '⚠️ 0.2% below target', changeType: 'negative' },
    { label: 'Cost per Lead', value: '$42', change: '↓ 8% optimized', changeType: 'positive' },
  ];

  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'var(--space-lg)',
    }}>
      {kpis.map((kpi) => (
        <KPICard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
};
```

## Dark Mode Support

The CSS variables automatically respond to the user's system preference:

```css
/* Automatically uses light or dark colors based on prefers-color-scheme */
@media (prefers-color-scheme: light) {
  :root {
    --color-bg: var(--color-light-canvas);
    --color-fg: var(--color-light-ink-primary);
    /* ... etc */
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: var(--color-dark-canvas);
    --color-fg: var(--color-dark-ink-primary);
    /* ... etc */
  }
}
```

## Best Practices

1. **Use CSS Variables** - Always reference tokens instead of hardcoding colors/sizes
2. **Respect Spacing Scale** - Use the 8px base unit for consistency
3. **Follow Typography Scale** - Stick to defined sizes for hierarchy
4. **Semantic Colors** - Use green for success, orange for warnings, red for danger
5. **Component Reusability** - Build small, composable components
6. **Focus States** - Always include focus rings for accessibility

## Next Steps

1. Update your existing React components to use these tokens
2. Convert specific screens (e.g., dashboard, creatives review) using Success Portal as reference
3. Add Tailwind classes if using Tailwind CSS (create a config using these tokens)
4. Document any custom component variations in this guide
