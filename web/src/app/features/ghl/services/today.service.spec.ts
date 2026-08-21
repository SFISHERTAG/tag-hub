import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TodayService } from './today.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { TodayResponse } from './ghl.model';

/**
 * Story: the day window and the show rate both belong to the server, and this
 * test exists to keep them there.
 *
 * The request sends a day KEY, never a computed range: a browser-side range is
 * the viewer's midnight, and an evening appointment in Central falls on the
 * next day in UTC. And `showRatePct: null` must survive as null — a screen that
 * receives "unknown" and stores "0" reports that nobody showed up.
 */

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
      { provide: APP_CONFIG, useValue: { production: false, apiBaseUrl: '', googleClientId: '' } },
    ],
  });

  return {
    service: TestBed.inject(TodayService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

function response(overrides: Partial<TodayResponse> = {}): TodayResponse {
  return {
    day: 'today',
    label: 'Today',
    range: { startMs: 0, endMs: 1 },
    calendars: [],
    appointments: [],
    summary: {
      total: 0,
      marked: 0,
      showRatePct: null,
      dqBreakdown: null,
      outcomesUnavailable: true,
    },
    ...overrides,
  };
}

describe('TodayService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a day key and no client-computed range', async () => {
    const { service, httpMock } = setup();

    const pending = service.day('loc1', 'tomorrow');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/today',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('day')).toBe('tomorrow');
    expect(request.request.params.keys()).toEqual(['day']);

    request.flush(response({ day: 'tomorrow', label: 'Tomorrow' }));
    await pending;
    httpMock.verify();
  });

  it('passes an unknown show rate through as null, never as zero', async () => {
    const { service, httpMock } = setup();

    const pending = service.day('loc1', 'today');
    httpMock
      .expectOne((candidate) => candidate.url === '/api/ghl/locations/loc1/today')
      .flush(response());

    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.summary.showRatePct).toBeNull();
    expect(result.data?.summary.outcomesUnavailable).toBe(true);
    httpMock.verify();
  });

  it('sends the appointment window with the outcome so timing can be classified', async () => {
    const { service, httpMock } = setup();

    const pending = service.mark('loc1', 'appt1', {
      status: 'noshow',
      startTime: '2026-03-01T15:00:00.000Z',
      endTime: '2026-03-01T15:30:00.000Z',
      contactId: 'c1',
      title: 'Discovery call',
    });
    const request = httpMock.expectOne('/api/ghl/locations/loc1/appointments/appt1/status');

    expect(request.request.method).toBe('PUT');
    // Without the window the server cannot tell a pre-call DQ from an on-call
    // one, and those sit on opposite sides of the show-rate denominator.
    expect(request.request.body).toEqual({
      status: 'noshow',
      startTime: '2026-03-01T15:00:00.000Z',
      endTime: '2026-03-01T15:30:00.000Z',
      contactId: 'c1',
      title: 'Discovery call',
    });

    request.flush({
      appointmentId: 'appt1',
      status: 'noshow',
      timing: 'post-call',
      timingRecorded: true,
    });
    await pending;
    httpMock.verify();
  });

  it('reports a degraded write rather than a clean success', async () => {
    const { service, httpMock } = setup();

    const pending = service.mark('loc1', 'appt1', {
      status: 'showed',
      startTime: '2026-03-01T15:00:00.000Z',
      endTime: '2026-03-01T15:30:00.000Z',
    });
    httpMock
      .expectOne('/api/ghl/locations/loc1/appointments/appt1/status')
      .flush({ appointmentId: 'appt1', status: 'showed', timing: null, timingRecorded: false });

    const result = await pending;

    // GHL has the status. The metric does not. Those are different facts.
    expect(result.error).toBeNull();
    expect(result.data?.timingRecorded).toBe(false);
    httpMock.verify();
  });
});
