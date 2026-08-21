import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OnboardingService } from './onboarding.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: the wire contract that keeps activation from happening by accident.
 *
 * `confirmSpend: true` is a literal in the service, not a parameter. That is
 * what makes "activate as a side effect of a retry, a double-submit, or a
 * create" unexpressible from this client rather than merely discouraged — and
 * the endpoint refuses the call without it regardless.
 *
 * The preview call is here for the opposite reason: it must remain a call that
 * creates nothing, so the budget rules can live in one place server-side
 * instead of being re-expressed as Angular validators that drift.
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
    service: TestBed.inject(OnboardingService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

const INPUT = {
  client: 'Acme Tax',
  offer: 'tax-return-prep',
  budget: '3000',
  cap: '90',
  pixel: 'px-1',
};

describe('OnboardingService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the checklist without a location parameter when none is given', async () => {
    const { service, httpMock } = setup();

    const pending = service.checklist();
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/onboarding/checklist',
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush({ state: 'no-client', stageOrder: [] });
    await pending;
    httpMock.verify();
  });

  it('passes an explicit location id, which the server re-checks against the session', async () => {
    const { service, httpMock } = setup();

    const pending = service.checklist('loc1');
    const request = httpMock.expectOne(
      (candidate) => candidate.url === '/api/onboarding/checklist',
    );

    expect(request.request.params.get('locationId')).toBe('loc1');

    request.flush({ state: 'no-client', stageOrder: [] });
    await pending;
    httpMock.verify();
  });

  it('previews without creating: one POST to the preview path and nothing else', async () => {
    const { service, httpMock } = setup();

    const pending = service.preview(INPUT);
    const request = httpMock.expectOne('/api/onboarding/campaign-launch/preview');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(INPUT);

    request.flush({ campaign: {}, template: {}, activationWarning: 'x' });
    await pending;
    // Nothing was sent to the create or activate paths.
    httpMock.verify();
  });

  it('creates without any confirmSpend field — a create can never be an activation', async () => {
    const { service, httpMock } = setup();

    const pending = service.create(INPUT);
    const request = httpMock.expectOne('/api/onboarding/campaign-launch');
    const body = request.request.body as Record<string, unknown>;

    expect(request.request.method).toBe('POST');
    expect(Object.keys(body)).not.toContain('confirmSpend');

    request.flush({ campaignId: 'camp-1' }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('activates only with confirmSpend: true, on its own endpoint', async () => {
    const { service, httpMock } = setup();

    const pending = service.activate('camp-1', 'loc1');
    const request = httpMock.expectOne('/api/onboarding/campaign-launch/activate');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      campaignId: 'camp-1',
      confirmSpend: true,
      locationId: 'loc1',
    });

    request.flush({ campaignId: 'camp-1', activated: true });
    await pending;
    httpMock.verify();
  });

  it('carries the activation refusal through in the server’s own words', async () => {
    const { service, httpMock } = setup();

    const pending = service.activate('camp-1');
    httpMock.expectOne('/api/onboarding/campaign-launch/activate').flush(
      {
        message: 'Activating starts real ad spend. Re-send with confirmSpend: true to activate.',
        context: 'POST /api/onboarding/campaign-launch/activate',
      },
      { status: 400, statusText: 'Bad Request' },
    );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.message).toContain('real ad spend');
    httpMock.verify();
  });

  it('writes a task toggle with the ids the checklist supplied', async () => {
    const { service, httpMock } = setup();

    const pending = service.setTask({
      locationId: 'loc1',
      opportunityId: 'opp-1',
      taskId: 'task-a',
      complete: true,
    });
    const request = httpMock.expectOne('/api/onboarding/checklist/task');

    expect(request.request.body).toEqual({
      locationId: 'loc1',
      opportunityId: 'opp-1',
      taskId: 'task-a',
      complete: true,
    });

    request.flush({ ok: true, completedTaskIds: ['task-a'] });
    await pending;
    httpMock.verify();
  });

  it('reports a failed template read as a failure, not as an empty offer list', async () => {
    const { service, httpMock } = setup();

    const pending = service.templates();
    httpMock
      .expectOne('/api/onboarding/campaign-templates')
      .flush(null, { status: 500, statusText: 'Server Error' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
    httpMock.verify();
  });
});
