import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogService, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { OnboardingService } from '../services/onboarding.service';
import type {
  ActivatedCampaign,
  CampaignFormInput,
  CampaignPreview,
  CampaignTemplate,
  CreatedCampaign,
} from '../services/onboarding.model';

/**
 * Where the wizard is. Deliberately not reversible past `created`: once a
 * campaign exists in Meta, "go back and edit" is a lie — the create is
 * idempotent on identical inputs, so changing them would make a second one.
 */
type Step = 'form' | 'review' | 'created';

/**
 * Launching a campaign, in three deliberate steps.
 *
 * THE DEFECT THIS SCREEN EXISTS TO NOT REPEAT: creating a campaign and starting
 * its spend are two separate, separately confirmed actions.
 *
 * Story 5.5's activation had zero call sites. The only button in the flow
 * submitted the create action, so every campaign launched through the app
 * stayed paused in Meta indefinitely while the story read as Done. The fix is
 * not to merge them — that fixes it by making the opposite and more expensive
 * mistake, a form submit that quietly starts spending a client's money. So:
 *
 *  - Create makes a PAUSED campaign. The screen says nothing is spending.
 *  - Activate is a second, explicit click, behind a confirmation dialog whose
 *    copy is the server's own `activationWarning` string — served by the API
 *    rather than written here, so the sentence a person reads is the sentence
 *    the endpoint enforces.
 *  - The endpoint requires `confirmSpend: true` regardless, which is what makes
 *    activation impossible as a side effect of a retry or a double-submit.
 *
 * Validation is the server's too. `preview` runs `parseCampaignFormInputs`,
 * the same function the create call uses, so "monthly budget at least $100" and
 * "daily cap at most budget ÷ 30" have exactly one implementation. Angular
 * validators expressing the same rules would be a second one, and the second
 * one always drifts.
 */
@Component({
  selector: 'app-campaign-launch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    PageShell,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './campaign-launch.html',
  styleUrl: './campaign-launch.scss',
})
export class CampaignLaunch {
  private readonly service = inject(OnboardingService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly templates = signal<readonly CampaignTemplate[]>([]);

  /**
   * The activation warning, from the API. Held from the template load so the
   * confirm step can show it before a create has happened, and refreshed from
   * the create response — the two are the same constant server-side, and
   * reading both means a mismatch would be visible rather than assumed away.
   */
  protected readonly activationWarning = signal('');

  protected readonly step = signal<Step>('form');

  protected readonly form = new FormGroup({
    client: new FormControl('', { nonNullable: true }),
    offer: new FormControl('', { nonNullable: true }),
    budget: new FormControl('', { nonNullable: true }),
    cap: new FormControl('', { nonNullable: true }),
    pixel: new FormControl('', { nonNullable: true }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly busy = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly preview = signal<CampaignPreview | null>(null);
  protected readonly created = signal<CreatedCampaign | null>(null);
  protected readonly activated = signal<ActivatedCampaign | null>(null);

  /**
   * Only "every field has something in it" is checked here. Everything with a
   * rule attached — the budget floor, the cap ratio, whether the offer exists —
   * is checked by the server, whose answer is the one that decides.
   */
  protected readonly canReview = computed(() => {
    const value = this.formValue();
    return (
      !this.busy() &&
      Boolean(value.client?.trim()) &&
      Boolean(value.offer) &&
      Boolean(value.budget) &&
      Boolean(value.cap) &&
      Boolean(value.pixel?.trim())
    );
  });

  protected readonly campaignName = computed(() => {
    const preview = this.preview();
    if (!preview) return '';
    return `${preview.campaign.clientName} — ${preview.template.offerLabel}`;
  });

  protected readonly adSetName = computed(() => {
    const name = this.campaignName();
    return name ? `${name} traffic` : '';
  });

  constructor() {
    void this.loadTemplates();
  }

  protected async loadTemplates(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    const result = await this.service.templates();

    if (result.error) {
      this.templates.set([]);
      this.loadError.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.templates.set(result.data.templates);
    this.activationWarning.set(result.data.activationWarning);
    this.loading.set(false);
  }

  private input(): CampaignFormInput {
    const raw = this.form.getRawValue();
    return {
      client: raw.client.trim(),
      offer: raw.offer,
      budget: raw.budget,
      cap: raw.cap,
      pixel: raw.pixel.trim(),
    };
  }

  /** Validation only. Creates nothing and touches Meta not at all. */
  protected async review(): Promise<void> {
    if (!this.canReview()) return;

    this.busy.set(true);
    this.actionError.set(null);

    const result = await this.service.preview(this.input());
    this.busy.set(false);

    if (result.error) {
      // The server's own sentence — "Daily cap can't exceed monthly budget ÷
      // 30" — not a generic failure. It is the only wording that tells someone
      // what to change.
      this.actionError.set(result.error.message);
      return;
    }

    this.preview.set(result.data);
    this.activationWarning.set(result.data.activationWarning);
    this.step.set('review');
  }

  protected edit(): void {
    this.actionError.set(null);
    this.preview.set(null);
    this.step.set('form');
  }

  /** Creates the campaign PAUSED. Nothing spends. */
  protected async create(): Promise<void> {
    if (this.busy() || this.created()) return;

    this.busy.set(true);
    this.actionError.set(null);

    const result = await this.service.create(this.input());
    this.busy.set(false);

    if (result.error) {
      this.actionError.set(result.error.message);
      return;
    }

    this.created.set(result.data);
    this.activationWarning.set(result.data.activationWarning);
    this.step.set('created');
  }

  /**
   * Starts real ad spend. Behind a confirmation whose copy is the server's.
   *
   * The dialog is not the security control — `confirmSpend: true` on the
   * endpoint is what makes activation impossible by accident. The dialog is
   * here so the person clicking knows what the click costs.
   */
  protected async activate(): Promise<void> {
    const created = this.created();
    if (!created || this.busy() || this.activated()) return;

    const confirmed = await this.confirmDialog.confirm({
      title: 'Start real ad spend?',
      message: this.activationWarning(),
      confirmLabel: 'Activate campaign',
      cancelLabel: 'Leave it paused',
      destructive: true,
    });
    if (!confirmed) return;

    this.busy.set(true);
    this.actionError.set(null);

    const result = await this.service.activate(created.campaignId, created.locationId);
    this.busy.set(false);

    if (result.error) {
      // Meta and GHL do not share a transaction. If the unpause succeeded and
      // only the stage move failed, the endpoint's message says so explicitly
      // — which is what stops someone relaunching a campaign that is already
      // running. Surfaced verbatim for exactly that reason.
      this.actionError.set(result.error.message);
      return;
    }

    this.activated.set(result.data);
  }
}
