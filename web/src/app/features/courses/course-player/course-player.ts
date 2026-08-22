import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { CoursesService } from '../services/courses.service';
import {
  progressKey,
  type Course,
  type CourseCheckbox,
  type CourseSection,
  type CourseSubsection,
  type CourseVideo,
  type ProgressEntry,
  type ProgressMap,
} from '../services/course.model';
import { canEmbed, videoEmbedUrl, videoShareUrl, videoTitle } from '../services/video-embed';

/**
 * Working through a course.
 *
 * THE DEFECT THIS SCREEN EXISTS TO NOT REPEAT: when a save fails, the rollback
 * restores the PREVIOUS entry. It does not delete the key.
 *
 * Deleting reads as "no record", and no record renders as unchecked. So a
 * failed save while *unchecking* a box someone had genuinely completed erased
 * that completion from the screen. Their progress was still on the server and
 * they had no way to know it — the rational response is to redo work that was
 * already done. Restoring the previous value is the only rollback that is
 * actually an undo; `undefined` and `{ completed: false }` are different
 * states and this file keeps them different.
 *
 * The optimistic value is also reconciled against the server's answer rather
 * than assumed: `POST /api/courses/progress` reads the stored value back after
 * writing and returns it, so a write that landed differently from the request
 * corrects the UI instead of leaving it confidently wrong.
 */
@Component({
  selector: 'app-course-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatProgressBarModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
  ],
  templateUrl: './course-player.html',
  styleUrl: './course-player.scss',
})
export class CoursePlayer {
  private readonly service = inject(CoursesService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly courseId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('courseId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('courseId') ?? '' },
  );

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly course = signal<Course | null>(null);

  /**
   * Progress as a plain record, replaced wholesale on every change so OnPush
   * sees a new reference. `undefined` for a key means "never recorded", which
   * the rollback below depends on being distinguishable from `false`.
   */
  private readonly progress = signal<ProgressMap>({});

  protected readonly saveError = signal<string | null>(null);

  protected readonly title = computed(() => this.course()?.title ?? 'Course');
  protected readonly sections = computed(() => this.course()?.sections ?? []);

  protected readonly stats = computed(() => {
    let total = 0;
    let completed = 0;

    for (const section of this.sections()) {
      for (const subsection of section.subsections) {
        for (const checkbox of subsection.checkboxes) {
          total++;
          if (this.isChecked(section.id, subsection.id, checkbox.id)) completed++;
        }
      }
    }

    return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  });

  protected readonly progressLabel = computed(() => {
    const { completed, total } = this.stats();
    return `${completed} of ${total} complete`;
  });

  constructor() {
    effect(() => {
      void this.load(this.courseId());
    });
  }

  protected async load(courseId = this.courseId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.saveError.set(null);

    const result = await this.service.get(courseId);

    if (result.error) {
      // Cleared, not kept. A course tree rendered with an empty progress map
      // would claim nothing is finished, which is the same lie the rollback bug
      // told — just at load time instead of on a click.
      this.course.set(null);
      this.progress.set({});
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.course.set(result.data.course);
    this.progress.set(result.data.progress);
    this.loading.set(false);
  }

  protected isChecked(sectionId: string, subsectionId: string, checkboxId: string): boolean {
    return this.progress()[progressKey(sectionId, subsectionId, checkboxId)]?.completed ?? false;
  }

  protected completedIn(section: CourseSection, subsection: CourseSubsection): number {
    return subsection.checkboxes.filter((checkbox) =>
      this.isChecked(section.id, subsection.id, checkbox.id),
    ).length;
  }

  protected subsectionLabel(section: CourseSection, subsection: CourseSubsection): string {
    const total = subsection.checkboxes.length;
    if (total === 0) return 'No checklist';
    const done = this.completedIn(section, subsection);
    return done === total ? 'Complete' : `${done}/${total}`;
  }

  /** Split on blank lines, the way the source content is authored. */
  protected paragraphs(subsection: CourseSubsection): readonly string[] {
    return subsection.content.split('\n\n').filter((paragraph) => paragraph.trim().length > 0);
  }

  /**
   * Every video on a lesson, newest schema first and the old column as the
   * fallback.
   *
   * A lesson seeded before story 12.3 has a `loomId` and no video rows. It is
   * synthesised into the same shape here rather than handled as a separate
   * case in the template, so the list, the lazy loading and the titles all
   * behave identically whichever way the video is stored.
   */
  protected videosFor(subsection: CourseSubsection): readonly CourseVideo[] {
    if (subsection.videos.length > 0) return subsection.videos;
    const loomId = subsection.loomId;
    if (!loomId) return [];
    return [{ id: `loom:${loomId}`, provider: 'loom', externalId: loomId }];
  }

  /**
   * Which videos have been opened.
   *
   * "Call Recording Links" carries 35 recordings. Rendering 35 iframes at once
   * is minutes of network and a dead phone, so an iframe only exists once
   * someone asks for that recording. A one-video lesson is treated as already
   * open — making someone click twice to watch the only thing on the page
   * would be lazy loading applied where there is nothing to save.
   */
  private readonly openedVideos = signal<ReadonlySet<string>>(new Set());

  protected isVideoOpen(video: CourseVideo, total: number): boolean {
    if (!this.canPlayInline(video)) return false;
    return total === 1 || this.openedVideos().has(video.id);
  }

  /**
   * Whether this video plays in the page or opens elsewhere.
   *
   * Fathom is currently link-out: its embed URL answers 200 and allows
   * framing, but renders nothing. See `video-embed.ts` for the check that
   * established that.
   */
  protected canPlayInline(video: CourseVideo): boolean {
    return canEmbed(video.provider);
  }

  protected videoShareLink(video: CourseVideo): string {
    return videoShareUrl(video.provider, video.externalId);
  }

  protected openVideo(video: CourseVideo): void {
    this.openedVideos.update((current) => new Set(current).add(video.id));
  }

  protected videoLabel(video: CourseVideo, index: number, total: number): string {
    return videoTitle(video, index, total);
  }

  /**
   * The embed URL for one video.
   *
   * Percent-encoded, then bypassed. The id is validated server-side and is an
   * id by contract, but it is admin-entered free text, and an unencoded value
   * interpolated into a URL is how a "video id" becomes a different origin.
   */
  protected videoUrl(video: CourseVideo): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      videoEmbedUrl(video.provider, video.externalId),
    );
  }

  protected async toggle(
    section: CourseSection,
    subsection: CourseSubsection,
    checkbox: CourseCheckbox,
    completed: boolean,
  ): Promise<void> {
    const key = progressKey(section.id, subsection.id, checkbox.id);

    // Captured BEFORE the optimistic write. `undefined` here means the checkbox
    // has never been recorded, and that is a real state the rollback has to be
    // able to return to — see the class comment.
    const previous: ProgressEntry | undefined = this.progress()[key];

    this.write(key, { completed, completedAt: Date.now() });
    this.saveError.set(null);

    const result = await this.service.setProgress({
      courseId: this.courseId(),
      sectionId: section.id,
      subsectionId: subsection.id,
      checkboxId: checkbox.id,
      completed,
    });

    if (result.error) {
      this.restore(key, previous);
      this.saveError.set(
        `${result.error.message} That change has been undone — nothing was saved.`,
      );
      return;
    }

    // Reconcile against what is actually stored, not against the guess above.
    this.write(key, {
      completed: result.data.completed,
      completedAt: result.data.completedAt ?? undefined,
    });
  }

  private write(key: string, entry: ProgressEntry): void {
    this.progress.update((current) => ({ ...current, [key]: entry }));
  }

  /**
   * Puts the key back exactly as it was, INCLUDING removing it when there was
   * no entry before. Writing `{ completed: false }` instead would look right
   * and be wrong: it records a decision the user never made.
   */
  private restore(key: string, previous: ProgressEntry | undefined): void {
    this.progress.update((current) => {
      const next = { ...current };
      if (previous === undefined) {
        delete next[key];
      } else {
        next[key] = previous;
      }
      return next;
    });
  }
}
