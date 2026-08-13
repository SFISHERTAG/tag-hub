'use client';

import { Badge } from '../../ui';

export interface FileResource {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'sheet' | 'image' | 'video' | 'folder';
  size?: string;
  modifiedAt: string;
  sharedWith?: string[];
  category?: 'guide' | 'template' | 'report' | 'asset' | 'other';
}

export interface FileItemProps {
  file: FileResource;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onDelete?: (id: string) => void;
  onOpen?: (file: FileResource) => void;
}

const fileTypeIcons = {
  pdf: '📄',
  doc: '📋',
  sheet: '📊',
  image: '🖼',
  video: '🎥',
  folder: '📁',
};

const categoryColors = {
  guide: 'info',
  template: 'accent',
  report: 'ok',
  asset: 'warn',
  other: 'neutral',
} as const;

export function FileItem({
  file,
  onDownload,
  onShare,
  onDelete,
  onOpen,
}: FileItemProps) {
  return (
    <div
      className="rounded-lg border border-line bg-surface p-3 hover:border-line-strong transition-colors cursor-pointer group"
      onClick={() => onOpen?.(file)}
    >
      {/* Header with Icon and Name */}
      <div className="flex items-start gap-3 mb-2">
        <div className="text-2xl flex-shrink-0">{fileTypeIcons[file.type]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink truncate group-hover:text-accent transition-colors">
            {file.name}
          </p>
          <p className="text-xs text-ink-3 mt-0.5">
            {file.size && <span>{file.size} • </span>}
            {new Date(file.modifiedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Category Badge */}
      {file.category && (
        <div className="mb-2">
          <Badge tone={categoryColors[file.category] as any}>
            {file.category.charAt(0).toUpperCase() + file.category.slice(1)}
          </Badge>
        </div>
      )}

      {/* Shared With */}
      {file.sharedWith && file.sharedWith.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-ink-3">
            Shared with {file.sharedWith.length} person{file.sharedWith.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-line">
        {onDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload(file.id);
            }}
            className="flex-1 px-2 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-ink hover:bg-surface transition-colors"
          >
            Download
          </button>
        )}
        {onShare && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare(file.id);
            }}
            className="flex-1 px-2 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-ink hover:bg-surface transition-colors"
          >
            Share
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(file.id);
            }}
            className="flex-1 px-2 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-danger hover:bg-danger-tint transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
