import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TodayService } from '../services/today.service';
import { AppointmentRow } from './appointment-row';
import { PrepDialog } from './prep-dialog';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type { MarkAppointmentResponse, TodayAppointment } from '../services/ghl.model';

/**
 * Story: three separate promises this row makes to a closer.
 *
 * It marks optimistically, so working down a list is not a queue of spinners —
 * and it rolls back, because a button left lit for an outcome the API refused
 * is worse than a slow one.
 *
 * It reports a DEGRADED success. The GHL write and the Firestore timing record
 * are two writes; when the second fails the outcome is still saved, but this
 * appointment now counts differently toward show rate. That is said out loud
 * rather than presented as a clean tick.
 *
 * And it never fetches call prep during the render. The panel opens on demand
 * (Story 2.7 AC4) because prep costs three GHL calls per contact.
 */

const mark = vi.fn<() => Promise<ApiResult<MarkAppointmentResponse>>>();
const open = vi.fn();

function appointment(overrides: Partial<TodayAppointment> = {}): TodayAppointment {
  return {
    id: 'appt1',
    calendarId: 'cal1',
    calendarName: 'Discovery calls',
    contactId: 'c1',
    title: 'Ada Lovelace',
    startTime: '2026-03-01T15:00:00.000Z',
    endTime: '2026-03-01T15:30:00.000Z',
    status: 'confirmed',
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(overrides: Partial<TodayAppointment> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: TodayService, useValue: { mark } },
      { provide: MatDialog, useValue: { open } },
    ],
  });

  const fixture = TestBed.createComponent(AppointmentRow);
  fixture.componentRef.setInput('locationId', 'loc1');
  fixture.componentRef.setInput('appointment', appointment(overrides));
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function outcomeButton(host: HTMLElement, label: string): HTMLElement {
  const buttons = Array.from(host.querySelectorAll<HTMLElement>('.appointment__outcomes button'));
  const match = buttons.find((button) => button.textContent?.trim() === label);
  if (match === undefined) throw new Error(`No outcome button labelled "${label}"`);
  return match;
}

function selectedOutcome(host: HTMLElement): string | null {
  const pressed = host.querySelector<HTMLElement>(
    '.appointment__outcomes button[aria-pressed="true"]',
  );
  return pressed?.textContent?.trim() ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mark.mockResolvedValue(
    ok({ appointmentId: 'appt1', status: 'showed', timing: 'on-call', timingRecorded: true }),
  );
});

describe('AppointmentRow', () => {
  it('sends the outcome with the appointment window', async () => {
    const { fixture, host } = setup();

    outcomeButton(host, 'Showed').click();
    await settle();
    fixture.detectChanges();

    expect(mark).toHaveBeenCalledWith('loc1', 'appt1', {
      status: 'showed',
      startTime: '2026-03-01T15:00:00.000Z',
      endTime: '2026-03-01T15:30:00.000Z',
      contactId: 'c1',
      title: 'Ada Lovelace',
    });
  });

  it('shows the outcome before the server answers', async () => {
    let release: (value: ApiResult<MarkAppointmentResponse>) => void = () => undefined;
    mark.mockReturnValue(
      new Promise<ApiResult<MarkAppointmentResponse>>((resolve) => {
        release = resolve;
      }),
    );

    const { fixture, host } = setup();

    outcomeButton(host, 'No-show').click();
    fixture.detectChanges();

    expect(selectedOutcome(host)).toBe('No-show');

    release(
      ok({ appointmentId: 'appt1', status: 'noshow', timing: 'post-call', timingRecorded: true }),
    );
    await settle();
  });

  it('rolls back to the previous outcome when the write is refused', async () => {
    mark.mockResolvedValue({
      data: null,
      error: { message: 'No access to this location.', context: 'PUT', status: 403 },
    });

    const { fixture, host } = setup();

    outcomeButton(host, 'Showed').click();
    await settle();
    fixture.detectChanges();

    expect(selectedOutcome(host)).toBe('Confirmed');
    expect(host.querySelector('.appointment__error')?.textContent).toContain(
      'No access to this location.',
    );
  });

  it('says so when the outcome saved but the timing record did not', async () => {
    mark.mockResolvedValue(
      ok({ appointmentId: 'appt1', status: 'showed', timing: null, timingRecorded: false }),
    );

    const { fixture, host } = setup();

    outcomeButton(host, 'Showed').click();
    await settle();
    fixture.detectChanges();

    // Not an error: GHL has the status. But the metric is degraded, and a
    // silent success would hide that this appointment counts differently.
    expect(host.querySelector('.appointment__error')).toBeNull();
    expect(host.querySelector('.appointment__degraded')?.textContent).toContain(
      'timing record was not written',
    );
  });

  it('emits so the day can refresh its summary', async () => {
    const { fixture, host } = setup();
    const marked = vi.fn();
    fixture.componentInstance.marked.subscribe(marked);

    outcomeButton(host, 'Showed').click();
    await settle();

    expect(marked).toHaveBeenCalledTimes(1);
  });

  it('does not fetch call prep while rendering', () => {
    const { host } = setup();

    // The button exists; the fetch does not happen until it is used.
    expect(host.textContent).toContain('Call prep');
    expect(open).not.toHaveBeenCalled();
  });

  it('opens call prep only when asked, and only for a real contact', () => {
    const { host } = setup();

    const prep = Array.from(host.querySelectorAll<HTMLElement>('button')).find(
      (button) => button.textContent?.trim() === 'Call prep',
    );
    prep?.click();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(PrepDialog);
    expect(open.mock.calls[0][1].data).toEqual({
      locationId: 'loc1',
      contactId: 'c1',
      contactLabel: 'Ada Lovelace',
    });
  });

  it('offers no call prep for an appointment with no contact', () => {
    const { host } = setup({ contactId: undefined });

    expect(host.textContent).not.toContain('Call prep');
  });
});
