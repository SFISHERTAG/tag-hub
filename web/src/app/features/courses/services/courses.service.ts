import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import type {
  CourseCardList,
  CourseWithProgress,
  ProgressSaved,
  ProgressToggle,
} from './course.model';

const COURSES_URL = '/api/courses';
const PROGRESS_URL = `${COURSES_URL}/progress`;

/**
 * Typed access to the training endpoints.
 *
 * There is no uid anywhere in this file, and that is the point. Progress is
 * always the caller's own: the endpoint reads `session.uid` and offers no
 * parameter to override it, so "read someone else's completion record" is not
 * a request this client can even express.
 */
@Injectable({ providedIn: 'root' })
export class CoursesService {
  private readonly api = inject(ApiService);

  list(): Promise<ApiResult<CourseCardList>> {
    return firstValueFrom(this.api.get<CourseCardList>(COURSES_URL));
  }

  /** `courseId` accepts a slug or an id — the endpoint resolves either. */
  get(courseId: string): Promise<ApiResult<CourseWithProgress>> {
    return firstValueFrom(
      this.api.get<CourseWithProgress>(`${COURSES_URL}/${encodeURIComponent(courseId)}`),
    );
  }

  /**
   * Toggles one checklist item.
   *
   * Resolves with `{ data: null, error }` on failure rather than throwing, and
   * the caller must look at it: this is the call whose failure the screen rolls
   * back, and a rollback that never runs is worse than no optimistic update at
   * all.
   */
  setProgress(toggle: ProgressToggle): Promise<ApiResult<ProgressSaved>> {
    return firstValueFrom(this.api.post<ProgressSaved>(PROGRESS_URL, toggle));
  }
}
