import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { OnboardingService } from '../services/onboarding.service';
import type { Checklist, ChecklistReady } from '../services/onboarding.model';

/**
 * A client's Fulfillment onboarding checklist.
 *
 * Three states, rendered as three states. "No client selected" and "no
 * Fulfillment opportunity yet" are normal situations with their own copy, not
 * errors — a red box over either one is both wrong and, repeated often enough,
 * the reason nobody reads red boxes.
 *
 * The toggle is optimistic and rolls back by restoring the PREVIOUS membership,
 * the same rule the course player follows: the endpoint returns the completed
 * set read back from the store, so a successful write reconciles against what
 * is actually persisted and a failed one puts the task back exactly where it
 * was.
 *
 * `readOnly` hides the checkboxes for a client-side viewer. Cosmetic:
 * `POST /api/onboarding/checklist/task` re-checks the role and the location on
 * every write, and validates the task id against the fixed stage mapping so a
 * caller cannot write arbitrary keys into the stored document.
 */
@Component({
  selector: 'app-onboarding-checklist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './onboarding-checklist.html',
  styleUrl: './onboarding-checklist.scss',
})
export class OnboardingChecklist {
  private readonly service = inject(OnboardingService);
  private readonly route = inject(ActivatedRoute);

  /**
   * Optional. `/onboarding` follows whichever client the CSM has entered
   * (Story 3.3's impersonation), `/onboarding/:locationId` names one outright.
   * Either way the id is re-checked against the session server-side before any
   * read or write — it selects among the caller's own clients, it grants
   * nothing.
   */
  protected readonly locationId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('locationId'))),
    { initialValue: this.route.snapshot.paramMap.get('locationId') },
  );

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly checklist = signal<Checklist | null>(null);

  /** Completed task ids, held separately so an optimistic toggle is cheap. */
  private readonly completed = signal<ReadonlySet<string>>(new Set());

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly state = computed(() => this.checklist()?.state ?? null);

  protected readonly ready = computed<ChecklistReady | null>(() => {
    const checklist = this.checklist();
    return checklist?.state === 'ready' ? checklist : null;
  });

  protected readonly tenantName = computed(() => {
    const checklist = this.checklist();
    if (!checklist || checklist.state === 'no-client') return null;
    return checklist.tenantName;
  });

  protected readonly stageOrder = computed(() => this.checklist()?.stageOrder ?? []);

  protected readonly heading = computed(() => this.tenantName() ?? 'Onboarding');

  protected readonly stageLabel = computed(() => {
    const ready = this.ready();
    if (!ready) return null;
    return ready.stage ?? 'Stage unrecognised';
  });

  protected readonly daysLabel = computed(() => {
    const days = this.ready()?.daysInStage;
    if (days === null || days === undefined) return 'No stage change on record';
    return `${days} ${days === 1 ? 'day' : 'days'} in stage`;
  });

  /**
   * Shown when GHL's stage name did not parse. Naming the raw value is the
   * whole point: "Stage unrecognised" alone gives nobody anything to fix,
   * whereas the actual string tells them whether the pipeline was renamed.
   */
  protected readonly unparsedStage = computed(() => {
    const ready = this.ready();
    if (!ready || ready.stage !== null) return null;
    return ready.stageName ?? 'unknown';
  });

  protected readonly progressLabel = computed(() => {
    const ready = this.ready();
    if (!ready) return null;
    const done = ready.tasks.filter((task) => this.completed().has(task.id)).length;
    return `${done} of ${ready.tasks.length} done`;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);

    const result = await this.service.checklist(this.locationId() ?? undefined);

    if (result.error) {
      this.checklist.set(null);
      this.completed.set(new Set());
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.checklist.set(result.data);
    this.completed.set(
      new Set(result.data.state === 'ready' ? result.data.completedTaskIds : []),
    );
    this.loading.set(false);
  }

  protected isComplete(taskId: string): boolean {
    return this.completed().has(taskId);
  }

  protected async toggle(taskId: string, complete: boolean): Promise<void> {
    const ready = this.ready();
    if (!ready || ready.readOnly || this.saving()) return;

    // Captured before the optimistic write, so the rollback restores the
    // previous membership rather than guessing at it.
    const previous = this.completed();

    this.completed.set(withTask(previous, taskId, complete));
    this.saving.set(true);
    this.saveError.set(null);

    const result = await this.service.setTask({
      locationId: ready.locationId,
      opportunityId: ready.opportunityId,
      taskId,
      complete,
    });

    this.saving.set(false);

    if (result.error) {
      this.completed.set(previous);
      this.saveError.set(
        `${result.error.message} That change has been undone — nothing was saved.`,
      );
      return;
    }

    // Reconciled against the stored set, not against the guess above.
    this.completed.set(new Set(result.data.completedTaskIds));
  }
}

function withTask(current: ReadonlySet<string>, taskId: string, complete: boolean): Set<string> {
  const next = new Set(current);
  if (complete) next.add(taskId);
  else next.delete(taskId);
  return next;
}
