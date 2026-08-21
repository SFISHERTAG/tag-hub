/**
 * The shared Material 3 primitives every feature screen is built from.
 *
 * One import path on purpose. Four feature stories land in parallel, and a
 * barrel is what stops each of them growing a private EmptyState with slightly
 * different words for the same nothing. If a screen needs a variant, add an
 * input here rather than a second component there.
 *
 *   import { PageShell, DataTable, type DataTableColumn } from '../../shared/ui';
 *
 * Nothing in here knows which features exist, reads a role, or makes an HTTP
 * call — shared/ must not, and eslint's no-restricted-imports enforces it.
 */
export { PageShell } from './page-shell/page-shell';
export { EmptyState } from './empty-state/empty-state';
export { ErrorState } from './error-state/error-state';
export { LoadingState, type LoadingVariant } from './loading-state/loading-state';
export { DataTable } from './data-table/data-table';
export type { DataTableColumn, DataTableSortMode } from './data-table/data-table.model';
export { ConfirmDialog } from './confirm-dialog/confirm-dialog';
export { ConfirmDialogService } from './confirm-dialog/confirm-dialog.service';
export type { ConfirmDialogData } from './confirm-dialog/confirm-dialog.model';
