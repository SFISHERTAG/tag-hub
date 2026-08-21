'use client';

import { useState } from 'react';
import { Panel } from '../../ui';
import { TimeSlotComponent, type TimeSlot } from './time-slot';
import type { CallForDisplay } from '@/lib/dashboard/data-fetchers';

// Map server data to client display format
function mapCallToTimeSlot(call: CallForDisplay): TimeSlot {
  return {
    id: call.id,
    startTime: call.startTimeFormatted,
    endTime: call.endTimeFormatted,
    booked: call.booked,
    attendee: call.attendee,
    topic: call.topic,
    callType: call.callType as TimeSlot["callType"],
  };
}

// Fallback mock data
const MOCK_TIME_SLOTS: TimeSlot[] = [
  {
    id: '1',
    startTime: '09:00',
    endTime: '09:30',
    booked: true,
    attendee: 'Acme Corp - John Smith',
    topic: 'Quarterly Strategy Review',
    callType: 'strategy',
  },
  {
    id: '2',
    startTime: '10:00',
    endTime: '10:30',
    booked: false,
  },
  {
    id: '3',
    startTime: '11:00',
    endTime: '11:30',
    booked: true,
    attendee: 'Growth Inc - Sarah Johnson',
    topic: 'Performance Optimization Discussion',
    callType: 'optimization',
  },
  {
    id: '4',
    startTime: '14:00',
    endTime: '14:30',
    booked: false,
  },
  {
    id: '5',
    startTime: '15:00',
    endTime: '15:30',
    booked: true,
    attendee: 'New Prospect - Michael Chen',
    topic: 'Discovery Call',
    callType: 'discovery',
  },
  {
    id: '6',
    startTime: '16:00',
    endTime: '16:30',
    booked: false,
  },
];

export function CallsScreen({
  initialData = [],
  upcomingData = []
}: {
  initialData?: CallForDisplay[];
  upcomingData?: CallForDisplay[];
} = {}) {
  const mappedInitial = initialData.length > 0
    ? initialData.map(mapCallToTimeSlot)
    : MOCK_TIME_SLOTS;

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(mappedInitial);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const bookedCount = timeSlots.filter((s) => s.booked).length;
  const availableCount = timeSlots.filter((s) => !s.booked).length;

  const handleBook = (slotId: string) => {
    setTimeSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              booked: true,
              attendee: 'New Booking',
              callType: 'follow-up',
            }
          : slot
      )
    );
  };

  const handleCancel = (slotId: string) => {
    setTimeSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              booked: false,
              attendee: undefined,
              topic: undefined,
              callType: undefined,
            }
          : slot
      )
    );
  };

  const handleViewDetails = (slot: TimeSlot) => {
    if (slot.booked) {
      // Could open a details modal
      console.log('View details for:', slot);
    }
  };

  // Generate available dates (next 7 days)
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Calls</h2>
          <p className="mt-1 text-sm text-ink-2">
            Schedule and manage client calls
          </p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-accent-ink hover:opacity-90 transition-opacity">
          Sync Calendar
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Panel title="Scheduled" meta={bookedCount.toString()}>
          <p className="text-2xl font-bold text-ok">{bookedCount}</p>
        </Panel>
        <Panel title="Available" meta={availableCount.toString()}>
          <p className="text-2xl font-bold text-accent">{availableCount}</p>
        </Panel>
        <Panel title="Utilization">
          <p className="text-2xl font-bold text-info">
            {Math.round((bookedCount / timeSlots.length) * 100)}%
          </p>
        </Panel>
      </div>

      {/* Date Selector */}
      <div>
        <label className="text-xs font-semibold text-ink-3 uppercase block mb-3">
          Schedule for
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((date) => {
            const d = new Date(date);
            const isSelected = date === selectedDate;
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = d.getDate();

            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg border transition-colors text-center ${
                  isSelected
                    ? 'bg-accent text-accent-ink border-accent'
                    : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                }`}
              >
                <div className="text-xs font-semibold">{dayName}</div>
                <div className="text-sm font-bold mt-0.5">{dayNum}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots Grid */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Available Times</h3>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {timeSlots.map((slot) => (
            <TimeSlotComponent
              key={slot.id}
              slot={slot}
              onBook={handleBook}
              onCancel={handleCancel}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>

      {/* Upcoming Calls */}
      <Panel title="Upcoming Calls">
        <div className="space-y-3">
          {timeSlots
            .filter((s) => s.booked)
            .slice(0, 5)
            .map((slot) => (
              <div
                key={slot.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-line bg-raised"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">
                    {slot.attendee}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {slot.startTime} - {slot.endTime}
                  </p>
                  {slot.topic && (
                    <p className="text-xs text-ink-2 mt-1">{slot.topic}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded bg-ok/10 text-ok">
                    {slot.callType || 'call'}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </Panel>
    </div>
  );
}
