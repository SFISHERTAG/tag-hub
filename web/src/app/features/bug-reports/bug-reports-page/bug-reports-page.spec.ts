import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { BugReportsPage } from './bug-reports-page';
import { BugReportForm } from '../bug-report-form/bug-report-form';
import { BugReportsService } from '../services/bug-reports.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { BugReport, BugReportList } from '../services/bug-report.model';

/**
 * Story: the list and the form come from one response, and a failed read never
 * poses as an empty history.
 *
 * "You have not reported anything yet" is a claim about the user. Rendering it
 * when the request actually failed is the same lie as showing $0 for a revoked
 * token, so the shared DataTable's precedence (error before empty) is asserted
 * here from the outside, where it is a user-visible behaviour rather than an
 * implementation detail.
 *
 * The refetch matters for a smaller reason: the POST returns `{ ok: true }` and
 * not the new list, deliberately, so the screen is the only thing that can put
 * the new row on the page.
 */

const list = vi.fn<() => Promise<ApiResult<BugReportList>>>();
const submit = vi.fn();

function report(overrides: Partial<BugReport> = {}): BugReport {
  return {
    id: 'r1',
    title: 'Pipeline drag fails',
    description: 'The card snaps back.',
    stepsToReproduce: null,
    pageArea: 'Pipeline',
    status: 'submitted',
    createdAt: Date.UTC(2026, 1, 3, 12),
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BugReportsPage],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: BugReportsService, useValue: { list, submit } },
    ],
  });

  const fixture = TestBed.createComponent(BugReportsPage);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  list.mockResolvedValue(ok({ reports: [report()], pageAreas: ['Pipeline', 'Other'] }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BugReportsPage', () => {
  it('shows the form and the reports already filed', async () => {
    const { host } = await setup();

    expect(host.querySelector('app-bug-report-form')).not.toBeNull();
    expect(host.textContent).toContain('Pipeline drag fails');
    expect(host.textContent).toContain('Submitted');
  });

  it('hands the served page areas to the form so the options cannot drift', async () => {
    const { fixture } = await setup();

    const form = fixture.debugElement.query(By.directive(BugReportForm))
      .componentInstance as BugReportForm;

    expect(form.pageAreas()).toEqual(['Pipeline', 'Other']);
  });

  it('shows the failure rather than an empty history when the read fails', async () => {
    list.mockResolvedValue({
      data: null,
      error: { message: 'Sign in to continue.', context: 'GET /api/bug-reports', status: 401 },
    });
    const { host } = await setup();

    expect(host.textContent).toContain('Sign in to continue.');
    expect(host.textContent).not.toContain('You have not reported anything yet.');
  });

  it('says the history is empty only when it really is', async () => {
    list.mockResolvedValue(ok({ reports: [], pageAreas: ['Other'] }));
    const { host } = await setup();

    expect(host.textContent).toContain('You have not reported anything yet.');
  });

  it('refetches when a report lands, because the write does not return the list', async () => {
    const { fixture, host } = await setup();
    expect(list).toHaveBeenCalledTimes(1);

    list.mockResolvedValue(
      ok({
        reports: [report({ id: 'r2', title: 'Second one', createdAt: 0 }), report()],
        pageAreas: ['Pipeline', 'Other'],
      }),
    );

    const form = fixture.debugElement.query(By.directive(BugReportForm))
      .componentInstance as BugReportForm;
    form.submitted.emit();
    await settle();
    fixture.detectChanges();

    expect(list).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Second one');
    // A row whose server timestamp has not resolved reads as new, not as 1970.
    expect(host.textContent).toContain('Just submitted');
  });

  it('names a report with no page area rather than leaving the cell blank', async () => {
    list.mockResolvedValue(ok({ reports: [report({ pageArea: null })], pageAreas: [] }));
    const { host } = await setup();

    expect(host.textContent).toContain('Not specified');
  });
});
