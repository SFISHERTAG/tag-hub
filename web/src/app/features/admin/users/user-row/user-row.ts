import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HAT_LABELS, ROLES, ROLE_LIST, type Role } from '../../../../core/models/role.model';
import { AdminUsersService } from '../../services/admin-users.service';
import {
  SCOPE_LABELS,
  SCOPE_LEVELS,
  type DirectoryUser,
  type ScopeLevel,
} from '../../services/admin-users.model';

/** Hats that sit in the CS rollup and therefore need a reporting line. */
const REPORTS_TO_CSD: readonly Role[] = [ROLES.TAG_CSM, ROLES.TAG_CSD];

/**
 * One directory user, and the individual grant that overrides their group.
 *
 * An expansion panel rather than a table row with an inline form. The shared
 * DataTable renders text and links by contract — rows are deliberately not
 * interactive there — and bending it into hosting five form controls would
 * cost the keyboard semantics the panel gives for nothing.
 *
 * The reporting-line field appears only for the two hats that participate in
 * the CS rollup. That is cosmetic convenience: the endpoint ignores
 * `managerEmail` for every other role, and refuses a CS hat on a user with no
 * email on file BEFORE writing the claim — so a refusal here leaves the account
 * exactly as it was, rather than half-assigned.
 */
@Component({
  selector: 'app-user-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './user-row.html',
  styleUrl: './user-row.scss',
})
export class UserRow {
  private readonly service = inject(AdminUsersService);

  readonly user = input.required<DirectoryUser>();
  /** Current CS reporting line for this user's email, resolved by the page. */
  readonly managerEmail = input<string | null>(null);
  /**
   * The rest of the directory, for picking a team.
   *
   * A team is uids, and a uid is not something an admin can type or check. The
   * picker is what stops this being a field where a typo silently narrows
   * somebody's dashboard — the endpoint refuses an unresolvable uid, but a
   * resolvable *wrong* one it cannot catch.
   */
  readonly peers = input<readonly DirectoryUser[]>([]);

  readonly changed = output<void>();

  protected readonly roles = ROLE_LIST;
  protected readonly roleLabels = HAT_LABELS;
  protected readonly scopeLevels = SCOPE_LEVELS;
  protected readonly scopeLabels = SCOPE_LABELS;

  protected readonly form = new FormGroup({
    role: new FormControl<Role>(ROLES.CLIENT_CLOSER, { nonNullable: true }),
    locationsRaw: new FormControl('', { nonNullable: true }),
    managerEmail: new FormControl('', { nonNullable: true }),
    // '' is "role default", which is a real choice rather than an absent one:
    // clearing an override is how an admin undoes it without knowing what the
    // default is.
    scope: new FormControl<ScopeLevel | ''>('', { nonNullable: true }),
    team: new FormControl<string[]>([], { nonNullable: true }),
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saved = signal(false);

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** The team picker is only shown for a team scope, because nothing else stores one. */
  protected readonly picksTeam = computed(() => this.value().scope === 'team');

  /** Everyone but this user — resolveScope adds them to their own team already. */
  protected readonly teamOptions = computed(() =>
    this.peers().filter((peer) => peer.uid !== this.user().uid),
  );

  protected readonly reportsToCsd = computed(() => {
    const role = this.value().role;
    return role !== undefined && REPORTS_TO_CSD.includes(role);
  });

  protected readonly label = computed(() => {
    const user = this.user();
    return user.email ?? user.uid;
  });

  protected readonly roleLabel = computed(() => {
    const role = this.user().role;
    return role ? HAT_LABELS[role] : 'No role';
  });

  protected readonly groupLabel = computed(() => this.user().groupName ?? 'No group');

  /**
   * Seeds the form from the record. Called when the panel opens rather than in
   * an effect, so re-reading the directory mid-edit cannot overwrite what
   * someone is halfway through typing.
   */
  protected reset(): void {
    const user = this.user();
    this.form.setValue({
      role: user.role ?? ROLES.CLIENT_CLOSER,
      locationsRaw: user.locations.join(', '),
      managerEmail: this.managerEmail() ?? '',
      scope: user.scope ?? '',
      team: [...user.team],
    });
    this.error.set(null);
    this.saved.set(false);
  }

  protected async save(): Promise<void> {
    if (this.pending()) return;

    this.pending.set(true);
    this.error.set(null);
    this.saved.set(false);

    const raw = this.form.getRawValue();
    const manager = raw.managerEmail.trim();

    const result = await this.service.assignRole(this.user().uid, {
      role: raw.role,
      locationsRaw: raw.locationsRaw,
      // Sent from the directory record, never typed. An admin retyping an
      // address is an admin who can point the CS record at an account that
      // does not exist.
      email: this.user().email,
      managerEmail: REPORTS_TO_CSD.includes(raw.role) && manager ? manager : null,
      scope: raw.scope === '' ? null : raw.scope,
      // Sent only alongside a team scope. The endpoint refuses a team without
      // one, and sending a stale list the server would reject turns an
      // unrelated role change into an error.
      team: raw.scope === 'team' ? raw.team : null,
    });

    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }

    this.saved.set(true);
    this.changed.emit();
  }
}
