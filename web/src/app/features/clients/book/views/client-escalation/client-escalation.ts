import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ImpersonationService } from '../../../../../core/services/impersonation.service';
import {
  BUCKET_ORDER,
  bucketDisplay,
  checkInLabel,
  escalationSortRank,
} from '../../../services/client-status';
import type { ClientData, EscalationBucket } from '../../../services/client.model';

type EscalationSortKey = 'checkin' | 'health';

interface Bucket {
  readonly bucket: EscalationBucket;
  readonly title: string;
  readonly tone: string;
  readonly clients: readonly ClientData[];
}

/**
 * Who is ready to grow, who is at risk, who needs nothing right now.
 *
 * This is the destination `portfolio.routes.ts` redirects `?view=escalations`
 * to, and the reason it is a view of the book rather than its own screen: the
 * buckets are a field on ClientData, so a separate page would be a second fetch
 * of the same rows under a different name.
 *
 * Two changes from the reference implementation, both about not overstating
 * what we know:
 *
 * - The sort control that said "Stage" is called "Health". It always sorted by
 *   health status; the reference implementation's own comment admitted GHL
 *   pipeline stage is not wired into ClientData yet and health was standing in
 *   for it. A label that names the wrong field is a lie the reader cannot see.
 * - "Enter tenant" was a bare form POST with no in-flight state, so a double
 *   click wrote two impersonation audit entries. It is a disabled-while-pending
 *   button here, and a failure is shown rather than swallowed.
 */
@Component({
  selector: 'app-client-escalation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule],
  templateUrl: './client-escalation.html',
  styleUrl: './client-escalation.scss',
})
export class ClientEscalation {
  private readonly impersonation = inject(ImpersonationService);

  readonly clients = input.required<readonly ClientData[]>();

  protected readonly sortKey = signal<EscalationSortKey>('checkin');

  /** The tenant an entry is in flight for, so one click cannot become two. */
  protected readonly entering = signal<string | null>(null);
  protected readonly enterError = signal<string | null>(null);

  protected readonly currentLocationId = computed(
    () => this.impersonation.current()?.locationId ?? null,
  );

  protected readonly buckets = computed<readonly Bucket[]>(() => {
    const clients = this.clients();
    const key = this.sortKey();

    return BUCKET_ORDER.map((bucket) => {
      const display = bucketDisplay(bucket);
      return {
        bucket,
        title: display.title,
        tone: display.tone,
        clients: sortClients(
          clients.filter((client) => client.escalation.bucket === bucket),
          key,
        ),
      };
    });
  });

  /**
   * Takes `unknown` because `MatButtonToggleChange.value` is typed `any` by
   * Material, so strictTemplates has nothing to check at the binding. Narrowing
   * here is the only place the check can actually run.
   */
  protected setSort(value: unknown): void {
    this.sortKey.set(value === 'health' ? 'health' : 'checkin');
  }

  protected checkIn(client: ClientData): string {
    return checkInLabel(client.escalation.daysSinceLastCheckIn);
  }

  protected isCurrent(client: ClientData): boolean {
    return this.currentLocationId() === client.ghl_location_id;
  }

  /**
   * Nothing here is the access decision. `POST /api/impersonation/enter`
   * re-checks the hat, validates the location against the tenant registry and
   * writes the audit entry before it grants anything.
   */
  protected async enter(client: ClientData): Promise<void> {
    if (this.entering() !== null || this.isCurrent(client)) return;

    this.entering.set(client.ghl_location_id);
    this.enterError.set(null);

    const result = await this.impersonation.enter(client.ghl_location_id);
    this.entering.set(null);

    if (result.error) this.enterError.set(result.error.message);
  }
}

/**
 * Sorted copy, never in place. The input array belongs to the book's signal,
 * and mutating it would reorder a view the reader did not ask to reorder.
 *
 * Nulls sort last under `checkin`: "no check-in on record" is a fresh
 * onboarding, not the most overdue client in the book.
 */
function sortClients(
  clients: readonly ClientData[],
  key: EscalationSortKey,
): readonly ClientData[] {
  const sorted = [...clients];

  if (key === 'health') {
    sorted.sort(
      (a, b) => escalationSortRank(a.health.status) - escalationSortRank(b.health.status),
    );
    return sorted;
  }

  sorted.sort((a, b) => {
    const left = a.escalation.daysSinceLastCheckIn;
    const right = b.escalation.daysSinceLastCheckIn;
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });
  return sorted;
}
