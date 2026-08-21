import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CoursesService } from './courses.service';
import { progressKey } from './course.model';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: progress is the caller's own, and a failed save is unmistakably a
 * failure.
 *
 * There is no uid on the wire in either direction. "Read someone else's
 * completion record" is not a request this client can express, which is a
 * stronger guarantee than a check that could be forgotten.
 *
 * The failure shape matters because the screen rolls back on it. A 200 carrying
 * nothing would leave the client unable to tell a refused write from a
 * successful one, and the rollback — the whole point of the carried-forward fix
 * — would never run.
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
    service: TestBed.inject(CoursesService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('CoursesService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists courses with no parameters at all', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    const request = httpMock.expectOne('/api/courses');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush({ courses: [] });
    await pending;
    httpMock.verify();
  });

  it('reads one course and its progress in a single round trip', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('onboarding');
    const request = httpMock.expectOne('/api/courses/onboarding');

    expect(request.request.method).toBe('GET');

    request.flush({
      course: { id: 'c1', title: 'Onboarding', description: '', sections: [] },
      progress: { 'sec1/sub1/cb1': { completed: true, completedAt: 1 } },
    });
    const result = await pending;

    expect(result.data?.progress['sec1/sub1/cb1'].completed).toBe(true);
    httpMock.verify();
  });

  it('sends no uid when writing progress — the session is the only author', async () => {
    const { service, httpMock } = setup();

    const pending = service.setProgress({
      courseId: 'c1',
      sectionId: 'sec1',
      subsectionId: 'sub1',
      checkboxId: 'cb1',
      completed: true,
    });
    const request = httpMock.expectOne('/api/courses/progress');
    const keys = Object.keys(request.request.body as object);

    expect(request.request.method).toBe('POST');
    expect(keys).not.toContain('uid');
    expect(keys).not.toContain('userId');

    request.flush({ ok: true, key: 'sec1/sub1/cb1', completed: true, completedAt: 2 });
    await pending;
    httpMock.verify();
  });

  it('returns a 401 as a typed failure, which is what lets the interceptor refresh', async () => {
    const { service, httpMock } = setup();

    const pending = service.setProgress({
      courseId: 'c1',
      sectionId: 'sec1',
      subsectionId: 'sub1',
      checkboxId: 'cb1',
      completed: true,
    });
    httpMock.expectOne('/api/courses/progress').flush(
      { message: 'Not signed in.', context: 'POST /api/courses/progress' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const result = await pending;

    // The endpoint used to answer an expired session with a 500, because
    // requireSession() redirects and the catch-all swallowed it. A 500 gave the
    // authInterceptor's refresh-on-401 nothing to fire on.
    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(401);
    httpMock.verify();
  });

  it('encodes a course id that would otherwise change the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('a/b');
    httpMock.expectOne('/api/courses/a%2Fb').flush({ course: {}, progress: {} });

    await pending;
    httpMock.verify();
  });
});

describe('progressKey', () => {
  it('is the one key format both sides of the wire use', () => {
    expect(progressKey('sec1', 'sub1', 'cb1')).toBe('sec1/sub1/cb1');
  });
});
