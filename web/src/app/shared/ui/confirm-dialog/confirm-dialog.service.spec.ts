import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ConfirmDialogService } from './confirm-dialog.service';
import { ConfirmDialog } from './confirm-dialog';

/**
 * Story: the narrowing is the entire value of this service.
 *
 * MatDialogRef closes with `undefined` on Escape or a backdrop click. Callers
 * that write `if (await ref.afterClosed())` are correct today and wrong the
 * moment someone reaches for `!== false`, and the failure mode is a destructive
 * action running because a dialog was dismissed. Consent is `true` and nothing
 * else.
 */

const open = vi.fn();

function setup(closedWith: boolean | undefined) {
  open.mockReturnValue({ afterClosed: () => of(closedWith) });

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: MatDialog, useValue: { open } }],
  });

  return TestBed.inject(ConfirmDialogService);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConfirmDialogService', () => {
  it('resolves true only when the dialog was confirmed', async () => {
    await expect(setup(true).confirm({ title: 'Remove access?' })).resolves.toBe(true);
  });

  it('treats an explicit cancel as a no', async () => {
    await expect(setup(false).confirm({ title: 'Remove access?' })).resolves.toBe(false);
  });

  it('treats a dismissal as a no', async () => {
    // Escape or a backdrop click closes with undefined. A dismissed dialog is
    // not consent.
    await expect(setup(undefined).confirm({ title: 'Remove access?' })).resolves.toBe(false);
  });

  it('opens the confirm dialog with the caller data', async () => {
    const service = setup(true);
    const data = { title: 'Delete client', confirmLabel: 'Delete', destructive: true };

    await service.confirm(data);

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0]).toBe(ConfirmDialog);
    expect(open.mock.calls[0][1].data).toEqual(data);
  });

  it('lets the focus land on the safe option', async () => {
    const service = setup(true);

    await service.confirm({ title: 'Delete client', destructive: true });

    // 'first-tabbable' is Cancel, which is why Cancel is first in the template.
    expect(open.mock.calls[0][1].autoFocus).toBe('first-tabbable');
  });
});
