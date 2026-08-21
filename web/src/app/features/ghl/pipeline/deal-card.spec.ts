import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { PipelineService } from '../services/pipeline.service';
import { ConfirmDialogService } from '../../../shared/ui';
import { DealCard } from './deal-card';
import { ok, type ApiResult } from '../../../core/models/api-result.model';
import type {
  CloseOpportunityResponse,
  MoveStageResponse,
  PipelineCard,
  PipelineStage,
} from '../services/ghl.model';

/**
 * Story: a card must never show a state the server refused.
 *
 * The stage select is optimistic because a closer moving five deals should not
 * wait five times. That is only safe if a rejected move rolls back — a select
 * left showing "Proposal" for a deal the API kept in "Discovery" is a lie the
 * next person to open the board will act on.
 *
 * The close is the opposite case. It is irreversible from this board and it is
 * the number revenue is counted from, so it is confirmed first, validated
 * first, and never optimistic.
 */

const moveStage = vi.fn<() => Promise<ApiResult<MoveStageResponse>>>();
const close = vi.fn<() => Promise<ApiResult<CloseOpportunityResponse>>>();
const confirm = vi.fn<() => Promise<boolean>>();

const STAGES: readonly PipelineStage[] = [
  { id: 'stage1', name: 'Discovery', position: 0 },
  { id: 'stage2', name: 'Proposal', position: 1 },
];

function card(overrides: Partial<PipelineCard> = {}): PipelineCard {
  return {
    id: 'opp1',
    name: 'Website enquiry',
    pipelineId: 'pipe1',
    pipelineStageId: 'stage1',
    status: 'open',
    monetaryValue: 0,
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    daysInStage: 3,
    stale: false,
    contact: { id: 'c1', name: 'Ada Lovelace' },
    ...overrides,
  };
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function setup(input: Partial<PipelineCard> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      { provide: PipelineService, useValue: { moveStage, close } },
      { provide: ConfirmDialogService, useValue: { confirm } },
    ],
  });

  const fixture = TestBed.createComponent(DealCard);
  fixture.componentRef.setInput('locationId', 'loc1');
  fixture.componentRef.setInput('card', card(input));
  fixture.componentRef.setInput('stages', STAGES);
  fixture.detectChanges();

  return { fixture, card: fixture.componentInstance };
}

beforeEach(() => {
  vi.clearAllMocks();
  moveStage.mockResolvedValue(
    ok({
      opportunityId: 'opp1',
      pipelineStageId: 'stage2',
      lastStageChangeAt: '2026-03-01T00:00:00.000Z',
      completedTaskIds: [],
    }),
  );
  close.mockResolvedValue(ok({ opportunityId: 'opp1', status: 'won', monetaryValue: 4200 }));
  confirm.mockResolvedValue(true);
});

describe('DealCard: stage moves', () => {
  it('names the stage it is leaving, so onboarding tasks can close', async () => {
    const { card: component } = setup();

    await component.moveTo('stage2');

    expect(moveStage).toHaveBeenCalledWith('loc1', 'opp1', {
      pipelineStageId: 'stage2',
      previousStageName: 'Discovery',
    });
  });

  it('records the new stage once the move lands', async () => {
    const { card: component } = setup();

    await component.moveTo('stage2');

    expect(component.committedStageId()).toBe('stage2');
    expect(component.moveError()).toBeNull();
  });

  it('puts the select back and says why when the move is refused', async () => {
    moveStage.mockResolvedValue({
      data: null,
      error: { message: 'No access to this location.', context: 'PUT', status: 403 },
    });
    const { card: component } = setup();

    // Simulates what the user's click does: the select owns its own value, so
    // it is already showing the new stage before the request is even sent.
    component.stageControl.setValue('stage2', { emitEvent: false });
    await component.moveTo('stage2');

    // The board still has this deal in Discovery, so the select must too.
    // Asserting the CONTROL rather than a signal is the point: a signal that
    // rolls back while the select keeps displaying the refused stage is the
    // failure this control exists to prevent.
    expect(component.stageControl.value).toBe('stage1');
    expect(component.committedStageId()).toBe('stage1');
    expect(component.moveError()).toBe('No access to this location.');
  });

  it('re-enables the select after a refused move', async () => {
    moveStage.mockResolvedValue({
      data: null,
      error: { message: 'GHL rejected the request.', context: 'PUT', status: 502 },
    });
    const { card: component } = setup();

    await component.moveTo('stage2');

    // A card that locks itself after one failure cannot be retried.
    expect(component.stageControl.disabled).toBe(false);
  });

  it('does not call the API for the stage it is already in', async () => {
    const { card: component } = setup();

    await component.moveTo('stage1');

    expect(moveStage).not.toHaveBeenCalled();
  });

  it('moves when the select reports a change, without a second wiring step', async () => {
    const { fixture, card: component } = setup();

    // What the mat-select actually does on a user pick.
    component.stageControl.setValue('stage2');
    await settle();
    fixture.detectChanges();

    expect(moveStage).toHaveBeenCalledTimes(1);
  });
});

describe('DealCard: closing', () => {
  it('refuses to mark won without a value', async () => {
    const { card: component } = setup();

    component.onCloseActionChange('won');
    component.setCloseValue('');
    await component.close();

    expect(close).not.toHaveBeenCalled();
    expect(component.closeError()).toBe('Value is required when marking won.');
  });

  it('refuses a value that is not a number', async () => {
    const { card: component } = setup();

    component.onCloseActionChange('won');
    component.setCloseValue('four thousand');
    await component.close();

    expect(close).not.toHaveBeenCalled();
    expect(component.closeError()).toBe('Value must be a number of zero or more.');
  });

  it('does not write when the confirmation is dismissed', async () => {
    confirm.mockResolvedValue(false);
    const { card: component } = setup();

    component.onCloseActionChange('lost');
    await component.close();

    // Escape and a backdrop click both resolve false. Neither is consent.
    expect(close).not.toHaveBeenCalled();
  });

  it('closes won with the value and the contact for the Meta dispatch', async () => {
    const { card: component } = setup();

    component.onCloseActionChange('won');
    component.setCloseValue('4200');
    await component.close();

    expect(close).toHaveBeenCalledWith('loc1', 'opp1', {
      status: 'won',
      monetaryValue: 4200,
      contactId: 'c1',
    });
  });

  it('closes lost at zero without inventing a value', async () => {
    const { card: component } = setup({ monetaryValue: 900 });

    component.onCloseActionChange('lost');
    await component.close();

    expect(close).toHaveBeenCalledWith('loc1', 'opp1', {
      status: 'lost',
      monetaryValue: 0,
      contactId: 'c1',
    });
  });

  it('omits the contact rather than sending an empty one', async () => {
    const { card: component } = setup({ contact: undefined });

    component.onCloseActionChange('lost');
    await component.close();

    expect(close).toHaveBeenCalledWith('loc1', 'opp1', { status: 'lost', monetaryValue: 0 });
  });

  it('refuses to close a deal that is already closed', async () => {
    const { card: component } = setup({ status: 'won' });

    component.onCloseActionChange('won');
    component.setCloseValue('100');
    await component.close();

    expect(close).not.toHaveBeenCalled();
    expect(component.closeError()).toBe('This deal is already won.');
  });

  it('reports a refused close instead of clearing the form', async () => {
    close.mockResolvedValue({
      data: null,
      error: { message: 'GHL rejected the request.', context: 'PUT', status: 502 },
    });
    const { card: component } = setup();

    component.onCloseActionChange('won');
    component.setCloseValue('4200');
    await component.close();

    expect(component.closeError()).toBe('GHL rejected the request.');
    // Still armed: a rejected close is one retry away, not one retype away.
    expect(component.closeAction()).toBe('won');
  });
});
