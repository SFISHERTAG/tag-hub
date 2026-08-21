import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { KnowledgeBaseService } from '../services/knowledge-base.service';
import type { ManualPage } from '../services/manual.model';
import { ManualBlocks } from '../manual-blocks/manual-blocks';

/**
 * One manual page.
 *
 * Named `ManualPageView` rather than `ManualPage` because the latter is the
 * wire type this component renders; two things called the same thing in one
 * feature is how an import ends up pointing at the wrong one.
 */
@Component({
  selector: 'app-manual-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, PageShell, ErrorState, LoadingState, ManualBlocks],
  templateUrl: './manual-page.html',
  styleUrl: './manual-page.scss',
})
export class ManualPageView {
  private readonly service = inject(KnowledgeBaseService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('pageId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('pageId') ?? '' },
  );

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal<ManualPage | null>(null);

  protected readonly title = computed(() => this.page()?.title ?? 'Manual page');

  protected readonly subtitle = computed(() => {
    const page = this.page();
    if (!page) return null;
    return [page.num, page.eyebrow].filter((part) => part.length > 0).join(' · ') || null;
  });

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

    this.page.set(result.data.page);
    this.loading.set(false);
  }
}
