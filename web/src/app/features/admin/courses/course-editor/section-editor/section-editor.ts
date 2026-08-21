import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ConfirmDialogService } from '../../../../../shared/ui';
import type { ApiResult } from '../../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../../services/admin-courses.service';
import type { CourseSection } from '../../../services/admin-courses.model';
import { SubsectionEditor } from '../subsection-editor/subsection-editor';

/**
 * One section of a course, and the lessons under it.
 *
 * Deleting is confirmed and the confirmation says what goes with it. The
 * endpoint cascades to every lesson and checklist item beneath the section, and
 * a checklist item is what other people's completion records are keyed against
 * — so "delete section" is not reversible by re-creating one with the same
 * name.
 */
@Component({
  selector: 'app-section-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    SubsectionEditor,
  ],
  templateUrl: './section-editor.html',
  styleUrl: './section-editor.scss',
})
export class SectionEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly courseId = input.required<string>();
  readonly section = input.required<CourseSection>();

  readonly changed = output<void>();

  protected readonly title = new FormControl('', { nonNullable: true });
  protected readonly newSubsectionTitle = new FormControl('', { nonNullable: true });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => this.title.setValue(this.section().title));
  }

  protected lessonCount(): string {
    const count = this.section().subsections.length;
    return `${count} ${count === 1 ? 'lesson' : 'lessons'}`;
  }

  protected async save(): Promise<void> {
    const title = this.title.value.trim();
    if (!title) {
      this.error.set('A section needs a title.');
      return;
    }
    await this.run(() => this.service.updateSection(this.courseId(), this.section().id, title));
  }

  protected async remove(): Promise<void> {
    const section = this.section();
    const confirmed = await this.confirmDialog.confirm({
      title: `Delete "${section.title}"?`,
      message: `Its ${this.lessonCount()} and every checklist item under them go with it. Completion records for those items are not recoverable by re-creating the section.`,
      confirmLabel: 'Delete section',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteSection(this.courseId(), section.id));
  }

  protected async addSubsection(): Promise<void> {
    const title = this.newSubsectionTitle.value.trim();
    if (!title) return;

    if (
      await this.run(() =>
        this.service.createSubsection(this.courseId(), this.section().id, title),
      )
    ) {
      this.newSubsectionTitle.setValue('');
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
