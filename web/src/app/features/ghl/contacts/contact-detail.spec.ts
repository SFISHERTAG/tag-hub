import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ContactDetail } from './contact-detail';
import { ContactsService } from '../services/contacts.service';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type { ContactDetailResponse, NotesResponse } from '../services/ghl.model';

/**
 * Story: two things this screen is the only place to get right.
 *
 * "Meta trackable" is not decoration. It says whether a conversion on this
 * contact can be attributed back to Meta at all, which is the difference
 * between a creative that looks unprofitable and one that is. It is shown only
 * for the touch the server flagged, never for both because one had identifiers.
 *
 * And a note is written once. The endpoint answers with the refreshed list
 * precisely so this screen does not read back what it just wrote — a second
 * request would render a list without the new note for as long as it took.
 */

const detail = vi.fn<() => Promise<ApiResult<ContactDetailResponse>>>();
const addNote = vi.fn<() => Promise<ApiResult<NotesResponse>>>();
const notes = vi.fn<() => Promise<ApiResult<NotesResponse>>>();

function response(overrides: Partial<ContactDetailResponse> = {}): ContactDetailResponse {
  return {
    contact: {
      id: 'c1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      companyName: 'Analytical Co',
      dateAdded: '2026-02-14T10:00:00.000Z',
      tags: ['warm'],
    },
    notes: [{ id: 'n1', body: 'Spoke Tuesday', dateAdded: '2026-02-15T10:00:00.000Z' }],
    firstTouch: { utmSource: 'facebook', utmAdId: 'ad-1' },
    lastTouch: null,
    metaTrackable: { firstTouch: true, lastTouch: false },
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ContactDetail],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { paramMap: convertToParamMap({ locationId: 'loc1', contactId: 'c1' }) },
          parent: null,
          paramMap: of(convertToParamMap({ locationId: 'loc1', contactId: 'c1' })),
          queryParamMap: of(convertToParamMap({})),
        },
      },
      { provide: ContactsService, useValue: { detail, addNote, notes } },
    ],
  });

  const fixture = TestBed.createComponent(ContactDetail);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function typeNote(host: HTMLElement, value: string): void {
  const textarea = host.querySelector<HTMLTextAreaElement>('.contact__note-field textarea');
  if (textarea === null) throw new Error('No note field rendered');
  textarea.value = value;
  textarea.dispatchEvent(new Event('input'));
}

function submitNote(host: HTMLElement): void {
  host.querySelector<HTMLFormElement>('.contact__note-form')?.dispatchEvent(new Event('submit'));
}

beforeEach(() => {
  vi.clearAllMocks();
  detail.mockResolvedValue(ok(response()));
  addNote.mockResolvedValue(
    ok({
      notes: [
        { id: 'n2', body: 'Left a voicemail' },
        { id: 'n1', body: 'Spoke Tuesday' },
      ],
    }),
  );
});

describe('ContactDetail', () => {
  it('loads the contact named in the route', async () => {
    await setup();

    expect(detail).toHaveBeenCalledWith('loc1', 'c1');
  });

  it('renders the contact and its notes', async () => {
    const { host } = await setup();

    expect(host.textContent).toContain('Ada Lovelace');
    expect(host.textContent).toContain('ada@example.com');
    expect(host.textContent).toContain('Spoke Tuesday');
    expect(host.textContent).toContain('Notes (1)');
  });

  it('badges only the touch the server flagged as Meta trackable', async () => {
    const { host } = await setup();

    const badges = host.querySelectorAll('.contact__badge');
    expect(badges).toHaveLength(1);
  });

  it('renders no attribution panel when there is no attribution', async () => {
    detail.mockResolvedValue(
      ok(
        response({
          firstTouch: null,
          lastTouch: null,
          metaTrackable: { firstTouch: false, lastTouch: false },
        }),
      ),
    );

    const { host } = await setup();

    // Five dashes look like data. An empty panel is worse than no panel.
    expect(host.textContent).not.toContain('First touch');
    expect(host.textContent).not.toContain('Last touch');
  });

  it('adds a note and takes the refreshed list from the write itself', async () => {
    const { fixture, host } = await setup();

    typeNote(host, 'Left a voicemail');
    fixture.detectChanges();
    submitNote(host);
    await settle();
    fixture.detectChanges();

    expect(addNote).toHaveBeenCalledWith('loc1', 'c1', 'Left a voicemail');
    // No read-back: the write already answered with the truth it created.
    expect(notes).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Left a voicemail');
    expect(host.textContent).toContain('Notes (2)');
  });

  it('will not post an empty note', async () => {
    const { fixture, host } = await setup();

    typeNote(host, '   ');
    fixture.detectChanges();
    submitNote(host);
    await settle();

    expect(addNote).not.toHaveBeenCalled();
  });

  it('keeps what was typed when the note is refused', async () => {
    addNote.mockResolvedValue({
      data: null,
      error: { message: 'GHL rejected the request.', context: 'POST', status: 502 },
    });

    const { fixture, host } = await setup();

    typeNote(host, 'Left a voicemail');
    fixture.detectChanges();
    submitNote(host);
    await settle();
    fixture.detectChanges();

    const textarea = host.querySelector<HTMLTextAreaElement>('.contact__note-field textarea');
    // A rejected note is one edit away, not one retype away.
    expect(textarea?.value).toBe('Left a voicemail');
    expect(host.querySelector('.contact__error')?.textContent).toContain(
      'GHL rejected the request.',
    );
  });

  it('shows a missing contact as missing, not as a blank page', async () => {
    detail.mockResolvedValue({
      data: null,
      error: { message: 'Contact not found.', context: 'GET', status: 404 },
    });

    const { host } = await setup();

    expect(host.textContent).toContain('Not found');
    expect(host.textContent).toContain('Contact not found.');
    expect(host.querySelector('.contact__note-form')).toBeNull();
  });
});
