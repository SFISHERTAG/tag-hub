import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfirmDialogService, ErrorState, LoadingState, PageShell } from '../../../../shared/ui';
import { AdminKnowledgeBaseService } from '../../services/admin-knowledge-base.service';
import {
  parseBlocks,
  type ManualPage,
  type ManualPageVersion,
} from '../../services/admin-knowledge-base.model';

/**
 * Editing one manual page, and reverting it.
 *
 * Blocks are edited as raw JSON rather than through per-type form fields. The
 * source manual carries six block shapes and gains new ones per page; a form
 * per type is a large surface area for content edited a few times a year, and
 * the reader already degrades an unrecognised block into a visible raw dump
 * rather than dropping it. `parseBlocks` validates structure before the save
 * call, so a typo is a message next to the field instead of a 400.
 *
 * Reverting is confirmed. It is a write, not a navigation: it replaces the live
 * page and records the current content as a new version, so the thing an editor
 * needs to be sure about is which of several similar-looking versions they
 * picked.
 */
@Component({
  selector: 'app-manual-page-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    PageShell,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './manual-page-editor.html',
  styleUrl: './manual-page-editor.scss',
})
export class ManualPageEditor {
  private readonly service = inject(AdminKnowledgeBaseService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly route = inject(ActivatedRoute);

  /** From the paramMap stream: the router reuses this component across ids. */
  protected readonly pageId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('pageId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('pageId') ?? '' },
  );

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<ManualPage | null>(null);

  protected readonly form = new FormGroup({
    num: new FormControl('', { nonNullable: true }),
    title: new FormControl('', { nonNullable: true }),
    eyebrow: new FormControl('', { nonNullable: true }),
    lede: new FormControl('', { nonNullable: true }),
    status: new FormControl('', { nonNullable: true }),
    level: new FormControl('', { nonNullable: true }),
    blocksJson: new FormControl('[]', { nonNullable: true }),
  });

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saved = signal(false);

  protected readonly historyOpen = signal(false);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly versions = signal<readonly ManualPageVersion[] | null>(null);

  protected readonly heading = computed(() => this.page()?.title ?? 'Manual page');

  constructor() {
    effect(() => {
      void this.load(this.pageId());
    });
  }

  protected async load(pageId = this.pageId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.get(pageId);

    if (result.error) {
      this.page.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    const page = result.data.page;
    this.page.set(page);
    this.form.setValue({
      num: page.num,
      title: page.title,
      eyebrow: page.eyebrow,
      lede: page.lede,
      status: page.status,
      level: page.level,
      blocksJson: JSON.stringify(page.blocks, null, 2),
    });
    this.saved.set(false);
    // History is now stale: this page's content has moved on from whatever the
    // panel last showed. Dropped rather than refetched, so it reloads only if
    // someone opens it again.
    this.versions.set(null);
    this.loading.set(false);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;

    const raw = this.form.getRawValue();

    const parsed = parseBlocks(raw.blocksJson);
    if (!parsed.ok) {
      this.saveError.set(parsed.error);
      this.saved.set(false);
      return;
    }

    if (!raw.title.trim()) {
      this.saveError.set('A page needs a title.');
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);
    this.saved.set(false);

    const result = await this.service.save(this.pageId(), {
      num: raw.num.trim(),
      title: raw.title.trim(),
      eyebrow: raw.eyebrow.trim(),
      lede: raw.lede.trim(),
      status: raw.status.trim(),
      level: raw.level.trim(),
      blocks: parsed.blocks,
    });

    this.saving.set(false);

    if (result.error) {
      this.saveError.set(result.error.message);
      return;
    }

    this.saved.set(true);
    this.versions.set(null);
    await this.load();
  }

  protected toggleHistory(): void {
    const open = !this.historyOpen();
    this.historyOpen.set(open);
    if (open && this.versions() === null) void this.loadHistory();
  }

  protected async loadHistory(): Promise<void> {
    this.historyLoading.set(true);
    this.historyError.set(null);

    const result = await this.service.history(this.pageId());
    this.historyLoading.set(false);

    if (result.error) {
      // Left null, not set to []. An empty list here means "this page has never
      // been edited", which is a claim this failure gives no grounds for.
      this.versions.set(null);
      this.historyError.set(result.error.message);
      return;
    }

    this.versions.set(result.data.versions);
  }

  protected versionLabel(version: ManualPageVersion): string {
    return `${version.authorEmail} · ${new Date(version.createdAt).toLocaleString()}`;
  }

  protected async revert(version: ManualPageVersion): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Revert to this version?',
      message: `The live page becomes "${version.page.title}" as saved by ${this.versionLabel(version)}. The current content is kept as a new version.`,
      confirmLabel: 'Revert',
    });
    if (!confirmed) return;

    this.saving.set(true);
    this.saveError.set(null);

    const result = await this.service.revert(this.pageId(), version.id);
    this.saving.set(false);

    if (result.error) {
      this.saveError.set(result.error.message);
      return;
    }

    this.versions.set(null);
    await this.load();
    if (this.historyOpen()) void this.loadHistory();
  }
}
