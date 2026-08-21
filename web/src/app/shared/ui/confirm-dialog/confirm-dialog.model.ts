/** What a confirmation asks. Every field but `title` has a sensible default. */
export interface ConfirmDialogData {
  readonly title: string;
  /** The consequence, in one sentence. Say what happens, not "are you sure".  */
  readonly message?: string;
  /**
   * Name the action — "Delete client", "Revoke access". A button that says
   * "OK" makes the dialog's title the only thing standing between a tired
   * person and an irreversible write.
   */
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  /** Paints the confirm button with the error tokens. For destructive writes only. */
  readonly destructive?: boolean;
}
