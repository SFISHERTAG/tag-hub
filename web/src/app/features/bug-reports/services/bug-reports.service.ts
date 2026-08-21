import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { BugReportList, BugReportSubmitted, NewBugReport } from './bug-report.model';

const BUG_REPORTS_URL = '/api/bug-reports';

/**
 * Typed access to the bug report endpoint. The screen talks to this; nothing in
 * the feature touches HttpClient, per CLAUDE.md.
 *
 * `submit` sends only the four fields the user typed. The reporter's identity
 * is taken from the session server-side and there is no field here to carry it,
 * which is what makes filing under another user's name unexpressible rather
 * than merely discouraged.
 */
@Injectable({ providedIn: 'root' })
export class BugReportsService {
  private readonly api = inject(ApiService);

  /** The caller's own reports. The query filters on the session, not on a parameter. */
  list(): Promise<ApiResult<BugReportList>> {
    return firstValueFrom(this.api.get<BugReportList>(BUG_REPORTS_URL));
  }

  /**
   * Resolves with `{ data: null, error }` carrying the server's own wording on
   * a rejection ("Give it a short title.", "Unknown page area."), so the form
   * shows the reason rather than a generic failure.
   */
  submit(report: NewBugReport): Promise<ApiResult<BugReportSubmitted>> {
    return firstValueFrom(this.api.post<BugReportSubmitted>(BUG_REPORTS_URL, toBody(report)));
  }
}

/**
 * Empty optional fields are dropped rather than sent as "". The server treats
 * both the same, but a body that carries only what was actually filled in is
 * the one that reads correctly in a log.
 */
function toBody(report: NewBugReport): Record<string, string> {
  const body: Record<string, string> = {
    title: report.title.trim(),
    description: report.description.trim(),
  };

  const steps = report.stepsToReproduce?.trim();
  if (steps) body['stepsToReproduce'] = steps;

  const pageArea = report.pageArea?.trim();
  if (pageArea) body['pageArea'] = pageArea;

  return body;
}
