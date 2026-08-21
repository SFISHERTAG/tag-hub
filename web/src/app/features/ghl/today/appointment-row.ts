import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TodayService } from '../services/today.service';
import { classifyGhlError } from '../services/ghl-error';
import { formatTime } from '../services/ghl-format';
import type { AppointmentStatus, TodayAppointment } from '../services/ghl.model';
import { PrepDialog, type PrepDialogData } from './prep-dialog';

interface Outcome {
  readonly value: AppointmentStatus;
  readonly label: string;
}

/**
 * GHL offers six appointment statuses and no "disqualified", so DQ maps onto
 * `invalid` — the slot meant for appointments that should not count.
 *
 * Keeping DQ distinct from no-show is the point. A no-show points at the
 * reminder sequence; a DQ points at targeting. Collapsing them hides which one
 * is actually broken, which is why they are separate buttons rather than one
 * "didn't happen".
 *
 * `new` is absent deliberately: it is the state an appointment arrives in, not
 * an outcome anyone chooses.
 */
const OUTCOMES: readonly Outcome[] = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'showed', label: 'Showed' },
  { value: 'noshow', label: 'No-show' },
  { value: 'invalid', label: 'DQ' },
  { value: 'cancelled', label: 'Cancelled' },
];

/**
 * One appointment, and the outcome the closer marks on it.
 *
 * Optimistic with rollback, as the legacy row was: the button lights up
 * immediately and goes back if the write fails, because a control that keeps
 * showing an outcome the server rejected is a control that lies about the day.
 *
 * The outcome buttons are plain buttons whose appearance is a pure function of
 * the status signal, NOT a mat-button-toggle-group. A toggle group holds its own
 * selection: the user's click sets it directly, so when the optimistic write and
 * its rejection land inside one change-detection tick — which is what a fast
 * 403 does — Angular sees the bound value go from 'confirmed' back to
 * 'confirmed', writes nothing, and the group stays lit on the outcome the server
 * just refused. Deriving every button from the signal removes the second copy of
 * the state, so a rollback cannot fail to repaint.
 *
 * The row also reports a DEGRADED success. GHL is the system of record for the
 * status, but a second write records when the mark happened relative to the
 * call, which is what separates a pre-call DQ from an on-call one. When that
 * second write fails the status still saved, so this is not an error — but the
 * appointment now counts differently toward show rate, and the row says so
 * rather than presenting a clean tick.
 */
@Component({
  selector: 'app-appointment-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  templateUrl: './appointment-row.html',
  styleUrl: './appointment-row.scss',
})
export class AppointmentRow {
  private readonly today = inject(TodayService);
  private readonly dialog = inject(MatDialog);

  readonly locationId = input.required<string>();
  readonly appointment = input.required<TodayAppointment>();

  /** An outcome landed. The day view refetches so the summary is not stale. */
  readonly marked = output<void>();

  protected readonly outcomes = OUTCOMES;

  /** Re-seeded from the input, so a refetch wins over the optimistic value. */
  protected readonly status = linkedSignal(() => this.appointment().status);
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly timingDegraded = signal(false);

  protected readonly time = computed(() => formatTime(this.appointment().startTime));
  protected readonly title = computed(() => this.appointment().title || 'Untitled');
  protected readonly cancelled = computed(() => this.status() === 'cancelled');

  protected choose(next: AppointmentStatus): void {
    void this.mark(next);
  }

  protected isChosen(status: AppointmentStatus): boolean {
    return this.status() === status;
  }

  protected openPrep(): void {
    const contactId = this.appointment().contactId;
    if (contactId === undefined) return;

    const data: PrepDialogData = {
      locationId: this.locationId(),
      contactId,
      contactLabel: this.title(),
    };
    this.dialog.open<PrepDialog, PrepDialogData>(PrepDialog, {
      data,
      width: '32rem',
      maxWidth: '92vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  private async mark(next: AppointmentStatus): Promise<void> {
    const previous = this.status();
    if (next === previous || this.pending()) return;

    this.status.set(next);
    this.error.set(null);
    this.timingDegraded.set(false);
    this.pending.set(true);

    const appointment = this.appointment();
    const result = await this.today.mark(this.locationId(), appointment.id, {
      status: next,
      // The window the mark is judged against. Sent from the row rather than
      // re-read server-side so the classification matches the appointment the
      // closer was actually looking at.
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      ...(appointment.contactId === undefined ? {} : { contactId: appointment.contactId }),
      ...(appointment.title === undefined ? {} : { title: appointment.title }),
    });

    this.pending.set(false);

    if (result.error) {
      this.status.set(previous);
      this.error.set(classifyGhlError(result.error).detail);
      return;
    }

    this.timingDegraded.set(!result.data.timingRecorded);
    this.marked.emit();
  }
}
