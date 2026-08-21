import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { PermissionService } from '../../../core/services/permission.service';
import { RBAC_SERVICE } from '../../../core/services/rbac.service';
import { FlowService } from '../services/flow.service';
import { FLOW_REVIEWER_ROLES, FLOW_SUGGESTER_ROLES } from '../flow.routes';
import type {
  FlowCard,
  FlowScriptSuggestion,
  FullFramework,
  SuggestionAction,
} from '../services/flow.model';

/**
 * FLOW: the sales scripts a closer reads on a live call, and the queue of
 * suggested edits to them.
 *
 * ── A KNOWN GAP, stated rather than papered over ─────────────────────────
 * `/api/flow/**` takes the org id from the caller. The legacy page resolved it
 * server-side with `getLocationForDashboard(session)`, which for TAG-side hats
 * returns the TAG_GROWTH agency sub-account read from
 * `GHL_LOCATION_ID_TAG_GROWTH` — an environment variable no browser can see.
 *
 * So this screen resolves the org the only way a client honestly can: the
 * entered client if there is one, otherwise the session's first location. For a
 * client_closer that is right. For tag_exec or tag_sales it may well not be,
 * and `requireLocationAccess` will happily allow the wrong-but-permitted org,
 * which means the failure mode is a plausible framework rather than an error.
 *
 * Two consequences, both deliberate: the resolved org id is displayed on the
 * page so a wrong answer is visible rather than silent, and the gap is reported
 * to whoever picks up FLOW next. The fix is an endpoint —
 * `GET /api/flow/framework` with no org parameter — that resolves the org from
 * the session exactly as the legacy page did. It is not a fix this feature can
 * make from the browser.
 */
@Component({
  selector: 'app-flow-framework',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './flow-framework.html',
  styleUrl: './flow-framework.scss',
})
export class FlowFramework {
  private readonly service = inject(FlowService);
  private readonly permission = inject(PermissionService);
  private readonly rbac = inject(RBAC_SERVICE);

  /** See the class comment: a best-effort client-side resolution, shown on screen. */
  protected readonly orgId = computed(() => {
    const session = this.rbac.session();
    if (!session) return null;
    return session.impersonation?.locationId ?? session.locations[0] ?? null;
  });

  protected readonly canSuggest = computed(() =>
    this.permission.hasAnyRole(FLOW_SUGGESTER_ROLES),
  );
  protected readonly canReview = computed(() => this.permission.hasAnyRole(FLOW_REVIEWER_ROLES));

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly framework = signal<FullFramework | null>(null);

  protected readonly tabs = computed(() => this.framework()?.tabs ?? []);

  /** Which card's suggestion form is open. One at a time. */
  protected readonly suggestingCardId = signal<string | null>(null);
  protected readonly suggestForm = new FormGroup({
    content: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });
  protected readonly suggestBusy = signal(false);
  protected readonly suggestError = signal<string | null>(null);
  protected readonly suggestSentFor = signal<string | null>(null);

  protected readonly suggestions = signal<readonly FlowScriptSuggestion[]>([]);
  protected readonly suggestionsError = signal<string | null>(null);
  protected readonly resolvingId = signal<string | null>(null);

  private readonly cardLabels = computed(() => {
    const labels = new Map<string, string>();
    for (const tab of this.tabs()) {
      for (const section of tab.sections) {
        for (const card of section.cards) labels.set(card.id, card.label);
      }
    }
    return labels;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    const orgId = this.orgId();

    this.loading.set(true);
    this.error.set(null);

    if (!orgId) {
      // Not an error state: a signed-in hat with no location has no framework
      // to read, and a red box would blame the reader for a configuration fact.
      this.framework.set(null);
      this.loading.set(false);
      return;
    }

    const result = await this.service.framework(orgId);

    if (result.error) {
      this.framework.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.framework.set(result.data);
    this.loading.set(false);

    if (this.canReview()) void this.loadSuggestions();
  }

  protected async loadSuggestions(): Promise<void> {
    const orgId = this.orgId();
    if (!orgId) return;

    this.suggestionsError.set(null);

    const result = await this.service.pendingSuggestions(orgId);

    if (result.error) {
      // Kept out of the framework's own error state: the scripts loaded fine
      // and are still worth reading. But the queue's failure is named rather
      // than rendered as "no pending suggestions", which would tell a manager
      // there is nothing to review when there may be plenty.
      this.suggestions.set([]);
      this.suggestionsError.set(result.error.message);
      return;
    }

    this.suggestions.set(result.data);
  }

  protected cardLabel(cardId: string): string {
    return this.cardLabels().get(cardId) ?? 'Unknown card';
  }

  protected openSuggestion(card: FlowCard): void {
    this.suggestingCardId.set(card.id);
    this.suggestSentFor.set(null);
    this.suggestError.set(null);
    this.suggestForm.setValue({ content: card.script?.content ?? '', note: '' });
  }

  protected cancelSuggestion(): void {
    this.suggestingCardId.set(null);
    this.suggestError.set(null);
  }

  protected async submitSuggestion(): Promise<void> {
    const cardId = this.suggestingCardId();
    const orgId = this.orgId();
    if (!cardId || !orgId || this.suggestBusy()) return;

    const { content, note } = this.suggestForm.getRawValue();
    if (!content.trim()) {
      this.suggestError.set('The suggested script cannot be empty.');
      return;
    }

    this.suggestBusy.set(true);
    this.suggestError.set(null);

    const result = await this.service.suggest({
      orgId,
      cardId,
      content: content.trim(),
      note: note.trim(),
    });

    this.suggestBusy.set(false);

    if (result.error) {
      this.suggestError.set(result.error.message);
      return;
    }

    this.suggestingCardId.set(null);
    this.suggestSentFor.set(cardId);
  }

  protected async resolve(
    suggestion: FlowScriptSuggestion,
    action: SuggestionAction,
  ): Promise<void> {
    if (this.resolvingId()) return;

    this.resolvingId.set(suggestion.id);
    this.suggestionsError.set(null);

    const result = await this.service.resolve(suggestion.id, action);
    this.resolvingId.set(null);

    if (result.error) {
      this.suggestionsError.set(result.error.message);
      return;
    }

    // Approving writes a new script version, so the framework on screen is now
    // out of date. Re-read both rather than dropping the row locally: the
    // point of approving is that the script changed.
    if (action === 'approve') {
      await this.load();
      return;
    }

    await this.loadSuggestions();
  }
}
