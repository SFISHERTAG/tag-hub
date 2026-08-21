import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog } from './confirm-dialog';
import type { ConfirmDialogData } from './confirm-dialog.model';

/**
 * Story: the dialog closes with `true` for consent and `false` for everything
 * else, and the button order is not cosmetic.
 *
 * Cancel is first in the DOM because the dialog opens with autoFocus
 * 'first-tabbable' — so the safe answer holds the focus and the Enter key. A
 * destructive confirm button that starts focused turns a stray keypress into a
 * deletion.
 */

function setup(data: Partial<ConfirmDialogData> = {}) {
  const close = vi.fn();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [ConfirmDialog],
    providers: [
      provideZonelessChangeDetection(),
      { provide: MatDialogRef, useValue: { close } },
      { provide: MAT_DIALOG_DATA, useValue: { title: 'Remove access?', ...data } },
    ],
  });

  const fixture = TestBed.createComponent(ConfirmDialog);
  fixture.detectChanges();

  const host = fixture.nativeElement as HTMLElement;
  const buttons = Array.from(host.querySelectorAll('button'));

  return { fixture, host, close, cancelButton: buttons[0], confirmButton: buttons[1] };
}

describe('ConfirmDialog', () => {
  it('asks the question it was given', () => {
    const { host } = setup({ message: 'They lose access immediately.' });

    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Remove access?');
    expect(host.textContent).toContain('They lose access immediately.');
  });

  it('omits the body when there is only a title', () => {
    const { host } = setup();

    expect(host.querySelector('mat-dialog-content')).toBeNull();
  });

  it('closes with true when confirmed', () => {
    const { close, confirmButton } = setup();

    confirmButton?.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes with false when cancelled', () => {
    const { close, cancelButton } = setup();

    cancelButton?.click();

    expect(close).toHaveBeenCalledWith(false);
  });

  it('puts cancel first so the safe answer takes the focus', () => {
    const { cancelButton, confirmButton } = setup();

    expect(cancelButton?.textContent?.trim()).toBe('Cancel');
    expect(confirmButton?.textContent?.trim()).toBe('Confirm');
  });

  it('names the action when the caller does', () => {
    // "OK" makes the title the only thing between a tired person and an
    // irreversible write.
    const { confirmButton, cancelButton } = setup({
      confirmLabel: 'Delete client',
      cancelLabel: 'Keep it',
    });

    expect(confirmButton?.textContent?.trim()).toBe('Delete client');
    expect(cancelButton?.textContent?.trim()).toBe('Keep it');
  });

  it('paints the confirm button with the error tokens only when destructive', () => {
    // The M3 way: override the button's own component tokens on the host. No
    // ::ng-deep, no !important, no raw hex.
    expect(setup().confirmButton?.classList.contains('confirm-dialog__confirm--destructive')).toBe(
      false,
    );
    expect(
      setup({ destructive: true }).confirmButton?.classList.contains(
        'confirm-dialog__confirm--destructive',
      ),
    ).toBe(true);
  });
});
