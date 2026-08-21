import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ErrorState, LoadingState } from '../../../shared/ui';
import { ContactsService } from '../services/contacts.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import {
  attributionLine,
  firstTouchOf,
  formatDate,
  formatMoney,
  lastTouchOf,
} from '../services/ghl-format';
import type { Note, PrepResponse } from '../services/ghl.model';

export interface PrepDialogData {
  readonly locationId: string;
  readonly contactId: string;
  readonly contactLabel: string;
}

/**
 * Call prep for one appointment: where the lead came from, what the deal looks
 * like, and what was said last time.
 *
 * Fetched when this OPENS and never before (Story 2.7 AC4). The legacy version
 * made the same promise for the same reason: prep costs three GHL calls, and
 * doing it per row would spend three dozen of them before the day view showed
 * anything at all.
 *
 * The newest note is expanded and the rest collapse behind a count, because the
 * only note anyone reads standing up is the last one.
 */
@Component({
  selector: 'app-prep-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, ErrorState, LoadingState],
  templateUrl: './prep-dialog.html',
  styleUrl: './prep-dialog.scss',
})
export class PrepDialog {
  private readonly contacts = inject(ContactsService);
  protected readonly data = inject<PrepDialogData>(MAT_DIALOG_DATA);

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly prep = signal<PrepResponse | null>(null);
  protected readonly expanded = signal(false);

  protected readonly firstTouchLabel = computed(() => {
    const contact = this.prep()?.contact;
    return contact === undefined ? null : attributionLine(firstTouchOf(contact));
  });

  protected readonly lastTouchLabel = computed(() => {
    const contact = this.prep()?.contact;
    return contact === undefined ? null : attributionLine(lastTouchOf(contact));
  });

  protected readonly notes = computed<readonly Note[]>(() => this.prep()?.notes ?? []);
  protected readonly latestNote = computed<Note | null>(() => this.notes()[0] ?? null);
  protected readonly olderNotes = computed<readonly Note[]>(() => this.notes().slice(1));

  constructor() {
    void this.load();
  }

  protected toggleNotes(): void {
    this.expanded.update((value) => !value);
  }

  protected noteDate(note: Note): string {
    return formatDate(note.dateAdded);
  }

  protected money(value: number): string {
    return formatMoney(value);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failure.set(null);

    const result = await this.contacts.prep(this.data.locationId, this.data.contactId);
    this.loading.set(false);

    if (result.error) {
      this.prep.set(null);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.prep.set(result.data);
  }
}
