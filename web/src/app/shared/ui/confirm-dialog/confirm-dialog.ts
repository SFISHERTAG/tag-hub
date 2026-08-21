import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import type { ConfirmDialogData } from './confirm-dialog.model';

/**
 * Yes or no, and nothing else.
 *
 * Opened through ConfirmDialogService rather than directly, so no caller has to
 * remember that a dismissed dialog closes with `undefined` — the service
 * narrows that to `false`. A backdrop click is not consent.
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialog, boolean>>(MatDialogRef);

  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  protected readonly confirmLabel = this.data.confirmLabel ?? 'Confirm';
  protected readonly cancelLabel = this.data.cancelLabel ?? 'Cancel';
  protected readonly destructive = this.data.destructive === true;

  protected confirm(): void {
    this.dialogRef.close(true);
  }

  protected cancel(): void {
    this.dialogRef.close(false);
  }
}
