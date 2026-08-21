import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, convertToParamMap } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { ContactsService } from '../services/contacts.service';
import { classifyGhlError, type GhlFailure } from '../services/ghl-error';
import { formatDate } from '../services/ghl-format';
import { injectLocationId } from '../services/location-id';
import type { Attribution, ContactDetailResponse, Note } from '../services/ghl.model';

interface DetailRow {
  readonly label: string;
  readonly value: string;
}

/** The note cap the endpoint enforces, restated so a long note is refused in
 * the textarea rather than after a round trip. */
const MAX_NOTE = 10_000;

/**
 * One contact: who they are, which ad found them, and every note on file.
 *
 * Attribution is NOT normalized here. The endpoint returns `firstTouch` and
 * `lastTouch` already resolved out of the two shapes GHL uses, plus a
 * `metaTrackable` flag per touch, so this screen renders what it was given. The
 * flag is the one worth reading: it says whether a conversion on this contact
 * can be attributed back to Meta at all, which is the difference between a
 * creative that looks unprofitable and one that is.
 *
 * Adding a note replaces the list from the write's own response. The endpoint
 * re-reads after writing precisely so this screen does not have to make a
 * second request to find out what it just did.
 */
@Component({
  selector: 'app-contact-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    PageShell,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './contact-detail.html',
  styleUrl: './contact-detail.scss',
})
export class ContactDetail {
  private readonly contacts = inject(ContactsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly locationId = injectLocationId();
  protected readonly maxNote = MAX_NOTE;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: convertToParamMap({}),
  });

  protected readonly contactId = computed(() => this.params().get('contactId') ?? '');

  protected readonly loading = signal(true);
  protected readonly failure = signal<GhlFailure | null>(null);
  protected readonly detail = signal<ContactDetailResponse | null>(null);

  /** Held apart from `detail` because the write endpoint returns the refreshed
   * list on its own, and re-seeding the whole detail from a notes response
   * would throw away the attribution that came with it. */
  protected readonly notes = signal<readonly Note[]>([]);

  protected readonly noteBody = signal('');
  protected readonly saving = signal(false);
  protected readonly noteError = signal<string | null>(null);

  private request = 0;

  protected readonly title = computed(() => this.detail()?.contact.displayName ?? 'Contact');

  protected readonly detailRows = computed<readonly DetailRow[]>(() => {
    const contact = this.detail()?.contact;
    if (contact === undefined) return [];
    return rows([
      ['Email', contact.email],
      ['Phone', contact.phone],
      ['Source', contact.source],
      ['Added', contact.dateAdded === undefined ? undefined : formatDate(contact.dateAdded)],
    ]);
  });

  protected readonly firstTouchRows = computed(() =>
    attributionRows(this.detail()?.firstTouch ?? null),
  );
  protected readonly lastTouchRows = computed(() =>
    attributionRows(this.detail()?.lastTouch ?? null),
  );

  protected readonly canSubmitNote = computed(
    () => !this.saving() && this.noteBody().trim() !== '',
  );

  constructor() {
    effect(() => {
      const locationId = this.locationId();
      const contactId = this.contactId();
      void this.load(locationId, contactId);
    });
  }

  protected setNoteBody(next: unknown): void {
    this.noteBody.set(next === null || next === undefined ? '' : String(next));
  }

  protected noteDate(note: Note): string {
    return formatDate(note.dateAdded);
  }

  protected reload(): void {
    void this.load(this.locationId(), this.contactId());
  }

  protected async addNote(): Promise<void> {
    if (!this.canSubmitNote()) return;

    const body = this.noteBody().trim();
    if (body.length > MAX_NOTE) {
      this.noteError.set(`A note must be ${MAX_NOTE} characters or fewer.`);
      return;
    }

    this.saving.set(true);
    this.noteError.set(null);

    const result = await this.contacts.addNote(this.locationId(), this.contactId(), body);
    this.saving.set(false);

    if (result.error) {
      // What was typed stays in the box. A rejected note is one edit away, not
      // one retype away.
      this.noteError.set(classifyGhlError(result.error).detail);
      return;
    }

    this.notes.set(result.data.notes);
    this.noteBody.set('');
  }

  private async load(locationId: string, contactId: string): Promise<void> {
    const token = ++this.request;

    if (locationId === '' || contactId === '') {
      this.loading.set(false);
      this.detail.set(null);
      this.notes.set([]);
      this.failure.set({
        kind: 'missing',
        title: 'No contact selected',
        detail: 'Open a contact from the contacts list.',
        retryable: false,
      });
      return;
    }

    this.loading.set(true);
    this.failure.set(null);

    const result = await this.contacts.detail(locationId, contactId);
    if (token !== this.request) return;

    this.loading.set(false);

    if (result.error) {
      this.detail.set(null);
      this.notes.set([]);
      this.failure.set(classifyGhlError(result.error));
      return;
    }

    this.detail.set(result.data);
    this.notes.set(result.data.notes);
  }
}

function rows(pairs: readonly (readonly [string, string | undefined])[]): readonly DetailRow[] {
  return pairs
    .filter((pair): pair is readonly [string, string] => Boolean(pair[1]))
    .map(([label, value]) => ({ label, value }));
}

/**
 * The fields worth showing, in the order an ad buyer reads them. Empty rows are
 * dropped rather than rendered as dashes: an attribution panel of five dashes
 * looks like data, and a panel that is genuinely empty is not rendered at all.
 */
function attributionRows(attribution: Attribution | null): readonly DetailRow[] {
  if (attribution === null) return [];
  return rows([
    ['Source', attribution.utmSource ?? attribution.sessionSource],
    ['Medium', attribution.utmMedium ?? attribution.medium],
    ['Campaign', attribution.utmCampaign ?? attribution.campaign],
    ['Content', attribution.utmContent],
    ['Ad ID', attribution.utmAdId],
  ]);
}
