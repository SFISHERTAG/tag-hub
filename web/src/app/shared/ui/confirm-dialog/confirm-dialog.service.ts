import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from './confirm-dialog';
import type { ConfirmDialogData } from './confirm-dialog.model';

/**
 * One line at the call site:
 *
 *   if (!(await this.confirmDialog.confirm({ title: 'Remove access?' }))) return;
 *
 * The narrowing matters. MatDialogRef closes with `undefined` on a backdrop
 * click or Escape, and `if (await ref.afterClosed())` reads correctly today
 * and wrongly the moment someone flips it to `!== false`. Consent is `true`
 * and nothing else; every other outcome is a no.
 *
 * This is a UI confirmation, never an authorisation. The endpoint behind the
 * action re-checks the caller's session regardless of what was clicked here.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  async confirm(data: ConfirmDialogData): Promise<boolean> {
    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      width: '24rem',
      maxWidth: '92vw',
      // First tabbable is Cancel, and that is deliberate: the safe answer takes
      // the focus and the Enter key, not the destructive one.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });

    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }
}
