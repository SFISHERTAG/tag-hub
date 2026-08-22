import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfirmDialogService } from '../../../../../shared/ui';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../../services/admin-courses.service';
import type { CourseSubsection, CourseVideo } from '../../../services/admin-courses.model';
import { CheckboxEditor } from '../checkbox-editor/checkbox-editor';
import { DocEditor } from '../doc-editor/doc-editor';
import { VideoEditor } from '../video-editor/video-editor';

/**
 * One lesson: its title, its Loom video, its body copy, and the checklist a
 * learner ticks off.
 *
 * The Loom field takes an id, not a URL, because that is what the viewer
 * interpolates into the embed src. Naming the field for what it holds is the
 * cheapest way to stop a pasted share link ending up in an iframe URL.
 */
@Component({
  selector: 'app-subsection-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    CheckboxEditor,
    VideoEditor,
    DocEditor,
  ],
  templateUrl: './subsection-editor.html',
  styleUrl: './subsection-editor.scss',
})
export class SubsectionEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly courseId = input.required<string>();
  readonly subsection = input.required<CourseSubsection>();

  readonly changed = output<void>();

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    loomId: new FormControl('', { nonNullable: true }),
    content: new FormControl('', { nonNullable: true }),
  });

  protected readonly newCheckboxLabel = new FormControl('', { nonNullable: true });

  protected readonly newVideoLink = new FormControl('', { nonNullable: true });
  protected readonly newDocLabel = new FormControl('', { nonNullable: true });
  protected readonly newDocUrl = new FormControl('', { nonNullable: true });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const subsection = this.subsection();
      this.form.setValue({
        title: subsection.title,
        loomId: subsection.loomId ?? '',
        content: subsection.content,
      });
    });
  }

  protected async save(): Promise<void> {
    const raw = this.form.getRawValue();
    if (!raw.title.trim()) {
      this.error.set('A lesson needs a title.');
      return;
    }

    await this.run(() =>
      this.service.updateSubsection(this.courseId(), this.subsection().id, {
        title: raw.title.trim(),
        loomId: raw.loomId.trim(),
        content: raw.content,
      }),
    );
  }

  protected async remove(): Promise<void> {
    const subsection = this.subsection();
    const count = subsection.checkboxes.length;
    const confirmed = await this.confirmDialog.confirm({
      title: `Delete "${subsection.title}"?`,
      message:
        count === 0
          ? 'This lesson has no checklist items.'
          : `Its ${count} checklist ${count === 1 ? 'item goes' : 'items go'} with it, along with everyone's completion record for them.`,
      confirmLabel: 'Delete lesson',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteSubsection(this.courseId(), subsection.id));
  }

  protected async addCheckbox(): Promise<void> {
    const label = this.newCheckboxLabel.value.trim();
    if (!label) return;

    if (
      await this.run(() =>
        this.service.createCheckbox(this.courseId(), this.subsection().id, label),
      )
    ) {
      this.newCheckboxLabel.setValue('');
    }
  }

  /**
   * Adds a video from a pasted share URL.
   *
   * No provider is sent: the server recognises Loom, Fathom and Drive links by
   * shape, and asking someone to classify a link they just copied is a step
   * that only exists to be got wrong. The provider select on an existing row
   * is for the rarer case of typing a bare id.
   */
  protected async addVideo(): Promise<void> {
    const link = this.newVideoLink.value.trim();
    if (!link) return;

    if (
      await this.run(() =>
        this.service.createVideo(this.courseId(), this.subsection().id, { link }),
      )
    ) {
      this.newVideoLink.setValue('');
    }
  }

  /**
   * Moves one video and sends the resulting order in full.
   *
   * The list is rebuilt locally only to compute the new order; the screen is
   * re-read from the server afterwards like every other write here, so a
   * rejected reorder does not leave the editor showing an order the database
   * does not have.
   */
  protected async moveVideo(video: CourseVideo, direction: -1 | 1): Promise<void> {
    const videos = [...this.subsection().videos];
    const from = videos.findIndex((candidate) => candidate.id === video.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= videos.length) return;

    const [moved] = videos.splice(from, 1);
    videos.splice(to, 0, moved);

    await this.run(() =>
      this.service.reorderVideos(
        this.courseId(),
        this.subsection().id,
        videos.map((candidate) => candidate.id),
      ),
    );
  }

  protected async addDoc(): Promise<void> {
    const label = this.newDocLabel.value.trim();
    const url = this.newDocUrl.value.trim();
    if (!label || !url) return;

    if (
      await this.run(() =>
        this.service.createDoc(this.courseId(), this.subsection().id, { label, url }),
      )
    ) {
      this.newDocLabel.setValue('');
      this.newDocUrl.setValue('');
    }
  }

  private async run(call: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    if (this.pending()) return false;

    this.pending.set(true);
    this.error.set(null);

    const result = await call();
    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return false;
    }

    this.changed.emit();
    return true;
  }
}
