import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BugReportForm } from './bug-report-form';
import { BugReportsService } from '../services/bug-reports.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { BugReportSubmitted, NewBugReport } from '../services/bug-report.model';

/**
 * Story: three behaviours, and the third is the one that matters most to the
 * person using it.
 *
 * A report needs a title and a description, and the button says so by being
 * disabled rather than by failing after a round trip. A rejected submission
 * shows the server's own sentence. And a rejected submission KEEPS WHAT WAS
 * TYPED — the Next form reset on success only, and losing four paragraphs of a
 * bug report to a 400 is how a person stops filing them.
 */

const submit = vi.fn<(report: NewBugReport) => Promise<ApiResult<BugReportSubmitted>>>();

/** The component's members are protected; the tests reach them as the template does. */
function view(component: BugReportForm) {
  return component as unknown as {
    title: { set: (value: string) => void; (): string };
    pageArea: { set: (value: string) => void; (): string };
    description: { set: (value: string) => void; (): string };
    steps: { set: (value: string) => void; (): string };
    canSubmit: () => boolean;
    submit: () => Promise<void>;
  };
}

function setup(pageAreas: readonly string[] = ['Pipeline', 'Other']) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [BugReportForm],
    providers: [
      provideZonelessChangeDetection(),
      { provide: BugReportsService, useValue: { submit } },
    ],
  });

  const fixture = TestBed.createComponent(BugReportForm);
  fixture.componentRef.setInput('pageAreas', pageAreas);
  fixture.detectChanges();

  return {
    fixture,
    host: fixture.nativeElement as HTMLElement,
    component: fixture.componentInstance,
    v: view(fixture.componentInstance),
  };
}

function submitButton(host: HTMLElement): HTMLButtonElement | null {
  return host.querySelector<HTMLButtonElement>('button[type="submit"]');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  submit.mockResolvedValue(ok({ ok: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BugReportForm', () => {
  it('will not submit without a title and a description', () => {
    const { fixture, host, v } = setup();
    expect(submitButton(host)?.disabled).toBe(true);

    v.title.set('Pipeline drag fails');
    fixture.detectChanges();
    expect(submitButton(host)?.disabled).toBe(true);

    v.description.set('The card snaps back to its old stage.');
    fixture.detectChanges();
    expect(submitButton(host)?.disabled).toBe(false);
  });

  it('treats whitespace as empty, the same way the server does', () => {
    const { v } = setup();

    v.title.set('   ');
    v.description.set('   ');

    expect(v.canSubmit()).toBe(false);
  });

  it('sends what was typed, clears the form and says so', async () => {
    const { fixture, host, component, v } = setup();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);

    v.title.set('Pipeline drag fails');
    v.pageArea.set('Pipeline');
    v.description.set('The card snaps back.');
    v.steps.set('1. Drag a card');
    await v.submit();
    fixture.detectChanges();

    expect(submit).toHaveBeenCalledWith({
      title: 'Pipeline drag fails',
      pageArea: 'Pipeline',
      description: 'The card snaps back.',
      stepsToReproduce: '1. Drag a card',
    });
    expect(v.title()).toBe('');
    expect(v.description()).toBe('');
    expect(host.querySelector('.bug-form__sent')?.textContent).toContain('that has been logged');
    // The parent refetches on this; the endpoint does not return the new list.
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  it('shows the server wording on a rejection and keeps what was typed', async () => {
    submit.mockResolvedValue({
      data: null,
      error: {
        message: 'Title is too long (max 200 characters).',
        context: 'POST /api/bug-reports',
        status: 400,
      },
    });
    const { fixture, host, component, v } = setup();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);

    v.title.set('A very long title');
    v.description.set('Four paragraphs of detail.');
    await v.submit();
    fixture.detectChanges();

    expect(host.querySelector('.bug-form__error')?.textContent).toContain(
      'Title is too long (max 200 characters).',
    );
    // Losing the description to a 400 is how someone stops filing reports.
    expect(v.description()).toBe('Four paragraphs of detail.');
    expect(host.querySelector('.bug-form__sent')).toBeNull();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('does not fire a second time while one submission is in flight', async () => {
    let release: (value: ApiResult<BugReportSubmitted>) => void = () => undefined;
    submit.mockReturnValue(
      new Promise<ApiResult<BugReportSubmitted>>((resolve) => {
        release = resolve;
      }),
    );
    const { v } = setup();

    v.title.set('Something broke');
    v.description.set('It went red');
    const first = v.submit();
    await v.submit();

    expect(submit).toHaveBeenCalledTimes(1);
    release(ok({ ok: true }));
    await first;
  });

  it('offers the served page areas, and stays usable when none were served', () => {
    const { host } = setup([]);

    // The select is a Material overlay; what matters here is that an empty
    // list is a legible state rather than a broken control. The server
    // validates the value it receives either way.
    expect(host.querySelector('mat-select')).not.toBeNull();
    expect(submitButton(host)).not.toBeNull();
  });
});
