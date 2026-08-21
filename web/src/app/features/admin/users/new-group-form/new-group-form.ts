import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HAT_LABELS, ROLES, ROLE_LIST, type Role } from '../../../../core/models/role.model';
import { AdminUsersService } from '../../services/admin-users.service';

/**
 * Creating a group.
 *
 * The location list is submitted as the raw typed text, not split here. The
 * server owns what separates two ids (app/api/admin/users/_locations.ts), and a
 * client that split it first would be a second opinion nobody reconciles — the
 * first person to paste a newline-separated list finds out which one wins.
 */
@Component({
  selector: 'app-new-group-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './new-group-form.html',
  styleUrl: './new-group-form.scss',
})
export class NewGroupForm {
  private readonly service = inject(AdminUsersService);

  readonly created = output<void>();

  protected readonly roles = ROLE_LIST;
  protected readonly roleLabels = HAT_LABELS;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    role: new FormControl<Role>(ROLES.TAG_CSM, { nonNullable: true }),
    locationsRaw: new FormControl('', { nonNullable: true }),
  });

  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /**
   * A group with no name is a row nobody can identify later, so the button is
   * disabled rather than the server left to reject it. Every other rule —
   * valid role, valid location ids — is checked server-side and reported here.
   */
  protected readonly canSubmit = computed(
    () => !this.pending() && (this.value().name ?? '').trim().length > 0,
  );

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.pending.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const result = await this.service.createGroup({
      name: raw.name.trim(),
      role: raw.role,
      locationsRaw: raw.locationsRaw,
    });

    this.pending.set(false);

    if (result.error) {
      this.error.set(result.error.message);
      return;
    }

    // Role is deliberately kept: creating several groups for the same hat is
    // the common case, and resetting it makes the second one a re-selection.
    this.form.patchValue({ name: '', locationsRaw: '' });
    this.created.emit();
  }
}
