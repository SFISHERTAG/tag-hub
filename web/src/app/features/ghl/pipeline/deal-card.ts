import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogService } from '../../../shared/ui';
import { PipelineService } from '../services/pipeline.service';
import { classifyGhlError } from '../services/ghl-error';
import { formatMoney, stageAgeLabel } from '../services/ghl-format';
import type { CloseStatus, PipelineCard, PipelineStage } from '../services/ghl.model';

type CloseAction = 'none' | CloseStatus;

/**
 * One deal on the board: who it is, what it is worth, how long it has sat, and
 * the two writes a closer performs on it — move it, or close it.
 *
 * The stage move is optimistic and rolls back. That is the legacy behaviour and
 * it is the right one: the select must never keep showing a stage the server
 * refused, because the next person to look at the board would read it as fact.
 * On success the parent reloads, so the card physically moves column rather
 * than sitting in the old one with a new label.
 *
 * The rollback goes through a FormControl and an explicit `setValue`, NOT
 * through a bound signal, and that is the whole reason this one control is
 * reactive while the rest of the card uses ngModel. A `mat-select` holds its own
 * value: the user's click sets it directly. When the optimistic write and its
 * rejection land inside one change-detection tick — which is exactly what a fast
 * 403 does — Angular sees the bound value go from `stage1` back to `stage1`,
 * writes nothing, and the select keeps displaying the stage the API refused.
 * `setValue` is imperative and does not consult that diff, so the rollback
 * always lands.
 *
 * The state and handlers below are public rather than protected. The spec
 * drives them directly, because clicking a stage through a Material overlay in
 * jsdom tests Material's overlay rather than this card's rollback, and the
 * rollback is the part that matters.
 *
 * The close is NOT optimistic. It is irreversible from this board and it is the
 * number revenue is reported from, so it goes through the shared confirm
 * dialog and only then through the endpoint. The dialog is a courtesy, not a
 * control: `PUT .../close` re-checks the caller's access to this tenant
 * whatever was clicked here.
 */
@Component({
  selector: 'app-deal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './deal-card.html',
  styleUrl: './deal-card.scss',
})
export class DealCard {
  private readonly pipeline = inject(PipelineService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly locationId = input.required<string>();
  readonly card = input.required<PipelineCard>();
  /** Every stage of THIS card's pipeline, in board order. */
  readonly stages = input.required<readonly PipelineStage[]>();

  /** A write landed. The board reloads; this card does not try to re-shelve itself. */
  readonly changed = output<void>();

  /** The stage this card is actually in, as far as this component knows.
   * Re-seeded whenever the card input changes, so a board reload wins over a
   * stale optimistic value rather than fighting it. */
  readonly committedStageId = linkedSignal(() => this.card().pipelineStageId);

  /** The select's own state. Kept in step with `committedStageId` below. */
  readonly stageControl = new FormControl<string>('', { nonNullable: true });

  readonly moving = signal(false);
  readonly moveError = signal<string | null>(null);

  readonly closeAction = signal<CloseAction>('none');
  readonly closeValue = linkedSignal(() => {
    const value = this.card().monetaryValue;
    return value > 0 ? String(value) : '';
  });
  readonly closing = signal(false);
  readonly closeError = signal<string | null>(null);

  readonly isClosed = computed(() => {
    const status = this.card().status;
    return status === 'won' || status === 'lost';
  });

  /** Contact name first: a closer looking at a column is looking for a person,
   * and GHL's opportunity `name` is often the form submission's title. */
  readonly title = computed(() => {
    const card = this.card();
    return card.contact?.name?.trim() || card.name?.trim() || 'Unnamed opportunity';
  });

  readonly valueLabel = computed(() => formatMoney(this.card().monetaryValue));
  readonly ageLabel = computed(() => stageAgeLabel(this.card().daysInStage));

  constructor() {
    // The card input is the source of truth for where this deal sits. Syncing
    // the control from it rather than the other way round means a board reload
    // corrects an optimistic value instead of arguing with it.
    effect(() => {
      const stageId = this.committedStageId();
      if (this.stageControl.value !== stageId) {
        this.stageControl.setValue(stageId, { emitEvent: false });
      }
    });

    this.stageControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((next) => void this.moveTo(next));
  }

  async moveTo(next: string): Promise<void> {
    const previous = this.committedStageId();
    if (next === '' || next === previous) return;

    const previousStageName = this.stages().find((stage) => stage.id === previous)?.name;

    this.moveError.set(null);
    this.moving.set(true);
    // Imperative rather than a `[disabled]` binding: binding `disabled` on a
    // reactive control is the pattern Angular warns about, and it would fight
    // the control's own state.
    this.stageControl.disable({ emitEvent: false });

    const result = await this.pipeline.moveStage(this.locationId(), this.card().id, {
      pipelineStageId: next,
      // Leaving a Fulfillment stage closes that stage's onboarding tasks
      // server-side. Sending the name is what lets the endpoint tell that move
      // from a Sales-pipeline one.
      ...(previousStageName === undefined ? {} : { previousStageName }),
    });

    this.moving.set(false);
    this.stageControl.enable({ emitEvent: false });

    if (result.error) {
      // Roll back rather than lie about where this deal is.
      this.stageControl.setValue(previous, { emitEvent: false });
      this.moveError.set(classifyGhlError(result.error).detail);
      return;
    }

    this.committedStageId.set(next);
    this.changed.emit();
  }

  onCloseActionChange(next: unknown): void {
    this.closeAction.set(next === 'won' || next === 'lost' ? next : 'none');
    this.closeError.set(null);
  }

  setCloseValue(next: unknown): void {
    this.closeValue.set(next === null || next === undefined ? '' : String(next));
  }

  async close(): Promise<void> {
    const action = this.closeAction();
    if (action === 'none' || this.closing()) return;

    this.closeError.set(null);

    if (this.isClosed()) {
      this.closeError.set(`This deal is already ${this.card().status}.`);
      return;
    }

    const raw = this.closeValue().trim();
    if (action === 'won' && raw === '') {
      this.closeError.set('Value is required when marking won.');
      return;
    }

    const monetaryValue = action === 'won' ? Number(raw) : 0;
    if (!Number.isFinite(monetaryValue) || monetaryValue < 0) {
      this.closeError.set('Value must be a number of zero or more.');
      return;
    }

    const confirmed = await this.confirmDialog.confirm({
      title: action === 'won' ? 'Mark this deal won?' : 'Mark this deal lost?',
      message:
        action === 'won'
          ? `${this.title()} closes at ${formatMoney(monetaryValue)}. This board cannot reopen it.`
          : `${this.title()} will be recorded as lost. This board cannot reopen it.`,
      confirmLabel: action === 'won' ? 'Mark won' : 'Mark lost',
      destructive: action === 'lost',
    });
    if (!confirmed) return;

    this.closing.set(true);

    const contactId = this.card().contact?.id;
    const result = await this.pipeline.close(this.locationId(), this.card().id, {
      status: action,
      monetaryValue,
      // Carries the Meta closed_won dispatch. The close itself succeeds
      // without it, so an opportunity with no contact still closes.
      ...(contactId === undefined ? {} : { contactId }),
    });

    this.closing.set(false);

    if (result.error) {
      this.closeError.set(classifyGhlError(result.error).detail);
      return;
    }

    this.closeAction.set('none');
    this.changed.emit();
  }
}
