import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  Acknowledged,
  CourseDetail,
  CourseSummaryList,
  CreatedCheckbox,
  CreatedSection,
  CreatedSubsection,
  SubsectionUpdate,
} from './admin-courses.model';

const COURSES_URL = '/api/admin/courses';

const seg = (value: string): string => encodeURIComponent(value);

/**
 * Typed access to course authoring.
 *
 * Every write is scoped by `courseId` in the path even where the underlying id
 * is globally unique — a section, subsection or checkbox is only editable
 * through the course that owns it. That mirrors the endpoint, and it is the
 * same reasoning that made the FLOW `[scriptId]` fix necessary: an id in a
 * path that nothing checks against its parent turns the parent into
 * decoration.
 *
 * Nothing here reloads the tree after a write. The screen re-reads the course
 * instead, because a write returns only what it created and reconstructing the
 * tree locally would mean the editor's idea of the course and the server's
 * quietly diverging after the first failed call.
 */
@Injectable({ providedIn: 'root' })
export class AdminCoursesService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResult<CourseSummaryList>> {
    return firstValueFrom(this.api.get<CourseSummaryList>(COURSES_URL));
  }

  get(courseId: string): Promise<ApiResult<CourseDetail>> {
    return firstValueFrom(this.api.get<CourseDetail>(`${COURSES_URL}/${seg(courseId)}`));
  }

  updateCourse(
    courseId: string,
    title: string,
    description: string,
  ): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.patch<Acknowledged>(`${COURSES_URL}/${seg(courseId)}`, { title, description }),
    );
  }

  createSection(courseId: string, title: string): Promise<ApiResult<CreatedSection>> {
    return firstValueFrom(
      this.api.post<CreatedSection>(`${COURSES_URL}/${seg(courseId)}/sections`, { title }),
    );
  }

  updateSection(
    courseId: string,
    sectionId: string,
    title: string,
  ): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.patch<Acknowledged>(`${COURSES_URL}/${seg(courseId)}/sections/${seg(sectionId)}`, {
        title,
      }),
    );
  }

  deleteSection(courseId: string, sectionId: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.delete<Acknowledged>(`${COURSES_URL}/${seg(courseId)}/sections/${seg(sectionId)}`),
    );
  }

  createSubsection(
    courseId: string,
    sectionId: string,
    title: string,
  ): Promise<ApiResult<CreatedSubsection>> {
    return firstValueFrom(
      this.api.post<CreatedSubsection>(
        `${COURSES_URL}/${seg(courseId)}/sections/${seg(sectionId)}/subsections`,
        { title },
      ),
    );
  }

  updateSubsection(
    courseId: string,
    subsectionId: string,
    update: SubsectionUpdate,
  ): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.patch<Acknowledged>(
        `${COURSES_URL}/${seg(courseId)}/subsections/${seg(subsectionId)}`,
        { title: update.title, loomId: update.loomId, content: update.content },
      ),
    );
  }

  deleteSubsection(courseId: string, subsectionId: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.delete<Acknowledged>(
        `${COURSES_URL}/${seg(courseId)}/subsections/${seg(subsectionId)}`,
      ),
    );
  }

  createCheckbox(
    courseId: string,
    subsectionId: string,
    label: string,
  ): Promise<ApiResult<CreatedCheckbox>> {
    return firstValueFrom(
      this.api.post<CreatedCheckbox>(
        `${COURSES_URL}/${seg(courseId)}/subsections/${seg(subsectionId)}/checkboxes`,
        { label },
      ),
    );
  }

  updateCheckbox(
    courseId: string,
    checkboxId: string,
    label: string,
  ): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.patch<Acknowledged>(
        `${COURSES_URL}/${seg(courseId)}/checkboxes/${seg(checkboxId)}`,
        { label },
      ),
    );
  }

  deleteCheckbox(courseId: string, checkboxId: string): Promise<ApiResult<Acknowledged>> {
    return firstValueFrom(
      this.api.delete<Acknowledged>(
        `${COURSES_URL}/${seg(courseId)}/checkboxes/${seg(checkboxId)}`,
      ),
    );
  }
}
