import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../../shared/ui';
import type { ApiResult } from '../../../../core/models/api-result.model';
import { AdminCoursesService } from '../../services/admin-courses.service';
import type { Course } from '../../services/admin-courses.model';
import { SectionEditor } from './section-editor/section-editor';

/**
 * Authoring one course: its title and description, then the section → lesson →
 * checklist tree beneath it.
 *
 * Every write is followed by a re-read of the whole course rather than a local
 * patch, and that is the shape of this screen rather than an oversight. The
 * write endpoints return only the id they created; a delete cascades to
 * children the client cannot see. Reconstructing the tree here would produce an
 * editor whose idea of the course diverges from the stored one the first time a
 * call fails halfway — and this is content other people's onboarding progress
 * is keyed against.
 */
@Component({
  selector: 'app-course-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
    SectionEditor,
  ],
  templateUrl: './course-editor.html',
  styleUrl: './course-editor.scss',
})
export class CourseEditor {
  private readonly service = inject(AdminCoursesService);
  private readonly route = inject(ActivatedRoute);

  /** From the paramMap stream: the router reuses this component across ids. */
  protected readonly courseId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('courseId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('courseId') ?? '' },
  );

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly course = signal<Course | null>(null);

  protected readonly meta = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
  });

  protected readonly newSectionTitle = new FormControl('', { nonNullable: true });

  protected readonly pending = signal(false);
  protected readonly writeError = signal<string | null>(null);
  protected readonly metaSaved = signal(false);

  protected readonly heading = computed(() => this.course()?.title ?? 'Course');
  protected readonly sections = computed(() => this.course()?.sections ?? []);

  constructor() {
    effect(() => {
      void this.load(this.courseId());
    });
  }

  protected async load(courseId = this.courseId()): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.get(courseId);

    if (result.error) {
      this.course.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.course.set(result.data.course);
    this.meta.setValue({
      title: result.data.course.title,
      description: result.data.course.description,
    });
    this.loading.set(false);
  }

  /** Re-reads without the skeleton, so a save does not blank the tree being edited. */
  protected async refresh(): Promise<void> {
    const result = await this.service.get(this.courseId());
    if (result.error) {
      this.writeError.set(result.error.message);
      return;
    }
    this.course.set(result.data.course);
  }

  protected async saveMeta(): Promise<void> {
    if (this.pending()) return;

    const { title, description } = this.meta.getRawValue();
    const saved = await this.write(() =>
      this.service.updateCourse(this.courseId(), title.trim(), description.trim()),
    );
    this.metaSaved.set(saved);
  }

  protected async addSection(): Promise<void> {
    const title = this.newSectionTitle.value.trim();
    if (!title || this.pending()) return;

    if (await this.write(() => this.service.createSection(this.courseId(), title))) {
      this.newSectionTitle.setValue('');
    }
  }

  private async write(call: () => Promise<ApiResult<unknown>>): Promise<boolean> {
    this.pending.set(true);
    this.writeError.set(null);
    this.metaSaved.set(false);

    const result = await call();

    if (result.error) {
      this.pending.set(false);
      this.writeError.set(result.error.message);
      return false;
    }

    await this.refresh();
    this.pending.set(false);
    return true;
  }
}
