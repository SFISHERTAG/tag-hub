import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { EmptyState, ErrorState, LoadingState, PageShell } from '../../../shared/ui';
import { AdminUsersService } from '../services/admin-users.service';
import type { AdminUsersDirectory, DirectoryUser, Group } from '../services/admin-users.model';
import { GroupCard } from './group-card/group-card';
import { NewGroupForm } from './new-group-form/new-group-form';
import { UserRow } from './user-row/user-row';

/**
 * Who holds which hat, and where hats come from.
 *
 * Two mechanisms share this screen because they are genuinely two mechanisms in
 * the data: a group writes the same claim to every member, and an individual
 * grant overrides that and detaches the user from their group. Rendering them
 * as one list would hide the thing an admin most needs to see — whether a
 * person's role comes from a group that is about to change under them.
 *
 * Every write is performed by the child that owns the form, and every one of
 * them reports back here so the whole directory is re-read. That is deliberate
 * and slightly wasteful: a claim write can cascade (an individual grant removes
 * a group membership, a group role change rewrites every member), so patching
 * one row locally would leave the rest of the screen describing a state that no
 * longer exists.
 */
@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDividerModule,
    PageShell,
    EmptyState,
    ErrorState,
    LoadingState,
    GroupCard,
    NewGroupForm,
    UserRow,
  ],
  templateUrl: './admin-users-page.html',
  styleUrl: './admin-users-page.scss',
})
export class AdminUsersPage {
  private readonly service = inject(AdminUsersService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly directory = signal<AdminUsersDirectory | null>(null);

  protected readonly users = computed<readonly DirectoryUser[]>(
    () => this.directory()?.users ?? [],
  );
  protected readonly groups = computed<readonly Group[]>(() => this.directory()?.groups ?? []);

  /**
   * The only users addable to a group, mirroring the one-group-at-a-time rule
   * the store enforces: adding someone already in a group silently removes them
   * from the old one, so offering them here would make that removal look like
   * an accident rather than a choice.
   */
  protected readonly ungrouped = computed(() => this.users().filter((user) => !user.groupId));

  private readonly managerEmailByEmail = computed(() => {
    const records = this.directory()?.csmRecords ?? [];
    return new Map(records.map((record) => [record.email, record.managerEmail]));
  });

  private readonly usersByUid = computed(
    () => new Map(this.users().map((user) => [user.uid, user])),
  );

  protected readonly countLabel = computed(
    () =>
      `${plural(this.users().length, 'user')} · ${plural(this.groups().length, 'group')}`,
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const result = await this.service.load();

    if (result.error) {
      // Cleared rather than kept. A stale directory rendered behind an error
      // is the one thing worse than no directory on a screen that decides who
      // can do what.
      this.directory.set(null);
      this.error.set(result.error.message);
      this.loading.set(false);
      return;
    }

    this.directory.set(result.data);
    this.loading.set(false);
  }

  /** Full records for a group's member uids, resolved against the directory. */
  protected membersOf(group: Group): readonly DirectoryUser[] {
    const byUid = this.usersByUid();
    return group.memberUids
      .map((uid) => byUid.get(uid))
      .filter((user): user is DirectoryUser => user !== undefined);
  }

  protected managerEmailFor(user: DirectoryUser): string | null {
    if (!user.email) return null;
    return this.managerEmailByEmail().get(user.email) ?? null;
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
