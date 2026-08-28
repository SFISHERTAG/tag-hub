import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { OwnerCalendarWidget } from './owner-calendar-widget';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type { OwnerAppointment, OwnerCalendarResponse } from '../../services/ghl-widgets.model';

/**
 * The headline assertion is the scope notice.
 *
 * `scoped: false` means the tenant has no `ownerGhlUserId` and the server
 * returned the WHOLE LOCATION's calendar. The tile is titled "My Calendar". An
 * unsurfaced `scoped: false` is a tile that contradicts its own title, and the
 * reading it invites is wrong in a way the viewer has no way to detect.
 *
 * The second is a negative: no clock time may be rendered. `OwnerAppointment`
 * carries a raw ISO instant and no formatted string, and the payload does not
 * carry the tenant's timezone, so any time on screen was computed in the
 * viewer's zone and is wrong for anyone elsewhere. The fixture's ISO is
 * deliberately near midnight UTC so a client-side format would visibly differ.
 */

const getOwnerCalendar = vi.fn<() => Promise<ApiResult<OwnerCalendarResponse>>>();

const APPOINTMENT: OwnerAppointment = {
  id: 'apt-1',
  title: 'Strategy call',
  startTime: '2026-08-27T23:45:00.000Z',
  endTime: '2026-08-28T00:15:00.000Z',
  status: 'confirmed',
  isPastOrToday: false,
};

function body(overrides: Partial<Extract<OwnerCalendarResponse['calendar'], { ok: true }>> = {}) {
  return {
    calendar: {
      ok: true,
      locationId: 'loc-1',
      scoped: true,
      monthLabel: 'August 2026',
      days: [
        { date: '2026-08-26', dayOfMonth: 26, isToday: false, isCurrentMonth: true, appointments: [] },
        {
          date: '2026-08-27',
          dayOfMonth: 27,
          isToday: true,
          isCurrentMonth: true,
          appointments: [APPOINTMENT],
        },
      ],
      upcoming: [APPOINTMENT],
      ...overrides,
    },
    warnings: [],
  } satisfies OwnerCalendarResponse;
}

async function setup(payload: OwnerCalendarResponse) {
  getOwnerCalendar.mockReset();
  getOwnerCalendar.mockResolvedValue(ok(payload));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [OwnerCalendarWidget],
    providers: [
      provideZonelessChangeDetection(),
      { provide: GhlWidgetsService, useValue: { getOwnerCalendar } },
    ],
  });

  const fixture = TestBed.createComponent(OwnerCalendarWidget);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('OwnerCalendarWidget', () => {
  it('renders the month and marks today', async () => {
    const { host } = await setup(body());
    expect(host.querySelector('.calendar__month')?.textContent?.trim()).toBe('August 2026');
    expect(host.querySelectorAll('.calendar__day').length).toBe(2);
    expect(host.querySelectorAll('.calendar__day--today').length).toBe(1);
  });

  it('says so when the calendar is the location, not the owner', async () => {
    const { host } = await setup(body({ scoped: false }));
    const note = host.querySelector('.calendar__scope');
    expect(note).not.toBeNull();
    expect(note?.getAttribute('role')).toBe('note');
    expect(note?.textContent).toContain("whole location's calendar");
  });

  it('stays silent about scope when the calendar really is the owner', async () => {
    const { host } = await setup(body({ scoped: true }));
    expect(host.querySelector('.calendar__scope')).toBeNull();
  });

  it('renders no clock time, because the payload carries none that is safe', async () => {
    const { host } = await setup(body());
    expect(host.textContent).toContain('Strategy call');

    // Asserted as a pattern, not as a list of expected clock strings. The first
    // version of this test named specific times and passed against a DatePipe
    // that rendered "4:45 PM", because it assumed the runner was in UTC and it
    // is in America/Los_Angeles. A test whose correctness depends on the
    // runner's zone is the same defect it is meant to catch, one level up.
    //
    // The claim is that NO clock time is rendered at all, so that is the
    // assertion. It subsumes the raw ISO, which contains "23:45".
    expect(host.textContent).not.toMatch(/\d{1,2}:\d{2}/);

    // And the row carries exactly the two fields it is allowed to carry, so an
    // added time fails here too rather than only failing the pattern above.
    const row = host.querySelector('.calendar__appointment');
    expect(row?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Strategy call confirmed');
  });

  it('treats calendar.ok === false inside a 200 as an error, not an empty month', async () => {
    const { host } = await setup({
      calendar: { ok: false, message: 'No GHL location configured yet.' },
      warnings: [{ code: 'no_location', message: 'Finish connecting your calendar.' }],
    });
    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelectorAll('.calendar__day').length).toBe(0);
    expect(host.querySelector('.calendar__warning')?.textContent?.trim()).toBe(
      'Finish connecting your calendar.',
    );
  });

  it('shows an empty upcoming list as empty, not as an error', async () => {
    const { host } = await setup(body({ upcoming: [] }));
    expect(host.querySelector('app-empty-state')).not.toBeNull();
    expect(host.querySelector('app-error-state')).toBeNull();
  });
});
