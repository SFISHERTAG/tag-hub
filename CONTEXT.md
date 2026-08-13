# TAG Project Context Window

## Project Overview

**TAG (Tax Advisory Growth)** is a client success portal and operational cockpit for managing campaign performance, creative approvals, scheduling, and team collaboration. The project spans two repositories:

- **`/TAG`** (root) - Design system, tokens, documentation, standalone components
- **`/TAG/hub`** (submodule) - Next.js 16 app with Tailwind CSS, running on localhost:3000

## Architecture

### Technology Stack
- **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Styling**: Tailwind CSS v4 with custom color tokens and utilities
- **Auth**: Custom OTP + session-based system
- **External APIs**: GoHighLevel (GHL), Slack, Gmail, Firestore, Google Drive
- **Deployment**: Google Cloud Run (Cloudflare proxy)

### Repository Structure

```
/TAG/
├── hub/                          # Next.js app (submodule)
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # Main dashboard page
│   │   │   ├── dashboard-layout.tsx (NEW)
│   │   │   ├── kpi-card.tsx      (NEW)
│   │   │   ├── widgets/          # Existing dashboard widgets
│   │   │   └── dark-scope.tsx
│   │   ├── layout.tsx            # Root layout with auth check
│   │   ├── ui.tsx                # Design primitives (Panel, Stat, Badge, Fold)
│   │   └── [feature]/            # Other pages (courses, contacts, portfolio, etc.)
│   ├── lib/
│   │   ├── auth/                 # Authentication logic
│   │   ├── ghl/                  # GoHighLevel integration
│   │   ├── dashboard/            # Mock metrics, location config
│   │   └── rules/                # Business rules engine
│   ├── app/globals.css           # Tailwind config, theme CSS variables
│   └── app/tag-design-integration.md
│
├── design-tokens.json            # Structured design values
├── design-tokens.css             # CSS variables (reference)
├── DESIGN_SYSTEM_GUIDE.md        # How to use tokens in React
├── TAG_Design_System.dc.html     # Claude Design reference
├── success-portal.html           # Standalone HTML reference
└── src/components/               # React component library (reference)
    ├── Dashboard.tsx
    ├── Navigation.tsx
    ├── Modal.tsx
    ├── Form.tsx
    ├── Card.tsx
    └── index.ts
```

## Design System

### Color Mapping (Tailwind → TAG)

| Use Case | Tailwind Class | Hex | Light/Dark |
|----------|---|---|---|
| Brand/Interactive | `text-accent`, `bg-accent` | #cc901b / #e0a324 | Warm gold |
| Success/Healthy | `text-ok`, `bg-ok-tint` | #1a6b45 / #3f9d73 | Green |
| Warning/At-Risk | `text-warn`, `bg-warn-tint` | #be5d1d / #dd8244 | Amber |
| Danger/Critical | `text-danger`, `bg-danger-tint` | #b02a1f / #d9584c | Red |
| Text Primary | `text-ink` | #050505 / #f0ede4 | Dark/Light |
| Text Secondary | `text-ink-2` | #5c6370 / #a8a49a | Gray |
| Text Tertiary | `text-ink-3` | #8b8f99 / #78746c | Lighter Gray |
| Backgrounds | `bg-canvas`, `bg-surface`, `bg-raised`, `bg-sunken` | #ffffff → #050505 | Layered |
| Borders | `border-line`, `border-line-strong` | rgb(5 5 5 / 0.2) | Hairlines |

### Tailwind Utilities

```css
@utility lift {
  box-shadow: var(--top-light), var(--elevate);
}

@utility glass {
  background: var(--glass);
  backdrop-filter: blur(12px) saturate(1.15);
}

@utility glow { /* Focus ring effect */ }
@utility glow-ok { /* Success glow */ }
@utility glow-danger { /* Danger glow */ }
```

### Existing UI Components

Located in `hub/app/ui.tsx`:

- **Panel** - Container with title, optional glass effect, lift shadow
- **Stat** - KPI display with value, label, delta, tone (neutral/ok/warn/danger)
- **Badge** - Status label with color coding
- **Fold** - Collapsible `<details>` element with smooth UX

## Current Implementation Status

### ✅ Completed

1. **Design System Foundation**
   - `design-tokens.json` - Complete token definitions
   - `design-tokens.css` - CSS variables for reference
   - `DESIGN_SYSTEM_GUIDE.md` - Implementation examples
   - Color mapping documentation

2. **Dashboard Screen** (First of 5)
   - `KPICard` component (Tailwind-based, gold for ROAS)
   - `DashboardLayout` component with:
     - 4 KPI cards grid
     - 30-day performance chart (7-bar trend)
     - Health check metrics with progress
     - Export & Custom KPIs buttons
   - Responsive layout (sm: 2 cols → lg: 4 cols)
   - Dark mode support via existing theme

3. **Integration Guide**
   - `hub/app/tag-design-integration.md`
   - Color mapping to Tailwind classes
   - Example implementations
   - Best practices

### 🔄 In Progress / Planned

| Screen | Status | Key Components |
|--------|--------|---|
| Dashboard | ✅ Done | KPICard, Chart, HealthMetric |
| Navigation | ⏳ Next | Tabs (Dashboard, Creatives, Calls, Resources) |
| Creatives | ⏳ Next | Card grid, Modal approval, Form |
| Calls | ⏳ Next | Calendar, Time slots, Booking |
| Resources | ⏳ Next | File list, Downloads, Chat |

## Key Implementation Patterns

### Component Style Pattern

```tsx
// Use Tailwind classes + existing color tokens
function MyComponent() {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 lift">
      <p className="text-xs font-semibold uppercase text-ink-2">Label</p>
      <p className="mt-2 text-lg font-bold text-accent">Value</p>
    </div>
  );
}
```

### Dark Mode
- Automatic via `data-theme="dark"` on `:root`
- CSS variables switch colors, Tailwind classes work unchanged
- Use `DarkScope` component for dark sections if needed

### Authentication
- Check `session.hat` (role: client_owner, client_manager, etc.)
- Routes protected in page components
- Session from `@/lib/auth/session` → `requireSession()`

## Important Files to Know

| File | Purpose |
|------|---------|
| `hub/app/globals.css` | Theme CSS vars, Tailwind config, utilities |
| `hub/app/ui.tsx` | Design primitives (Panel, Stat, Badge, Fold) |
| `hub/app/layout.tsx` | Root layout, auth check, dark mode toggle |
| `hub/app/dashboard/page.tsx` | Dashboard page (uses DashboardLayout) |
| `hub/app/dashboard/dark-scope.tsx` | Dark mode wrapper component |
| `/TAG/design-tokens.json` | Source of truth for design values |
| `/TAG/success-portal.html` | Visual reference (view in browser) |
| `hub/app/tag-design-integration.md` | Integration guidelines |

## Development Workflow

### To Add a New Component

1. Create `.tsx` file in `hub/app/[feature]/`
2. Use Tailwind classes with Hub's color system
3. Import existing UI primitives from `hub/app/ui.tsx`
4. Reference design in `/TAG/success-portal.html`
5. Test in both light/dark modes
6. Commit to `hub` submodule

### To Update Dashboard

```bash
cd /Users/home/projects/TAG/hub
# Edit app/dashboard/page.tsx, kpi-card.tsx, dashboard-layout.tsx
npm run dev  # Runs on localhost:3000
git add app/dashboard/
git commit -m "Update dashboard..."
cd /Users/home/projects/TAG
git add hub
git commit -m "Update hub submodule"
```

### Running Locally

```bash
cd /Users/home/projects/TAG/hub
npm run dev  # Starts on http://localhost:3000
```

## Design References

### Visual Design Files
- **Success Portal**: `/TAG/success-portal.html` - Full interactive reference (dark mode, all screens)
- **Design System**: `/TAG/TAG_Design_System.dc.html` - Color palette, components, guidelines
- **Design Tokens**: `/TAG/design-tokens.json` - Machine-readable specifications

### Access Points
- Live app: http://localhost:3000 (requires login)
- Dashboard: /dashboard (client_owner/client_manager only)
- Sign in with OTP (see `.env.local` for test setup)

## Next Implementation Steps

### Phase 1: Navigation & Screen Switching
1. Create `app/navigation/nav-tabs.tsx` component
2. Implement screen state management (useState or URL params)
3. Add Dashboard, Creatives, Calls, Resources tabs
4. Style with Tailwind (gold underline for active)

### Phase 2: Creatives Screen
1. Create `app/creatives/page.tsx`
2. `app/creatives/creative-card.tsx` - Grid item
3. `app/modals/creative-approval-modal.tsx` - Modal dialog
4. Form for ad details (platform, format, notes)
5. Approval workflow (Approve/Request Changes buttons)

### Phase 3: Calls Screen
1. Create `app/calls/page.tsx`
2. `app/calls/time-slot.tsx` - Availability component
3. Booking confirmation UI
4. Calendar integration (if needed)

### Phase 4: Resources Screen
1. Create `app/resources/page.tsx`
2. `app/resources/file-item.tsx` - Document listing
3. Download handlers
4. Slack/chat widget

## Troubleshooting

### Dark Mode Not Working
- Check `globals.css` for `:root[data-theme="dark"]`
- Verify CSS variables are set
- Look for hardcoded colors in components (use Tailwind classes instead)

### Component Looks Wrong
- Compare to `success-portal.html`
- Check Tailwind class names (text-ink vs text-ink-2)
- Verify `lift`, `glass` utilities are loaded

### Build Errors
- Clear `.next/` and rebuild: `rm -rf .next && npm run build`
- Check for missing imports from `@/app/ui`
- Verify TypeScript types: `npm run type-check`

## Useful Commands

```bash
# Development
npm run dev                 # Start dev server
npm run type-check         # TypeScript check
npm run build              # Production build

# Git workflow (in hub submodule)
git status                 # Check changes
git diff                   # See changes
git commit -m "message"    # Commit
git log --oneline          # History
```

## Team & Contact Context

- **User Email**: therealsamfisherofficial@gmail.com
- **Project Date**: Created August 2026
- **Deployment**: Google Cloud Run (tag-success-hub project)
- **Brand**: TAG (Tax Advisory Growth) - Gold #cc901b, professional dark mode focus

## Remember

- **Maintain the design system**: Use Tailwind classes, not hardcoded colors
- **Dark mode first**: All components must work in both themes
- **Reference existing patterns**: Use Panel, Stat, Badge from ui.tsx
- **One screen at a time**: Build Dashboard → Navigation → Creatives → Calls → Resources
- **Test in browser**: localhost:3000/dashboard (after login)
- **Keep it simple**: Leverage existing Hub components, don't reinvent

---

**Last Updated**: August 13, 2026  
**Current Focus**: Navigation tabs & Creatives screen  
**Test Account**: Set up via GHL_LOCATION_ID or OTP auth in .env.local
