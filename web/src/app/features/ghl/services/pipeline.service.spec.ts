import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PipelineService } from './pipeline.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import type { PipelineResponse } from './ghl.model';

/**
 * Story: this layer must not invent anything.
 *
 * The board's columns, its staleness rule and its totals are all decided
 * server-side, and the reason is drift: two implementations of "which stage is
 * this deal in" eventually disagree, and the one on the screen is the one
 * people act on. So these tests pin the request shape and the pass-through, and
 * there is deliberately nothing here that transforms a response.
 *
 * The second theme is the ApiResult contract. A failed board must arrive as an
 * error, never as zero boards — an empty kanban reads as "no deals", which is a
 * claim about the business rather than about the network.
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
    service: TestBed.inject(PipelineService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

const board: PipelineResponse = { status: 'open', staleAfterDays: 14, boards: [] };

describe('PipelineService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('asks for one location and sends the status as a query parameter', async () => {
    const { service, httpMock } = setup();

    const pending = service.board('loc1', 'won');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/ghl/locations/loc1/pipeline',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('won');

    request.flush(board);
    await pending;
    httpMock.verify();
  });

  it('encodes the location id rather than pasting it into the path', async () => {
    const { service, httpMock } = setup();

    // The id comes from the URL bar. A stray slash would silently address a
    // different endpoint instead of failing.
    const pending = service.board('loc/1', 'open');
    httpMock
      .expectOne((candidate) => candidate.url === '/api/ghl/locations/loc%2F1/pipeline')
      .flush(board);

    await pending;
    httpMock.verify();
  });

  it('returns a failed board as an error, not as zero pipelines', async () => {
    const { service, httpMock } = setup();

    const pending = service.board('loc1', 'open');
    httpMock
      .expectOne((candidate) => candidate.url === '/api/ghl/locations/loc1/pipeline')
      .flush(
        { message: 'GHL is not configured for this location.', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(503);
    expect(result.error?.message).toBe('GHL is not configured for this location.');
    httpMock.verify();
  });

  it('sends the stage it is leaving so onboarding tasks can close', async () => {
    const { service, httpMock } = setup();

    const pending = service.moveStage('loc1', 'opp1', {
      pipelineStageId: 'stage2',
      previousStageName: 'PR1',
    });
    const request = httpMock.expectOne('/api/ghl/locations/loc1/opportunities/opp1/stage');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      pipelineStageId: 'stage2',
      previousStageName: 'PR1',
    });

    request.flush({
      opportunityId: 'opp1',
      pipelineStageId: 'stage2',
      lastStageChangeAt: '2026-03-01T00:00:00.000Z',
      completedTaskIds: ['pr1-a'],
    });
    await pending;
    httpMock.verify();
  });

  it('closes a deal with its status and value', async () => {
    const { service, httpMock } = setup();

    const pending = service.close('loc1', 'opp1', {
      status: 'won',
      monetaryValue: 4200,
      contactId: 'c1',
    });
    const request = httpMock.expectOne('/api/ghl/locations/loc1/opportunities/opp1/close');

    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      status: 'won',
      monetaryValue: 4200,
      contactId: 'c1',
    });

    request.flush({ opportunityId: 'opp1', status: 'won', monetaryValue: 4200 });
    await pending;
    httpMock.verify();
  });
});
