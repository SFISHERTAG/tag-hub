import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DataTable, PageShell, type DataTableColumn } from '../../../shared/ui';
import { AdminCoursesService } from '../services/admin-courses.service';
import type { CourseSummary } from '../services/admin-courses.model';

/**
 * The course catalogue, as an author sees it.
 *
 * Read-only: creating a course is a seeding operation (lib/course/seed.ts) and
 * has no endpoint, so there is no button here pretending otherwise. A disabled
 * or dead "New course" control would be a promise the stack cannot keep.
 */
@Component({
  selector: 'app-admin-courses-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageShell, DataTable],
  templateUrl: './admin-courses-page.html',
  styleUrl: './admin-courses-page.scss',
})
export class AdminCoursesPage {
  private readonly service = inject(AdminCoursesService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly courses = signal<readonly CourseSummary[]>([]);

  protected readonly countLabel = computed(() => {
    const count = this.courses().length;
    return `${count} ${count === 1 ? 'course' : 'courses'}`;
  });

  protected readonly columns: readonly DataTableColumn<CourseSummary>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (course) => course.title,
      sortable: true,
      link: (course) => ['/admin/courses', course.id],
    },
    {
      key: 'description',
      header: 'Description',
      cell: (course) => course.description || 'No description',
    },
    { key: 'slug', header: 'Slug', cell: (course) => course.slug, sortable: true },
  ];

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
}
