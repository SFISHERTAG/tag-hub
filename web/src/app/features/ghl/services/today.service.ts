import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import type { ApiResult } from '../../../core/models/api-result.model';
import { appointmentPath, locationBase } from './ghl-endpoints';
import type {
  DayKey,
  MarkAppointmentRequest,
  MarkAppointmentResponse,
  TodayResponse,
} from './ghl.model';

/**
 * The closer's day: appointments, calendars, and the outcome summary.
 *
 * The day window is resolved server-side in the tenant's zone, which is why the
 * request sends a key ('yesterday' | 'today' | 'tomorrow') rather than a date
 * range. A browser-computed range would be the viewer's midnight, not the
 * client's, and an evening appointment would fall on the wrong day for anyone
 * east or west of the tenant.
 *
 * Show rate is likewise not computed here. It is returned already bounded, and
 * `null` means the outcome store was unreadable — a state this layer passes
 * through untouched so the screen can say so instead of rendering a zero.
 */
@Injectable({ providedIn: 'root' })
export class TodayService {
  private readonly api = inject(ApiService);

  day(locationId: string, day: DayKey): Promise<ApiResult<TodayResponse>> {
    return firstValueFrom(
      this.api.get<TodayResponse>(`${locationBase(locationId)}/today`, { day }),
    );
  }

  /**
   * Marks an outcome. `startTime`/`endTime` travel with it because they decide
   * the timing classification (pre-call DQ vs on-call DQ), which GHL has no
   * concept of and which sits on opposite sides of a show-rate calculation.
   */
  mark(
    locationId: string,
    appointmentId: string,
    body: MarkAppointmentRequest,
  ): Promise<ApiResult<MarkAppointmentResponse>> {
    return firstValueFrom(
      this.api.put<MarkAppointmentResponse>(
        appointmentPath(locationId, appointmentId, 'status'),
        body,
      ),
    );
  }
}
