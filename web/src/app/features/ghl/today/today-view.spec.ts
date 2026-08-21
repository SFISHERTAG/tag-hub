import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { TodayView } from './today-view';
import { TodayService } from '../services/today.service';
import { FollowUpService } from '../services/follow-up.service';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type {
  FollowUpResponse,
  MarkAppointmentResponse,
  TodayResponse,
  TodaySummary,
} from '../services/ghl.model';

/**
 * Story: one number on this screen can be wrong in a way nobody catches.
 *
 * `showRatePct: null` means the outcome store could not be read. Rendered as
 * "0%" that becomes a claim that nobody showed up all day — a fact a sales
 * manager would act on. So null gets its own sentence, and a genuine zero keeps
 * its own. These two tests are the ones that matter most in this file.
 *
 * The screen also never derives a rate itself. The server computes it through
 * `getClientHealth`, whose denominator cannot be smaller than its numerator, so
 * the value is structurally bounded at 100%. A second calculation here is
 * precisely how that bound was lost before, which is why nothing below asks the
 * component to compute one.
 */

const day = vi.fn<() => Promise<ApiResult<TodayResponse>>>();
const mark = vi.fn<() => Promise<ApiResult<MarkAppointmentResponse>>>();
const queue = vi.fn<() => Promise<ApiResult<FollowUpResponse>>>();

function summary(overrides: Partial<TodaySummary> = {}): TodaySummary {
  return {
    total: 2,
    marked: 1,
    showRatePct: 50,
    dqBreakdown: { preCall: 1, onCall: 0 },
    outcomesUnavailable: false,
    ...overrides,
  };
}

function today(overrides: Partial<TodayResponse> = {}): TodayResponse {
  return {
    day: 'today',
    label: 'Today',
    range: { startMs: 0, endMs: 1 },
    calendars: [],
    appointments: [
      {
        id: 'appt1',
        calendarId: 'cal1',
        calendarName: 'Discovery calls',
        contactId: 'c1',
        title: 'Ada Lovelace',
        startTime: '2026-03-01T15:00:00.000Z',
        endTime: '2026-03-01T15:30:00.000Z',
        status: 'confirmed',
      },
    ],
    summary: summary(),
    ...overrides,
  };
}

function emptyQueue(): FollowUpResponse {
  return {
    config: { mode: 'days', value: 7 },
    canConfigure: false,
    lookaheadDays: 30,
    lookbackDays: 90,
    total: 0,
    truncated: false,
    enriched: false,
    configFallback: false,
    candidates: [],
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(queryParams: Record<string, string> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [TodayView],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ locationId: 'loc1' }) },
          parent: null,
          paramMap: of(convertToParamMap({ locationId: 'loc1' })),
          queryParamMap: of(convertToParamMap(queryParams)),
        },
      },
      { provide: TodayService, useValue: { day, mark } },
      { provide: FollowUpService, useValue: { queue } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
    ],
  });

  const fixture = TestBed.createComponent(TodayView);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

beforeEach(() => {
  vi.clearAllMocks();
  day.mockResolvedValue(ok(today()));
  queue.mockResolvedValue(ok(emptyQueue()));
  mark.mockResolvedValue(
    ok({ appointmentId: 'appt1', status: 'showed', timing: 'on-call', timingRecorded: true }),
  );
});

describe('TodayView', () => {
  it('asks the server for the day named in the URL', async () => {
    await setup({ day: 'tomorrow' });

    expect(day).toHaveBeenCalledWith('loc1', 'tomorrow');
  });

  it('falls back to today for a day nobody recognises', async () => {
    await setup({ day: 'next-tuesday' });

    // A hand-edited URL should show the default day, not an error the reader
    // cannot act on.
    expect(day).toHaveBeenCalledWith('loc1', 'today');
  });

  it('renders the show rate the server calculated', async () => {
    const { host } = await setup();

    expect(host.textContent).toContain('50% show rate');
  });

  it('says a real zero is a zero', async () => {
    day.mockResolvedValue(ok(today({ summary: summary({ showRatePct: 0 }) })));

    const { host } = await setup();

    expect(host.textContent).toContain('0% show rate');
    expect(host.textContent).not.toContain('unavailable');
  });

  it('never renders an unknown show rate as zero', async () => {
    day.mockResolvedValue(
      ok(
        today({
          summary: summary({
            showRatePct: null,
            dqBreakdown: null,
            outcomesUnavailable: true,
          }),
        }),
      ),
    );

    const { host } = await setup();

    // "We could not read the outcomes" and "nobody showed up" are opposite
    // facts about a closer's day.
    expect(host.textContent).toContain('Show rate unavailable');
    expect(host.textContent).not.toContain('0% show rate');
    expect(host.querySelector('.today__notice')?.textContent).toContain(
      'could not be read',
    );
  });

  it('breaks DQs into pre-call and on-call', async () => {
    const { host } = await setup();

    // A pre-call DQ points at targeting, an on-call DQ points at fit. One
    // number for both hides which is broken.
    expect(host.textContent).toContain('DQ: 1 pre-call, 0 on-call');
  });

  it('shows an error instead of an empty day', async () => {
    day.mockResolvedValue({
      data: null,
      error: {
        message: 'GHL is not configured for this location.',
        context: 'GET',
        status: 503,
      },
    });

    const { host } = await setup();

    expect(host.textContent).toContain('This client is not connected to GoHighLevel');
    expect(host.textContent).toContain('GHL is not configured for this location.');
    expect(host.querySelector('app-appointment-row')).toBeNull();
  });

  it('does not offer a retry for a client that is not connected', async () => {
    day.mockResolvedValue({
      data: null,
      error: { message: 'GHL is not configured.', context: 'GET', status: 503 },
    });

    const { host } = await setup();

    // Retrying cannot reconnect a tenant. A button that loops is worse than
    // no button.
    expect(host.textContent).not.toContain('Try again');
  });

  it('refreshes the summary after an outcome is marked', async () => {
    const { fixture, host } = await setup();

    expect(day).toHaveBeenCalledTimes(1);

    const showed = Array.from(
      host.querySelectorAll<HTMLElement>('.appointment__outcomes button'),
    ).find((button) => button.textContent?.trim() === 'Showed');
    showed?.click();
    await settle();
    fixture.detectChanges();
    await settle();

    // The marked count and the show rate both moved. Leaving them stale is how
    // a screen ends up disagreeing with itself.
    expect(day).toHaveBeenCalledTimes(2);
  });

  it('asks the follow-up queue for the cheap view', async () => {
    await setup();

    // Story 2.8 AC5: no per-row fetch while the day renders.
    expect(queue).toHaveBeenCalledWith('loc1', { enrich: false });
  });
});
