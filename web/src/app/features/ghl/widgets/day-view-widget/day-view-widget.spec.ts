import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DayViewWidget } from './day-view-widget';
import { GhlWidgetsService } from '../../services/ghl-widgets.service';
import { ok } from '../../../../core/models/api-result.model';
import type { ApiResult } from '../../../../core/models/api-result.model';
import type { CallForDisplay, DayViewResponse } from '../../services/ghl-widgets.model';

/**
 * Two things are asserted here that are invisible in manual testing.
 *
 * **An unreadable calendar must not render as an empty day.** The route answers
 * HTTP 200 with `dayView: { ok: false }` — including for the no-location case,
 * which is every account mid-setup — so `ApiResult.error` is null and a
 * transport-only check shows "Nothing booked today" to someone whose calendar
 * was never connected. The route's own comment draws the line these tests
 * enforce: an empty schedule and an unreachable calendar are different states.
 *
 * **Times are the server's strings, never re-derived.** The payload carries both
 * a raw ISO `startTime` and a `startTimeFormatted` rendered in the tenant's
 * zone. Formatting the ISO in the browser would use the viewer's zone, which is
 * correct on the developer's machine and wrong for anyone east or west of the
 * client — the defect would ship green. The fixture's ISO and formatted values
 * are deliberately in different zones so that substituting one for the other
 * fails here.
 */

const getDayView = vi.fn<() => Promise<ApiResult<DayViewResponse>>>();

const CALL: CallForDisplay = {
  id: 'apt-1',
  // 22:30 UTC is the next calendar day in the tenant's zone. If anything ever
  // formats this ISO string in the browser, the two will disagree and this
  // fixture is what makes that disagreement fail a test.
  startTime: '2026-08-27T22:30:00.000Z',
  endTime: '2026-08-27T23:00:00.000Z',
  startTimeFormatted: '9:30 AM',
  endTimeFormatted: '10:00 AM',
  booked: true,
  attendee: 'Lakemore Advisory Group',
  callType: 'discovery',
  status: 'confirmed',
};

function calls(count: number): CallForDisplay[] {
  return Array.from({ length: count }, (_, i) => ({
    ...CALL,
    id: `apt-${i}`,
    attendee: `Client ${i}`,
  }));
}

async function setup(body: DayViewResponse) {
  getDayView.mockReset();
  getDayView.mockResolvedValue(ok(body));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [DayViewWidget],
    providers: [
      provideZonelessChangeDetection(),
      { provide: GhlWidgetsService, useValue: { getDayView } },
    ],
  });

  const fixture = TestBed.createComponent(DayViewWidget);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

describe('DayViewWidget', () => {
  it('renders the schedule', async () => {
    const { host } = await setup({ dayView: { ok: true, calls: [CALL] }, warnings: [] });
    expect(host.querySelectorAll('.day__call').length).toBe(1);
    expect(host.querySelector('.day__who')?.textContent?.trim()).toBe('Lakemore Advisory Group');
  });

  it("renders the server's formatted time and never the raw ISO", async () => {
    const { host } = await setup({ dayView: { ok: true, calls: [CALL] }, warnings: [] });
    expect(host.querySelector('.day__time')?.textContent?.trim()).toBe('9:30 AM');
    // The ISO is for keys and ordering. If it reaches the DOM, something
    // formatted it in the viewer's timezone instead of using the tenant's.
    expect(host.textContent).not.toContain('2026-08-27T22:30');
  });

  it('treats dayView.ok === false inside a 200 as an error, not an empty day', async () => {
    const { host } = await setup({
      dayView: { ok: false, message: 'No GHL location configured yet.' },
      warnings: [{ code: 'no_location', message: 'Finish connecting your calendar.' }],
    });

    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelector('app-empty-state')).toBeNull();
    expect(host.querySelectorAll('.day__call').length).toBe(0);
  });

  it('keeps the warning that explains a payload failure', async () => {
    const { host } = await setup({
      dayView: { ok: false, message: 'No GHL location configured yet.' },
      warnings: [{ code: 'no_location', message: 'Finish connecting your calendar.' }],
    });
    // The error message alone says what broke; the warning says what to do.
    expect(host.querySelector('.day__warning')?.textContent?.trim()).toBe(
      'Finish connecting your calendar.',
    );
  });

  it('shows an empty day as empty, not as an error', async () => {
    const { host } = await setup({ dayView: { ok: true, calls: [] }, warnings: [] });
    expect(host.querySelector('app-empty-state')).not.toBeNull();
    expect(host.querySelector('app-error-state')).toBeNull();
  });

  it('caps the list and counts the remainder', async () => {
    const { host } = await setup({ dayView: { ok: true, calls: calls(7) }, warnings: [] });
    expect(host.querySelectorAll('.day__call').length).toBe(4);
    expect(host.querySelector('.day__more')?.textContent?.trim()).toBe('and 3 more today');
  });

  it('surfaces a transport failure rather than an empty day', async () => {
    getDayView.mockReset();
    getDayView.mockResolvedValue({
      data: null,
      error: { message: 'Network unreachable.', context: 'GET /api/dashboard/widgets/day-view' },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DayViewWidget],
      providers: [
        provideZonelessChangeDetection(),
        { provide: GhlWidgetsService, useValue: { getDayView } },
      ],
    });
    const fixture = TestBed.createComponent(DayViewWidget);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('app-error-state')).not.toBeNull();
    expect(host.querySelector('app-empty-state')).toBeNull();
  });
});
