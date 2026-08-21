# Dashboard Screens Implementation Guide

This guide covers the four new screens added to the TAG dashboard: Navigation Tabs, Creatives, Calls, and Resources.

## Overview

The dashboard now has a tab-based navigation system allowing users to switch between four screens:

```
┌─────────────────────────────────────────┐
│  Dashboard  │ Creatives │ Calls │ Resources │  ← Navigation tabs
├─────────────────────────────────────────┤
│                                           │
│         Screen Content                    │
│    (changes based on active tab)          │
│                                           │
└─────────────────────────────────────────┘
```

## File Structure

```
app/dashboard/
├── dashboard-nav-tabs.tsx          # Navigation tab component
├── page-client.tsx                 # Client wrapper handling screen switching
├── page.tsx                        # Updated with content composition
│
├── creatives/
│   ├── creative-card.tsx           # Individual creative card
│   └── creatives-screen.tsx        # Full creatives screen
│
├── calls/
│   ├── time-slot.tsx               # Time slot component
│   └── calls-screen.tsx            # Full calls/scheduling screen
│
├── resources/
│   ├── file-item.tsx               # Document/resource card
│   └── resources-screen.tsx        # Full resources screen
│
└── modals/
    └── creative-approval-modal.tsx # Creative approval dialog
```

## Screen Details

### 1. Dashboard Screen (Default)

**Path:** `/dashboard`  
**Description:** Performance overview with KPIs, charts, and integrations

**Components:**
- KPI Grid (ROAS, Spend, Conversion Rate, Cost per Lead)
- 30-Day Performance Chart (7-bar trend visualization)
- Health Check Metrics
- Spend Charts by Channel/Ad
- Funnel Table
- Top Deals
- Documents Widget (Google Drive)
- Slack Widget (Channel messages)

**Features:**
- Export button
- Custom KPIs button
- Responsive grid (2 → 4 columns)

---

### 2. Creatives Screen

**Path:** `/dashboard` → Click "Creatives" tab  
**Description:** Manage and approve ad creatives across platforms

#### Key Components

**CreativeCard** (`creative-card.tsx`)
```tsx
interface Creative {
  id: string;
  title: string;
  platform: 'facebook' | 'instagram' | 'google' | 'tiktok';
  format: 'image' | 'video' | 'carousel' | 'text';
  status: 'draft' | 'pending-approval' | 'approved' | 'rejected';
  thumbnail?: string;
  description?: string;
  submittedAt?: string;
}
```

**Features:**
- Platform badge (color-coded by platform)
- Status badge (draft, pending, approved, rejected)
- Format icon (video, image, carousel, text)
- Hover actions for pending-approval items
- Quick approve/reject buttons on hover

**CreativesScreen** (`creatives-screen.tsx`)

**Features:**
- Status filtering (All, Draft, Pending, Approved, Rejected)
- Grid layout (2 → 4 columns responsive)
- Status counts on filter buttons
- "New Creative" button
- Empty state handling
- Approval modal integration

**CreativeApprovalModal** (`modals/creative-approval-modal.tsx`)

**Features:**
- Full creative preview
- Platform and format display
- Description section
- Approval notes textarea
- Approve/Request Changes buttons
- ESC key to close
- Backdrop click to close

#### Usage Example

```tsx
import { CreativesScreen } from '@/app/dashboard/creatives/creatives-screen';

export function MyComponent() {
  return <CreativesScreen />;
}
```

#### Design Details

**Status Colors:**
- Draft: Gray (`bg-raised`)
- Pending: Amber (`bg-warn-tint`)
- Approved: Green (`bg-ok-tint`)
- Rejected: Red (`bg-danger-tint`)

**Platform Colors:**
- Facebook: `text-info`
- Instagram: `text-warn`
- Google: `text-accent`
- TikTok: `text-danger`

---

### 3. Calls Screen

**Path:** `/dashboard` → Click "Calls" tab  
**Description:** Schedule and manage client calls

#### Key Components

**TimeSlot** (`calls/time-slot.tsx`)
```tsx
interface TimeSlot {
  id: string;
  startTime: string;      // HH:MM format
  endTime: string;        // HH:MM format
  booked: boolean;
  attendee?: string;
  topic?: string;
  callType?: 'discovery' | 'strategy' | 'optimization' | 'follow-up';
}
```

**Features:**
- Available/booked state display
- Attendee name and call topic
- Call type badge
- Book/Cancel buttons
- Hover state indication

**CallsScreen** (`calls/calls-screen.tsx`)

**Features:**
- Scheduled/Available/Utilization stats (3 cards)
- Date selector (next 7 days)
- Time slot grid (responsive 2 → 4 columns)
- Upcoming calls list (next 5)
- "Sync Calendar" button
- Date-based filtering

**Call Types:**
- `discovery`: First conversation with prospect
- `strategy`: Strategic planning session
- `optimization`: Performance optimization review
- `follow-up`: Follow-up conversation

#### Usage Example

```tsx
import { CallsScreen } from '@/app/dashboard/calls/calls-screen';

export function MyComponent() {
  return <CallsScreen />;
}
```

#### Design Details

**Stats Cards:**
- Scheduled: Green (`bg-ok`)
- Available: Gold (`bg-accent`)
- Utilization: Blue (`bg-info`)

**Call Type Colors:**
- Discovery: `text-info`
- Strategy: `text-accent`
- Optimization: `text-ok`
- Follow-up: `text-warn`

---

### 4. Resources Screen

**Path:** `/dashboard` → Click "Resources" tab  
**Description:** Documents, templates, and assets for campaigns

#### Key Components

**FileResource** (`resources/file-item.tsx`)
```tsx
interface FileResource {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'sheet' | 'image' | 'video' | 'folder';
  size?: string;
  modifiedAt: string;
  sharedWith?: string[];
  category?: 'guide' | 'template' | 'report' | 'asset' | 'other';
}
```

**Features:**
- File type icon
- File name and metadata
- Category badge
- Shared with count
- Download/Share/Delete actions
- Hover state

**ResourcesScreen** (`resources/resources-screen.tsx`)

**Features:**
- Search functionality (real-time filtering)
- Category filtering with counts
- Grid layout (2 → 4 columns)
- Recently Modified section (Fold component)
- "Upload" button
- Empty state with context-aware messaging
- Last modified tracking

**Categories:**
- `guide`: How-to and strategy documents
- `template`: Reusable templates
- `report`: Analytics and performance reports
- `asset`: Creative assets and media
- `other`: Miscellaneous

#### Usage Example

```tsx
import { ResourcesScreen } from '@/app/dashboard/resources/resources-screen';

export function MyComponent() {
  return <ResourcesScreen />;
}
```

#### Design Details

**Category Colors:**
- Guide: `text-info`
- Template: `text-accent`
- Report: `text-ok`
- Asset: `text-warn`
- Other: `text-neutral`

---

## Navigation Implementation

### DashboardNavTabs Component

```tsx
interface DashboardNavTabsProps {
  currentScreen: 'dashboard' | 'creatives' | 'calls' | 'resources';
  onScreenChange: (screen: Screen) => void;
}

export function DashboardNavTabs({
  currentScreen,
  onScreenChange,
}: DashboardNavTabsProps) {
  // Tab switching logic
}
```

**Features:**
- Sticky positioning below header
- Gold underline for active tab
- Smooth color transitions
- Mobile-friendly scrolling

### Integration in Page Client

```tsx
'use client';

export function DashboardPageClient({
  accountName,
  dashboardContent,
}: DashboardPageClientProps) {
  const [currentScreen, setCurrentScreen] = useState('dashboard');

  return (
    <div className="space-y-0">
      <div className="sticky top-[calc(3.5rem+1.5rem)] z-20">
        <DashboardNavTabs
          currentScreen={currentScreen}
          onScreenChange={setCurrentScreen}
        />
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {currentScreen === 'dashboard' && (
          <DashboardLayout>{dashboardContent}</DashboardLayout>
        )}
        {currentScreen === 'creatives' && <CreativesScreen />}
        {currentScreen === 'calls' && <CallsScreen />}
        {currentScreen === 'resources' && <ResourcesScreen />}
      </div>
    </div>
  );
}
```

---

## Design System Compliance

All screens follow the TAG design system:

### Color Tokens Used
- **Accent (Brand):** `text-accent`, `bg-accent`
- **Success:** `text-ok`, `bg-ok-tint`
- **Warning:** `text-warn`, `bg-warn-tint`
- **Danger:** `text-danger`, `bg-danger-tint`
- **Info:** `text-info`, `bg-info-tint`
- **Text:** `text-ink`, `text-ink-2`, `text-ink-3`
- **Backgrounds:** `bg-canvas`, `bg-surface`, `bg-raised`, `bg-sunken`

### Utilities Applied
- **lift:** Shadow and elevation effect
- **glass:** Translucent background with blur

### Responsive Breakpoints
- Mobile: Single column (`grid-cols-1`)
- Tablet: 2 columns (`sm:grid-cols-2` → `sm:grid-cols-3`)
- Desktop: 4 columns (`lg:grid-cols-4`)

### Dark Mode
All components automatically support dark mode via CSS variables in `globals.css`

---

## Mock Data

Each screen includes comprehensive mock data for development:

**Creatives:** 6 samples (various platforms, statuses, formats)  
**Calls:** 12 time slots across a full day  
**Resources:** 8 documents with various types and categories

To replace with real data:
1. Update state initialization in screen components
2. Add API calls to fetch actual data
3. Replace handlers with real backend calls

---

## Future Enhancements

### Planned Features
- [ ] Real-time data fetching from GHL API
- [ ] Creative upload and versioning
- [ ] Calendar integration for call scheduling
- [ ] Google Drive API integration for resources
- [ ] Slack message threading in resources
- [ ] Advanced filtering and sorting
- [ ] Bulk actions for creatives
- [ ] Call recording and notes
- [ ] Export/reporting functionality

### Customization Points
- Add more platforms to creatives
- Customize call types
- Add more resource categories
- Implement real file uploads
- Integrate with Google Calendar
- Add analytics and metrics

---

## Testing

### Manual Testing Checklist

**Navigation:**
- [ ] All 4 tabs render correctly
- [ ] Tab switching works smoothly
- [ ] Active tab indicator moves correctly
- [ ] Active tab is highlighted in gold
- [ ] Tabs are sticky and visible while scrolling

**Creatives Screen:**
- [ ] Grid displays all creatives
- [ ] Status filters work
- [ ] Filter counts are accurate
- [ ] Hover actions appear on pending items
- [ ] Approve/reject buttons work
- [ ] Modal opens on view
- [ ] Modal closes on ESC and backdrop click
- [ ] Empty state shows when appropriate

**Calls Screen:**
- [ ] Stats cards show correct counts
- [ ] Date selector allows navigation
- [ ] Time slots display correctly
- [ ] Booking/cancellation works
- [ ] Upcoming calls list updates
- [ ] Utilization percentage calculates correctly

**Resources Screen:**
- [ ] Search filters results in real-time
- [ ] Category filters work
- [ ] Recently modified list shows correct order
- [ ] File type icons display
- [ ] Download/share/delete buttons work
- [ ] Fold component expands/collapses

**Responsive Design:**
- [ ] Mobile (375px): Single column layout
- [ ] Tablet (768px): 2-3 columns
- [ ] Desktop (1280px): 4 columns
- [ ] No horizontal scroll on any breakpoint

**Dark Mode:**
- [ ] All text readable in dark mode
- [ ] Badge colors appropriate in dark mode
- [ ] Background colors correct in dark mode
- [ ] Borders visible in dark mode

---

## Troubleshooting

### Tab switching not working
- Check that `DashboardPageClient` is marked as `'use client'`
- Verify `useState` is imported from React
- Check console for errors

### Modal not opening
- Verify `showModal` and `selectedCreative` state
- Check that modal is inside the render tree
- Ensure modal JSX is not conditionally excluded

### Styles not applying
- Check that Tailwind classes exist in `globals.css`
- Verify color token names match design system
- Check for conflicting CSS

### Data not updating
- Verify state setters are called correctly
- Check that mock data is initialized in `useState`
- Ensure event handlers have correct event stopping (`e.stopPropagation()`)

---

## Performance Considerations

- All screens use client components for interactivity
- Mock data is in-memory (suitable for demo)
- Modal renders only when `isOpen` is true
- Grid layouts use native CSS Grid (performant)
- Search uses simple string matching (OK for demo, consider IndexedDB for production)

---

## Maintenance Notes

- **Mock data locations:** Each screen component
- **Navigation logic:** `DashboardPageClient`
- **Shared UI components:** `/app/ui.tsx`
- **Design tokens:** `globals.css`
- **Icon components:** `/app/icons.tsx`

---

Last updated: August 13, 2026  
Created with: TAG Design System  
Status: ✅ Complete and functional
