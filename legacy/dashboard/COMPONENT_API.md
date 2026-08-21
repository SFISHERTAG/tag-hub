# Component API Reference

Quick reference for using the dashboard screen components.

## Navigation

### DashboardNavTabs

Controls which screen is active.

```tsx
import { DashboardNavTabs } from '@/app/dashboard/dashboard-nav-tabs';

<DashboardNavTabs
  currentScreen="creatives"
  onScreenChange={(screen) => console.log(screen)}
/>
```

**Props:**
- `currentScreen: 'dashboard' | 'creatives' | 'calls' | 'resources'`
- `onScreenChange: (screen: Screen) => void`

---

## Creatives Screen

### CreativeCard

Single creative card in grid.

```tsx
import { CreativeCard, type Creative } from '@/app/dashboard/creatives/creative-card';

const creative: Creative = {
  id: '1',
  title: 'Summer Campaign',
  platform: 'facebook',
  format: 'video',
  status: 'pending-approval',
  description: 'Hero video for summer campaign',
  submittedAt: new Date().toISOString(),
};

<CreativeCard
  creative={creative}
  onApprove={(id) => console.log('Approved:', id)}
  onReject={(id) => console.log('Rejected:', id)}
  onEdit={(id) => console.log('Edit:', id)}
  onViewDetails={(creative) => console.log('View:', creative)}
/>
```

**Props:**
- `creative: Creative` (required)
- `onApprove?: (id: string) => void`
- `onReject?: (id: string) => void`
- `onEdit?: (id: string) => void`
- `onViewDetails?: (creative: Creative) => void`

**Creative Interface:**
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

### CreativesScreen

Full creatives management screen.

```tsx
import { CreativesScreen } from '@/app/dashboard/creatives/creatives-screen';

<CreativesScreen />
```

**Features:**
- Status filtering
- Grid display (responsive)
- Approval workflow
- Modal integration
- Empty states

### CreativeApprovalModal

Modal for creative review and approval.

```tsx
import { CreativeApprovalModal } from '@/app/dashboard/modals/creative-approval-modal';

<CreativeApprovalModal
  creative={selectedCreative}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onApprove={() => handleApprove(creative.id)}
  onReject={() => handleReject(creative.id)}
/>
```

**Props:**
- `creative: Creative` (required)
- `isOpen: boolean` (required)
- `onClose: () => void` (required)
- `onApprove: () => void` (required)
- `onReject: () => void` (required)

---

## Calls Screen

### TimeSlotComponent

Single time slot card.

```tsx
import { TimeSlotComponent, type TimeSlot } from '@/app/dashboard/calls/time-slot';

const slot: TimeSlot = {
  id: '1',
  startTime: '09:00',
  endTime: '09:30',
  booked: true,
  attendee: 'John Smith',
  topic: 'Strategy Review',
  callType: 'strategy',
};

<TimeSlotComponent
  slot={slot}
  onBook={(id) => console.log('Book:', id)}
  onCancel={(id) => console.log('Cancel:', id)}
  onViewDetails={(slot) => console.log('Details:', slot)}
/>
```

**Props:**
- `slot: TimeSlot` (required)
- `onBook?: (slotId: string) => void`
- `onCancel?: (slotId: string) => void`
- `onViewDetails?: (slot: TimeSlot) => void`

**TimeSlot Interface:**
```tsx
interface TimeSlot {
  id: string;
  startTime: string;  // HH:MM format
  endTime: string;    // HH:MM format
  booked: boolean;
  attendee?: string;
  topic?: string;
  callType?: 'discovery' | 'strategy' | 'optimization' | 'follow-up';
}
```

### CallsScreen

Full calls/scheduling screen.

```tsx
import { CallsScreen } from '@/app/dashboard/calls/calls-screen';

<CallsScreen />
```

**Features:**
- Date navigation (7-day window)
- Time slot grid
- Utilization stats
- Upcoming calls list
- Book/cancel workflow

---

## Resources Screen

### FileItem

Single resource/document card.

```tsx
import { FileItem, type FileResource } from '@/app/dashboard/resources/file-item';

const file: FileResource = {
  id: '1',
  name: 'Campaign Strategy Guide',
  type: 'pdf',
  size: '2.4 MB',
  modifiedAt: new Date().toISOString(),
  category: 'guide',
  sharedWith: ['john@example.com'],
};

<FileItem
  file={file}
  onDownload={(id) => console.log('Download:', id)}
  onShare={(id) => console.log('Share:', id)}
  onDelete={(id) => console.log('Delete:', id)}
  onOpen={(file) => console.log('Open:', file)}
/>
```

**Props:**
- `file: FileResource` (required)
- `onDownload?: (id: string) => void`
- `onShare?: (id: string) => void`
- `onDelete?: (id: string) => void`
- `onOpen?: (file: FileResource) => void`

**FileResource Interface:**
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

### ResourcesScreen

Full resources management screen.

```tsx
import { ResourcesScreen } from '@/app/dashboard/resources/resources-screen';

<ResourcesScreen />
```

**Features:**
- Search functionality
- Category filtering
- Recently modified section
- Grid display (responsive)
- File management actions

---

## Integration Patterns

### Using Multiple Screens

```tsx
import { DashboardPageClient } from '@/app/dashboard/page-client';

interface DashboardPageClientProps {
  accountName: string;
  dashboardContent: React.ReactNode;
}

export function MyDashboard() {
  return (
    <DashboardPageClient
      accountName="Acme Corp"
      dashboardContent={<YourDashboardContent />}
    />
  );
}
```

### Adding Event Handlers

```tsx
const [creatives, setCreatives] = useState<Creative[]>(initialData);

const handleApprove = (id: string) => {
  setCreatives((prev) =>
    prev.map((c) =>
      c.id === id ? { ...c, status: 'approved' as const } : c
    )
  );
};
```

### Conditional Rendering

```tsx
{creatives.length > 0 ? (
  <div className="grid gap-4">
    {creatives.map((c) => (
      <CreativeCard key={c.id} creative={c} />
    ))}
  </div>
) : (
  <Panel title="No creatives">
    <p>No creatives yet. Create your first creative.</p>
  </Panel>
)}
```

---

## Type Definitions

### Screen Type
```tsx
type Screen = 'dashboard' | 'creatives' | 'calls' | 'resources';
```

### Creative Status
```tsx
type CreativeStatus = 'draft' | 'pending-approval' | 'approved' | 'rejected';
```

### Creative Platform
```tsx
type Platform = 'facebook' | 'instagram' | 'google' | 'tiktok';
```

### Creative Format
```tsx
type CreativeFormat = 'image' | 'video' | 'carousel' | 'text';
```

### Call Type
```tsx
type CallType = 'discovery' | 'strategy' | 'optimization' | 'follow-up';
```

### File Type
```tsx
type FileType = 'pdf' | 'doc' | 'sheet' | 'image' | 'video' | 'folder';
```

### Resource Category
```tsx
type ResourceCategory = 'guide' | 'template' | 'report' | 'asset' | 'other';
```

---

## Styling Reference

### Tailwind Classes Used

**Spacing:**
- `px-3`, `px-4`, `py-2`, `py-3`: Padding
- `gap-2`, `gap-3`, `gap-4`: Spacing between items
- `mt-1`, `mb-2`: Margins
- `rounded-lg`, `rounded-md`: Border radius

**Layout:**
- `grid`, `grid-cols-2`, `sm:grid-cols-3`, `lg:grid-cols-4`: Responsive grids
- `flex`, `flex-col`, `items-center`, `justify-between`: Flexbox
- `space-y-3`, `space-y-6`: Vertical spacing
- `overflow-hidden`, `line-clamp-2`: Text overflow

**Colors:**
- `text-accent`, `text-ink`, `text-ink-2`, `text-ink-3`
- `bg-surface`, `bg-raised`, `bg-sunken`, `bg-canvas`
- `border-line`, `border-line-strong`

**Effects:**
- `lift`: Shadow effect (custom utility)
- `glass`: Translucent background (custom utility)
- `transition-colors`, `hover:opacity-90`: Interactions

---

## Common Patterns

### Filter Implementation
```tsx
const filtered = items.filter((item) => {
  const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesFilter = filterValue === 'all' || item.category === filterValue;
  return matchesSearch && matchesFilter;
});
```

### Modal Management
```tsx
const [selectedItem, setSelectedItem] = useState<Item | null>(null);
const [showModal, setShowModal] = useState(false);

const handleView = (item: Item) => {
  setSelectedItem(item);
  setShowModal(true);
};

const handleClose = () => {
  setShowModal(false);
  setSelectedItem(null);
};
```

### Responsive Grid
```tsx
<div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
  {items.map((item) => (
    <Component key={item.id} item={item} />
  ))}
</div>
```

---

## Notes

- All components use TypeScript for type safety
- Components are fully responsive
- Dark mode is automatically supported
- Design system tokens are used throughout
- Mock data can be replaced with API calls
- Event handlers receive necessary context
- No external dependencies beyond React/Next.js

---

Last updated: August 13, 2026
