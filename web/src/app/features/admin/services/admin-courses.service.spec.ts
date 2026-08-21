import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminCoursesService } from './admin-courses.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';

/**
 * Story: every write is addressed through the course that owns it.
 *
 * A section, lesson or checklist id is globally unique, so the courseId in the
 * path is redundant right up until it is not: the FLOW routes shipped with a
 * `[cardId]` segment nothing checked, which made the card decoration and let
 * any script be edited through any card's URL. Keeping the parent in the path
 * — and having the endpoint verify it — is what stops the same shape here.
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
    service: TestBed.inject(AdminCoursesService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('AdminCoursesService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('addresses a section through its course', async () => {
    const { service, httpMock } = setup();

    const pending = service.updateSection('course-1', 'sec-1', 'Week one');
    const request = httpMock.expectOne('/api/admin/courses/course-1/sections/sec-1');

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ title: 'Week one' });

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('addresses a lesson through its course', async () => {
    const { service, httpMock } = setup();

    const pending = service.updateSubsection('course-1', 'sub-1', {
      title: 'Set up',
      loomId: 'abc',
      content: 'Body',
    });
    const request = httpMock.expectOne('/api/admin/courses/course-1/subsections/sub-1');

    expect(request.request.body).toEqual({ title: 'Set up', loomId: 'abc', content: 'Body' });

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('addresses a checklist item through its course', async () => {
    const { service, httpMock } = setup();

    const pending = service.deleteCheckbox('course-1', 'cb-1');
    const request = httpMock.expectOne('/api/admin/courses/course-1/checkboxes/cb-1');

    expect(request.request.method).toBe('DELETE');

    request.flush({ ok: true });
    await pending;
    httpMock.verify();
  });

  it('creates a lesson under the section that will hold it', async () => {
    const { service, httpMock } = setup();

    const pending = service.createSubsection('course-1', 'sec-1', 'New lesson');
    const request = httpMock.expectOne(
      '/api/admin/courses/course-1/sections/sec-1/subsections',
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ title: 'New lesson' });

    request.flush({ subsectionId: 'sub-9' }, { status: 201, statusText: 'Created' });
    const result = await pending;

    expect(result.data?.subsectionId).toBe('sub-9');
    httpMock.verify();
  });

  it('encodes ids that would otherwise change the path', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('course/1');
    httpMock.expectOne('/api/admin/courses/course%2F1').flush({ course: {} });

    await pending;
    httpMock.verify();
  });

  it('reports a failed course read as a failure, not as a course with no sections', async () => {
    const { service, httpMock } = setup();

    const pending = service.get('course-1');
    httpMock
      .expectOne('/api/admin/courses/course-1')
      .flush(
        { message: 'Course not found.', context: 'GET /api/admin/courses/course-1' },
        { status: 404, statusText: 'Not Found' },
      );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Course not found.');
    httpMock.verify();
  });
});
