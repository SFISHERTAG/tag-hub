'use client';

import { Badge, type BadgeTone } from '../../ui';

export interface TimeSlot {
  id: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  booked: boolean;
  attendee?: string;
  topic?: string;
  callType?: 'discovery' | 'strategy' | 'optimization' | 'follow-up';
}

export interface TimeSlotProps {
  slot: TimeSlot;
  onBook?: (slotId: string) => void;
  onCancel?: (slotId: string) => void;
  onViewDetails?: (slot: TimeSlot) => void;
}

/**
 * Badge tones only. `strategy` used to map to 'accent', which Badge does not
 * accept — the `as any` at the call site meant it silently rendered with no
 * colour classes, and gold is reserved for interactive and brand state
 * anyway (see the note on Badge in app/ui.tsx).
 */
const callTypeColors: Record<NonNullable<TimeSlot["callType"]>, BadgeTone> = {
  discovery: "info",
  strategy: "neutral",
  optimization: "ok",
  "follow-up": "warn",
};

export function TimeSlotComponent({
  slot,
  onBook,
  onCancel,
  onViewDetails,
}: TimeSlotProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors cursor-pointer ${
        slot.booked
          ? 'border-line bg-raised hover:border-line-strong'
          : 'border-line bg-surface hover:border-line-strong'
      }`}
      onClick={() => onViewDetails?.(slot)}
    >
      {/* Time */}
      <p className="text-sm font-semibold text-ink">
        {slot.startTime} - {slot.endTime}
      </p>

      {/* Content */}
      {slot.booked ? (
        <>
          <p className="text-xs text-ink-2 mt-1 truncate">{slot.attendee || 'Attendee'}</p>
          {slot.topic && (
            <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">{slot.topic}</p>
          )}
          {slot.callType && (
            <div className="mt-2">
              <Badge tone={callTypeColors[slot.callType]}>
                {slot.callType.replace('-', ' ').charAt(0).toUpperCase() + slot.callType.slice(1).replace('-', ' ')}
              </Badge>
            </div>
          )}
          {onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel(slot.id);
              }}
              className="mt-2 w-full px-2 py-1 text-xs font-semibold rounded border border-line text-danger hover:bg-danger-tint transition-colors"
            >
              Cancel
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-ink-3 mt-1">Available</p>
          {onBook && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBook(slot.id);
              }}
              className="mt-2 w-full px-2 py-1 text-xs font-semibold rounded bg-accent text-accent-ink hover:opacity-90 transition-opacity"
            >
              Book
            </button>
          )}
        </>
      )}
    </div>
  );
}
