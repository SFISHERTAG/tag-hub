import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OnboardingChecklist } from './onboarding-checklist';
import { OnboardingService } from '../services/onboarding.service';
import { ok } from '../../../core/models/api-result.model';
import type { ApiResult } from '../../../core/models/api-result.model';
import type { Checklist, ChecklistReady, TaskSaved, TaskToggle } from '../services/onboarding.model';

/**
 * Story: three ordinary states must render as three ordinary states, and a
 * failed toggle must put the task back where it was.
 *
 * "No client selected" and "this client has no Fulfillment opportunity yet" are
 * normal situations with their own copy. Rendering either as an error is both
 * wrong and, repeated often enough, the reason people stop reading errors.
 *
 * The rollback follows the same rule as the course player: restore the previous
 * membership, and reconcile a success against the set the store actually holds
 * rather than the optimistic guess.
 */

const READY: ChecklistReady = {
  state: 'ready',
  locationId: 'loc1',
  tenantName: 'Acme Tax',
  opportunityId: 'opp-1',
  stage: 'PR1',
  stageName: 'PR 1 - Paperwork',
  daysInStage: 3,
  tasks: [
    { id: 'task-a', label: 'Send the welcome pack' },
    { id: 'task-b', label: 'Book the kickoff call' },
  ],
  completedTaskIds: ['task-a'],
  readOnly: false,
  stageOrder: ['PR1', 'PR2', 'AP1'],
};

const checklist = vi.fn<(locationId?: string) => Promise<ApiResult<Checklist>>>();
const setTask = vi.fn<(toggle: TaskToggle) => Promise<ApiResult<TaskSaved>>>();

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(state: Checklist = READY, routeLocationId: string | null = null) {
  checklist.mockReset();
  setTask.mockReset();
  checklist.mockResolvedValue(ok(state));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [OnboardingChecklist],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: OnboardingService, useValue: { checklist, setTask } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(
            convertToParamMap(routeLocationId ? { locationId: routeLocationId } : {}),
          ),
          snapshot: {
            paramMap: convertToParamMap(routeLocationId ? { locationId: routeLocationId } : {}),
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(OnboardingChecklist);
  fixture.detectChanges();
  await settle();
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance };
}

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders "no client selected" as a state, not as an error', async () => {
    const { component } = await setup({ state: 'no-client', stageOrder: ['PR1'] });

    expect(component['state']()).toBe('no-client');
    expect(component['error']()).toBeNull();
    expect(component['ready']()).toBeNull();
  });

  it('renders "no Fulfillment opportunity" as a state, not as an error', async () => {
    const { component } = await setup({
      state: 'no-opportunity',
      locationId: 'loc1',
      tenantName: 'Acme Tax',
      stageOrder: ['PR1'],
    });

    expect(component['state']()).toBe('no-opportunity');
    expect(component['error']()).toBeNull();
    expect(component['tenantName']()).toBe('Acme Tax');
  });

  it('shows the stage, the days in it, and the tasks the server sent', async () => {
    const { component } = await setup();

    expect(component['stageLabel']()).toBe('PR1');
    expect(component['daysLabel']()).toBe('3 days in stage');
    expect(component['progressLabel']()).toBe('1 of 2 done');
    expect(component['isComplete']('task-a')).toBe(true);
    expect(component['isComplete']('task-b')).toBe(false);
  });

  it('names the unparsed stage string, which is the only clue worth giving', async () => {
    const { component } = await setup({
      ...READY,
      stage: null,
      stageName: 'AP 2 — Ads Launched (renamed)',
      tasks: [],
      completedTaskIds: [],
    });

    expect(component['stageLabel']()).toBe('Stage unrecognised');
    expect(component['unparsedStage']()).toBe('AP 2 — Ads Launched (renamed)');
  });

  it('says so plainly when GHL reported no stage change at all', async () => {
    const { component } = await setup({ ...READY, daysInStage: null });

    expect(component['daysLabel']()).toBe('No stage change on record');
  });

  it('sends the location and opportunity the server told it about, not a guess', async () => {
    const { component } = await setup();
    setTask.mockResolvedValue(ok({ ok: true, completedTaskIds: ['task-a', 'task-b'] }));

    await component['toggle']('task-b', true);

    expect(setTask).toHaveBeenCalledWith({
      locationId: 'loc1',
      opportunityId: 'opp-1',
      taskId: 'task-b',
      complete: true,
    });
  });

  it('reconciles against the completed set the store returns', async () => {
    const { component } = await setup();
    // The request said "complete task-b"; the store came back without it.
    setTask.mockResolvedValue(ok({ ok: true, completedTaskIds: ['task-a'] }));

    await component['toggle']('task-b', true);

    expect(component['isComplete']('task-b')).toBe(false);
  });

  it('restores the previous state when a write fails, and says the change was undone', async () => {
    const { component } = await setup();
    setTask.mockResolvedValue({
      data: null,
      error: { message: 'Firestore unavailable.', context: 'POST /api/onboarding/checklist/task' },
    });

    await component['toggle']('task-a', false);

    expect(component['isComplete']('task-a')).toBe(true);
    expect(component['saveError']()).toContain('has been undone');
  });

  it('does not write at all for a read-only viewer', async () => {
    const { component } = await setup({ ...READY, readOnly: true });

    await component['toggle']('task-b', true);

    expect(setTask).not.toHaveBeenCalled();
  });

  it('passes an explicit location id through when the route names one', async () => {
    await setup(READY, 'loc-from-route');

    expect(checklist).toHaveBeenCalledWith('loc-from-route');
  });

  it('omits the location id when the route does not name one, letting the server resolve it', async () => {
    await setup(READY, null);

    expect(checklist).toHaveBeenCalledWith(undefined);
  });

  it('shows a failed load as a failure, never as an empty checklist', async () => {
    checklist.mockReset();
    setTask.mockReset();
    checklist.mockResolvedValue({
      data: null,
      error: { message: 'GHL unreachable.', context: 'GET /api/onboarding/checklist' },
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [OnboardingChecklist],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: OnboardingService, useValue: { checklist, setTask } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({})),
            snapshot: { paramMap: convertToParamMap({}) },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(OnboardingChecklist);
    fixture.detectChanges();
    await settle();

    const component = fixture.componentInstance;
    expect(component['error']()).toBe('GHL unreachable.');
    expect(component['ready']()).toBeNull();
  });
});
