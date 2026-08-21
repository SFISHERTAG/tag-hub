import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FollowUpPanel } from './follow-up-panel';
import { FollowUpService } from '../services/follow-up.service';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type {
  FollowUpConfigResponse,
  FollowUpEntry,
  FollowUpResponse,
} from '../services/ghl.model';

/**
 * Story: one panel, two screens, and three things it must never do.
 *
 * It must not decide membership. `resolveFollowUpQueue` does that server-side,
 * and it is the code that refuses to treat a CANCELLED appointment as a
 * rebooking. The today panel and this screen used to compute it separately and
 * disagreed about the same contact; the forgiving one deleted exactly the lead
 * the queue exists to surface.
 *
 * It must not render an unreachable queue as an empty one. "Nothing waiting on
 * a follow-up" means the closer is done for the day.
 *
 * And it must not hide a threshold fallback. The threshold decides who ages
 * out, so a queue built on a default nobody chose is a different queue.
 */

const queue = vi.fn<() => Promise<ApiResult<FollowUpResponse>>>();
const saveConfig = vi.fn<() => Promise<ApiResult<FollowUpConfigResponse>>>();

function entry(overrides: Partial<FollowUpEntry> = {}): FollowUpEntry {
  return {
    appointmentId: 'appt1',
    contactId: 'c1',
    contactName: 'Ada Lovelace',
    appointmentTitle: 'Discovery call',
    markedAt: Date.now() - 2 * 86_400_000,
    status: 'noshow',
    timing: 'post-call',
    attempts: 2,
    appointment: null,
    contact: null,
    opportunity: null,
    ...overrides,
  };
}

function response(overrides: Partial<FollowUpResponse> = {}): FollowUpResponse {
  return {
    config: { mode: 'days', value: 7 },
    canConfigure: false,
    lookaheadDays: 30,
    lookbackDays: 90,
    total: 1,
    truncated: false,
    enriched: false,
    configFallback: false,
    candidates: [entry()],
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(enrich = false) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [FollowUpPanel],
    providers: [
      provideZonelessChangeDetection(),
      { provide: FollowUpService, useValue: { queue, saveConfig } },
    ],
  });

  const fixture = TestBed.createComponent(FollowUpPanel);
  fixture.componentRef.setInput('locationId', 'loc1');
  fixture.componentRef.setInput('enrich', enrich);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, host: fixture.nativeElement as HTMLElement };
}

function submitConfig(host: HTMLElement): void {
  const form = host.querySelector<HTMLFormElement>('.follow-up__config');
  form?.dispatchEvent(new Event('submit'));
}

function typeThreshold(host: HTMLElement, value: string): void {
  const input = host.querySelector<HTMLInputElement>('.follow-up__number input');
  if (input === null) throw new Error('No threshold input rendered');
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

beforeEach(() => {
  vi.clearAllMocks();
  queue.mockResolvedValue(ok(response()));
  saveConfig.mockResolvedValue(ok({ config: { mode: 'days', value: 14 }, canConfigure: true }));
});

describe('FollowUpPanel', () => {
  it('asks for the cheap queue on the day view', async () => {
    await setup(false);

    expect(queue).toHaveBeenCalledWith('loc1', { enrich: false });
  });

  it('asks for the enriched queue on its own screen', async () => {
    await setup(true);

    expect(queue).toHaveBeenCalledWith('loc1', { enrich: true });
  });

  it('renders a row from the denormalized record alone', async () => {
    const { host } = await setup(false);

    // The outcome record carries the name and title precisely so an
    // unenriched row still says who it is.
    expect(host.textContent).toContain('Ada Lovelace');
    expect(host.textContent).toContain('Discovery call');
    expect(host.textContent).toContain('No-show');
    expect(host.textContent).toContain('2 attempts');
  });

  it('still renders a row whose appointment fell out of the lookback window', async () => {
    queue.mockResolvedValue(ok(response({ candidates: [entry({ appointment: null })] })));

    const { host } = await setup(true);

    // The legacy page dropped these rows entirely. A degraded row is a lead
    // someone can still call; a deleted one is not.
    expect(host.textContent).toContain('Ada Lovelace');
  });

  it('prefers the enriched contact name when there is one', async () => {
    queue.mockResolvedValue(
      ok(
        response({
          enriched: true,
          candidates: [
            entry({
              contact: { id: 'c1', displayName: 'Ada B. Lovelace', companyName: 'Analytical Co' },
            }),
          ],
        }),
      ),
    );

    const { host } = await setup(true);

    expect(host.textContent).toContain('Ada B. Lovelace');
    expect(host.textContent).toContain('Analytical Co');
  });

  it('says the queue is empty only when it is empty', async () => {
    queue.mockResolvedValue(ok(response({ total: 0, candidates: [] })));

    const { host } = await setup();

    expect(host.textContent).toContain('Nothing waiting on a follow-up');
  });

  it('shows a failure as a failure, never as an empty queue', async () => {
    queue.mockResolvedValue({
      data: null,
      error: { message: 'GHL rejected the request.', context: 'GET', status: 502 },
    });

    const { host } = await setup();

    expect(host.textContent).not.toContain('Nothing waiting on a follow-up');
    expect(host.textContent).toContain('GoHighLevel rejected the request');
  });

  it('says out loud when the saved threshold could not be read', async () => {
    queue.mockResolvedValue(ok(response({ configFallback: true })));

    const { host } = await setup();

    expect(host.querySelector('.follow-up__notice')?.textContent).toContain(
      'could not be read',
    );
  });

  it('warns that a truncated queue is not the whole queue', async () => {
    queue.mockResolvedValue(ok(response({ total: 120, truncated: true })));

    const { host } = await setup();

    expect(host.textContent).toContain('Showing 1 of 120');
  });

  it('hides the threshold control from a hat that cannot change it', async () => {
    const { host } = await setup();

    expect(host.querySelector('.follow-up__config')).toBeNull();
  });

  it('shows the threshold control when the server says this hat may configure', async () => {
    queue.mockResolvedValue(ok(response({ canConfigure: true })));

    const { host } = await setup();

    // Cosmetic either way: the PUT re-checks the role server-side.
    expect(host.querySelector('.follow-up__config')).not.toBeNull();
  });

  it('refuses a threshold that is not a whole positive number', async () => {
    queue.mockResolvedValue(ok(response({ canConfigure: true })));

    const { fixture, host } = await setup();

    typeThreshold(host, '0');
    fixture.detectChanges();
    submitConfig(host);
    await settle();
    fixture.detectChanges();

    expect(saveConfig).not.toHaveBeenCalled();
    expect(host.querySelector('.follow-up__error')?.textContent).toContain('whole number');
  });

  it('saves a new threshold and reloads the queue it just changed', async () => {
    queue.mockResolvedValue(ok(response({ canConfigure: true })));

    const { fixture, host } = await setup();
    expect(queue).toHaveBeenCalledTimes(1);

    typeThreshold(host, '14');
    fixture.detectChanges();
    submitConfig(host);
    await settle();
    fixture.detectChanges();
    await settle();

    expect(saveConfig).toHaveBeenCalledWith('loc1', { mode: 'days', value: 14 });
    // The threshold decides who ages out, so the list on screen is stale the
    // moment it is saved.
    expect(queue).toHaveBeenCalledTimes(2);
  });

  it('reports a refused threshold change rather than showing "Saved"', async () => {
    queue.mockResolvedValue(ok(response({ canConfigure: true })));
    saveConfig.mockResolvedValue({
      data: null,
      error: {
        message: 'Only a closing manager or owner can change this.',
        context: 'PUT',
        status: 403,
      },
    });

    const { fixture, host } = await setup();

    typeThreshold(host, '14');
    fixture.detectChanges();
    submitConfig(host);
    await settle();
    fixture.detectChanges();

    expect(host.textContent).toContain('Only a closing manager or owner can change this.');
    expect(host.querySelector('.follow-up__saved')).toBeNull();
  });
});
