import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ConfirmDialogService } from '../../../../../shared/ui';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../../services/admin-courses.service';
import type { CourseDoc } from '../../../services/admin-courses.model';

/**
 * One reference link on a lesson.
 *
 * A doc is rendered as an anchor rather than an iframe, so the URL is stored
 * whole rather than parsed to an id. The server still rejects anything that is
 * not http or https — the scheme is the only real control on a link someone
 * else will click.
 */
@Component({
  selector: 'app-doc-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './doc-editor.html',
  styleUrl: './doc-editor.scss',
})
export class DocEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly courseId = input.required<string>();
  readonly doc = input.required<CourseDoc>();

  readonly changed = output<void>();

  protected readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true }),
    url: new FormControl('', { nonNullable: true }),
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const doc = this.doc();
      this.form.setValue({ label: doc.label, url: doc.url });
    });
  }

  protected async save(): Promise<void> {
    const raw = this.form.getRawValue();
    if (!raw.label.trim()) {
      this.error.set('A reference link needs a label.');
      return;
    }
    if (!raw.url.trim()) {
      this.error.set('A reference link needs a URL.');
      return;
    }

    await this.run(() =>
      this.service.updateDoc(this.courseId(), this.doc().id, {
        label: raw.label.trim(),
        url: raw.url.trim(),
      }),
    );
  }

  protected async remove(): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: 'Remove this reference link?',
      message: `"${this.doc().label}" is removed from the lesson. The document itself is untouched.`,
      confirmLabel: 'Remove link',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteDoc(this.courseId(), this.doc().id));
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
