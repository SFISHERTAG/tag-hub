import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BugReportsService } from './bug-reports.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import {
  bugReportFiledLabel,
  bugReportFiledSortValue,
  bugReportStatusLabel,
} from './bug-report.model';

/**
 * Story: the request must not carry an identity, and a rejection must arrive
 * with the server's own words.
 *
 * The first is the security property. Ownership comes from the session on both
 * verbs, so there is no `userId` in either direction; a body that grew one
 * would make "file this under someone else" expressible, which is the whole
 * class of bug the audit kept finding.
 *
 * The second is what makes the form usable. "Give it a short title." tells the
 * reporter what to change; "Request failed" does not.
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
    service: TestBed.inject(BugReportsService),
    httpMock: TestBed.inject(HttpTestingController),
  };
}

describe('BugReportsService', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the caller list with no parameters', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    const request = httpMock.expectOne('/api/bug-reports');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush({ reports: [], pageAreas: ['Pipeline', 'Other'] });
    const result = await pending;

    expect(result.error).toBeNull();
    expect(result.data?.reports).toEqual([]);
    expect(result.data?.pageAreas).toEqual(['Pipeline', 'Other']);
    httpMock.verify();
  });

  it('posts only what the reporter typed, and nothing that names them', async () => {
    const { service, httpMock } = setup();

    const pending = service.submit({
      title: '  Pipeline drag fails  ',
      description: '  Card snaps back  ',
      stepsToReproduce: '  1. Drag it  ',
      pageArea: 'Pipeline',
    });
    const request = httpMock.expectOne('/api/bug-reports');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'Pipeline drag fails',
      description: 'Card snaps back',
      stepsToReproduce: '1. Drag it',
      pageArea: 'Pipeline',
    });
    // The identity fields are the server's to write, from the session.
    expect(Object.keys(request.request.body as object)).not.toContain('userId');
    expect(Object.keys(request.request.body as object)).not.toContain('userEmail');

    request.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('omits the optional fields when they are blank', async () => {
    const { service, httpMock } = setup();

    const pending = service.submit({
      title: 'Something broke',
      description: 'It went red',
      stepsToReproduce: '   ',
      pageArea: '',
    });
    const request = httpMock.expectOne('/api/bug-reports');

    expect(request.request.body).toEqual({ title: 'Something broke', description: 'It went red' });

    request.flush({ ok: true }, { status: 201, statusText: 'Created' });
    await pending;
    httpMock.verify();
  });

  it('carries a rejection through in the server wording', async () => {
    const { service, httpMock } = setup();

    const pending = service.submit({ title: '', description: 'x' });
    httpMock
      .expectOne('/api/bug-reports')
      .flush(
        { message: 'Give it a short title.', context: 'POST /api/bug-reports', status: 400 },
        { status: 400, statusText: 'Bad Request' },
      );

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe('Give it a short title.');
    httpMock.verify();
  });

  it('reports a failed list read as a failure, not as an empty history', async () => {
    const { service, httpMock } = setup();

    const pending = service.list();
    httpMock.expectOne('/api/bug-reports').flush(null, { status: 500, statusText: 'Server Error' });

    const result = await pending;

    expect(result.data).toBeNull();
    expect(result.error?.status).toBe(500);
    httpMock.verify();
  });
});

describe('bug report labels', () => {
  it('names every status', () => {
    expect(bugReportStatusLabel('submitted')).toBe('Submitted');
    expect(bugReportStatusLabel('in_review')).toBe('In review');
    expect(bugReportStatusLabel('resolved')).toBe('Resolved');
    expect(bugReportStatusLabel('closed')).toBe('Closed');
  });

  it('says a report is new rather than printing 1970 for an unresolved timestamp', () => {
    expect(bugReportFiledLabel(0)).toBe('Just submitted');
    expect(bugReportFiledLabel(Date.UTC(2026, 1, 3, 12))).not.toContain('1970');
  });

  it('sorts an unresolved timestamp as the newest row, which is what it is', () => {
    expect(bugReportFiledSortValue(0)).toBeGreaterThan(bugReportFiledSortValue(Date.now()));
  });
});
