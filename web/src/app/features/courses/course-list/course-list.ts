import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { CoursesService } from '../services/courses.service';
import type { CourseCard } from '../services/course.model';

/**
 * The training catalogue.
 *
 * Cards linked by a real anchor, not a clickable div. Each is a navigation to a
 * page a learner will want to open in a background tab and come back to, and an
 * anchor is the only thing that supports that without reimplementing it.
 *
 * `subsectionCount` is summed server-side; this screen never receives the
 * section trees it would need to count them, which keeps the list cheap.
 */
@Component({
  selector: 'app-course-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, PageShell, EmptyState, ErrorState, LoadingState],
  templateUrl: './course-list.html',
  styleUrl: './course-list.scss',
})
export class CourseList {
  private readonly service = inject(CoursesService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<readonly CourseCard[]>([]);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.list();

    if (result.error) {
      this.courses.set([]);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.courses.set(result.data.courses);
    this.loading.set(false);
  }

  protected lessonLabel(course: CourseCard): string {
    const count = course.subsectionCount;
    return `${count} ${count === 1 ? 'lesson' : 'lessons'}`;
  }
}
