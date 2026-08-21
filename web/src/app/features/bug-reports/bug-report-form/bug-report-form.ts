import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BugReportsService } from '../services/bug-reports.service';
import { BUG_REPORT_LIMITS } from '../services/bug-report.model';

/**
 * "Tell us what happened" — title, where, what happened, and optional steps.
 *
 * The form owns the submission rather than handing a payload upwards, which is
 * what keeps pending, failure and success in one place instead of spread across
 * a parent's inputs. It tells the parent only that a report landed, and the
 * parent refetches; the endpoint deliberately does not return the new list,
 * because a second read inside the write's response could answer 500 for a
 * report that was actually saved and invite the user to file it twice.
 *
 * Client-side validation here is a courtesy, never a gate. The endpoint
 * re-checks required fields, lengths and the page area against its own list, so
 * everything below is about not making someone wait for a rejection they could
 * have seen coming.
 */
@Component({
  selector: 'app-bug-report-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './bug-report-form.html',
  styleUrl: './bug-report-form.scss',
})
export class BugReportForm {
  private readonly reports = inject(BugReportsService);

  /**
   * The allowed "where" values, served by the list endpoint. Empty is a legible
   * state rather than a broken one: the field then offers only "Not sure", and
   * a report with no page area is perfectly valid.
   */
  readonly pageAreas = input<readonly string[]>([]);

  /** A report landed. The parent refetches its list. */
  readonly submitted = output<void>();

  protected readonly title = signal('');
  protected readonly pageArea = signal('');
  protected readonly description = signal('');
  protected readonly steps = signal('');

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal(false);

  protected readonly limits = BUG_REPORT_LIMITS;

  protected readonly canSubmit = computed(
    () => !this.pending() && this.title().trim() !== '' && this.description().trim() !== '',
  );

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.pending.set(true);
    this.error.set(null);
    this.sent.set(false);

    const result = await this.reports.submit({
      title: this.title(),
      description: this.description(),
      stepsToReproduce: this.steps(),
      pageArea: this.pageArea(),
    });

    this.pending.set(false);

    if (result.error) {
      // The server's own sentence, not a generic one: "Give it a short title."
      // tells the reporter what to change.
      this.error.set(result.error.message);
      return;
    }

    // Cleared only on success. A failed submission keeps what was typed, so a
    // rejected report is one edit away rather than one retype away.
    this.clear();
    this.sent.set(true);
    this.submitted.emit();
  }

  private clear(): void {
    this.title.set('');
    this.pageArea.set('');
    this.description.set('');
    this.steps.set('');
  }
}
