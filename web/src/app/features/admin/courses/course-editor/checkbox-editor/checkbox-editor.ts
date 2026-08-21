import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ConfirmDialogService } from '../../../../../shared/ui';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../../services/admin-courses.service';
import type { CourseCheckbox } from '../../../services/admin-courses.model';

/**
 * One checklist item.
 *
 * Deletion is confirmed even though it is a single short label, because a
 * checklist item is the key every learner's completion record is stored under.
 * Deleting one does not just remove a line from this editor; it removes the
 * thing that made someone's finished work legible. The legacy editor deleted it
 * on a single click of an "✕", which is exactly the affordance you give
 * something you can undo.
 */
@Component({
  selector: 'app-checkbox-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './checkbox-editor.html',
  styleUrl: './checkbox-editor.scss',
})
export class CheckboxEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly courseId = input.required<string>();
  readonly checkbox = input.required<CourseCheckbox>();

  readonly changed = output<void>();

  protected readonly label = new FormControl('', { nonNullable: true });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => this.label.setValue(this.checkbox().label));
  }

  protected async save(): Promise<void> {
    const label = this.label.value.trim();
    if (!label) {
      this.error.set('A checklist item needs a label.');
      return;
    }
    await this.run(() => this.service.updateCheckbox(this.courseId(), this.checkbox().id, label));
  }

  protected async remove(): Promise<void> {
    const checkbox = this.checkbox();
    const confirmed = await this.confirmDialog.confirm({
      title: 'Delete this checklist item?',
      message: `"${checkbox.label}" and everyone's completion record for it are removed.`,
      confirmLabel: 'Delete item',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteCheckbox(this.courseId(), checkbox.id));
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
