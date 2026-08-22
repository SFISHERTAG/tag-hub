import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogService } from '../../../../../shared/ui';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../../services/admin-courses.service';
import type { CourseVideo, VideoProvider } from '../../../services/admin-courses.model';

const PROVIDERS: readonly { value: VideoProvider; label: string }[] = [
  { value: 'loom', label: 'Loom' },
  { value: 'fathom', label: 'Fathom' },
  { value: 'drive', label: 'Google Drive' },
];

/**
 * One video on a lesson.
 *
 * The field takes a full share URL as readily as a bare id, and the server
 * parses it. That is the opposite of the old single-Loom field, which asked
 * for "the id, not the whole URL" and quietly stored whatever it was given —
 * a pasted URL there produced an embed src pointing at a URL inside a URL, and
 * the lesson rendered a blank player with no error anywhere.
 *
 * Reordering moves one row at a time, but sends the whole resulting order, so
 * a failed request cannot leave two videos sharing a position.
 */
@Component({
  selector: 'app-video-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './video-editor.html',
  styleUrl: './video-editor.scss',
})
export class VideoEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly courseId = input.required<string>();
  readonly video = input.required<CourseVideo>();
  readonly first = input(false);
  readonly last = input(false);

  readonly changed = output<void>();
  readonly move = output<-1 | 1>();

  protected readonly providers = PROVIDERS;

  protected readonly form = new FormGroup({
    provider: new FormControl<VideoProvider>('loom', { nonNullable: true }),
    link: new FormControl('', { nonNullable: true }),
    label: new FormControl('', { nonNullable: true }),
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const video = this.video();
      this.form.setValue({
        provider: video.provider,
        link: video.externalId,
        label: video.label ?? '',
      });
    });
  }

  protected async save(): Promise<void> {
    const raw = this.form.getRawValue();
    if (!raw.link.trim()) {
      this.error.set('Paste the share URL, or give the id on its own.');
      return;
    }

    await this.run(() =>
      this.service.updateVideo(this.courseId(), this.video().id, {
        link: raw.link.trim(),
        provider: raw.provider,
        label: raw.label.trim() || undefined,
      }),
    );
  }

  protected async remove(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove this video?',
      message: 'The lesson keeps its other videos. The recording itself is not deleted.',
      confirmLabel: 'Remove video',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteVideo(this.courseId(), this.video().id));
  }

  private async run(call: () => Promise<ApiResult<unknown>>): Promise<void> {
    if (this.pending()) return;

    this.pending.set(true);
    this.error.set(null);

    const result = await call();
    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }

    this.changed.emit();
  }
}
