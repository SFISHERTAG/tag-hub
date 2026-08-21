import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { DataTable, PageShell, type DataTableColumn } from '../../../shared/ui';
import { BugReportForm } from '../bug-report-form/bug-report-form';
import { BugReportsService } from '../services/bug-reports.service';
import {
  bugReportFiledLabel,
  bugReportFiledSortValue,
  bugReportStatusLabel,
  type BugReport,
} from '../services/bug-report.model';

/**
 * Report a bug: the form, then everything this person has already filed.
 *
 * One request feeds both halves. The list endpoint also serves the page-area
 * options, so the dropdown and the values the server will accept come from the
 * same response and cannot drift.
 *
 * The list is a shared DataTable rather than a hand-rolled one because the four
 * states are inside it: loading, failed, empty and rows, in that order of
 * precedence. That precedence is the point — a failed read must never render as
 * "you have not reported anything", which is the same class of lie as an outage
 * rendering as a zero.
 */
@Component({
  selector: 'app-bug-reports-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, PageShell, DataTable, BugReportForm],
  templateUrl: './bug-reports-page.html',
  styleUrl: './bug-reports-page.scss',
})
export class BugReportsPage {
  private readonly reports = inject(BugReportsService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filed = signal<readonly BugReport[]>([]);
  protected readonly pageAreas = signal<readonly string[]>([]);

  /**
   * Columns are functions of the row, so a field rename here is a compile error
   * rather than a blank column in production.
   */
  protected readonly columns: readonly DataTableColumn<BugReport>[] = [
    { key: 'title', header: 'Report', cell: (report) => report.title, sortable: true },
    {
      key: 'pageArea',
      header: 'Where',
      cell: (report) => report.pageArea ?? 'Not specified',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (report) => bugReportStatusLabel(report.status),
      sortable: true,
    },
    {
      key: 'createdAt',
      header: 'Filed',
      cell: (report) => bugReportFiledLabel(report.createdAt),
      // Sorts on the timestamp, not on the words: "Just submitted" and "3 Feb"
      // do not compare, and a just-filed report is the newest row, not the
      // oldest one its unresolved 0 would otherwise make it.
      sortValue: (report) => bugReportFiledSortValue(report.createdAt),
      sortable: true,
      align: 'end',
    },
  ];

  protected readonly rowKey = (report: BugReport): string => report.id;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.reports.list();

    if (result.error) {
      // Rows cleared with the failure, so nothing stale renders as current.
      // The page areas are kept: they are the form's options, and the form is
      // still usable when the list read fails.
      this.filed.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.filed.set(result.data.reports);
    this.pageAreas.set(result.data.pageAreas);
    this.loading.set(false);
  }

  /** A report landed, so the list is now out of date by exactly one row. */
  protected onSubmitted(): void {
    void this.load();
  }
}
