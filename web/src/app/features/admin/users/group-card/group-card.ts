import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ConfirmDialogService } from '../../../../shared/ui';
import type { ApiResult } from '../../../../core/models/api-result.model';
import { HAT_LABELS, ROLE_LIST, type Role } from '../../../../core/models/role.model';
import { AdminUsersService } from '../../services/admin-users.service';
import type { DirectoryUser, Group } from '../../services/admin-users.model';

/**
 * One group: its role, its locations, and who is in it.
 *
 * The card owns its own form state and its own in-flight flag rather than
 * receiving them, because there are as many of these on screen as there are
 * groups and a single shared "pending" would disable every card whenever any
 * one of them saved.
 *
 * Every successful write emits `changed` and the page re-reads the whole
 * directory. A group role change rewrites the claims of every member, so there
 * is no correct local patch — only a smaller lie.
 */
@Component({
  selector: 'app-group-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './group-card.html',
  styleUrl: './group-card.scss',
})
export class GroupCard {
  private readonly service = inject(AdminUsersService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly group = input.required<Group>();
  /** Full records for this group's member uids, resolved by the page. */
  readonly members = input.required<readonly DirectoryUser[]>();
  /** Users in no group — the only ones addable, per the one-group-at-a-time rule. */
  readonly ungrouped = input.required<readonly DirectoryUser[]>();

  readonly changed = output<void>();

  protected readonly roles = ROLE_LIST;
  protected readonly roleLabels = HAT_LABELS;

  protected readonly form = new FormGroup({
    role: new FormControl<Role>(ROLE_LIST[0], { nonNullable: true }),
    locationsRaw: new FormControl('', { nonNullable: true }),
  });

  protected readonly addUid = new FormControl('', { nonNullable: true });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);

  constructor() {
    // Reset from the input whenever the page re-reads the directory, so a save
    // by someone else does not leave this form showing the old values as if
    // they were still pending edits.
    effect(() => {
      const group = this.group();
      this.form.setValue({ role: group.role, locationsRaw: group.locations.join(', ') });
      this.saved.set(false);
    });

    // "Saved." must not outlive the state it describes. Any further edit is a
    // divergence from what was saved, so the confirmation goes away.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.saved.set(false));
  }

  protected memberLabel(user: DirectoryUser): string {
    return user.email ?? user.uid;
  }

  protected async save(): Promise<void> {
    if (this.pending()) return;
    await this.run(() =>
      this.service.updateGroup(this.group().id, this.form.getRawValue()),
    );
    if (!this.error()) this.saved.set(true);
  }

  protected async remove(): Promise<void> {
    const group = this.group();
    const confirmed = await this.confirmDialog.confirm({
      title: `Delete "${group.name}"?`,
      message:
        `${plural(group.memberUids.length, 'member')} will lose the role this group grants. ` +
        'Their individual grants, if any, are unaffected.',
      confirmLabel: 'Delete group',
      destructive: true,
    });
    if (!confirmed) return;

    await this.run(() => this.service.deleteGroup(group.id));
  }

  protected async addMember(): Promise<void> {
    const uid = this.addUid.value;
    if (!uid || this.pending()) return;

    await this.run(() => this.service.addMember(this.group().id, uid));
    if (!this.error()) this.addUid.setValue('');
  }

  protected async removeMember(uid: string): Promise<void> {
    await this.run(() => this.service.removeMember(this.group().id, uid));
  }

  /**
   * One in-flight write at a time, and the error surfaced rather than logged.
   *
   * The failure that matters here is a rejected location id: the endpoint turns
   * `InvalidLocationError` into a 400 naming the offending id, and swallowing
   * that would leave an admin retyping a list they cannot see is wrong.
   */
  private async run(write: () => Promise<ApiResult<unknown>>): Promise<void> {
    this.pending.set(true);
    this.error.set(null);

    const result = await write();
    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }

    this.changed.emit();
  }
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}
