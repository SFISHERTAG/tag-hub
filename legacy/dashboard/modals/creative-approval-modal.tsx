'use client';

import { useEffect } from 'react';
import { type Creative } from '../creatives/creative-card';
import { Badge, Panel } from '../../ui';
import { CloseIcon } from '../../icons';

export interface CreativeApprovalModalProps {
  creative: Creative;
  isOpen: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const platformLabels = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google Ads',
  tiktok: 'TikTok',
};

const formatLabels = {
  image: 'Image',
  video: 'Video',
  carousel: 'Carousel',
  text: 'Text',
};

export function CreativeApprovalModal({
  creative,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: CreativeApprovalModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-xl border border-line bg-surface lift pointer-events-auto shadow-lg">
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-line px-6 py-4 bg-surface">
            <div>
              <h2 className="text-lg font-semibold text-ink">{creative.title}</h2>
              <p className="text-xs text-ink-3 mt-0.5">
                Submitted {new Date(creative.submittedAt || '').toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex-shrink-0 p-2 text-ink-3 hover:text-ink transition-colors"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Preview */}
            <div className="rounded-lg border border-line bg-sunken aspect-video flex items-center justify-center overflow-hidden">
              {creative.thumbnail ? (
                <img
                  src={creative.thumbnail}
                  alt={creative.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center">
                  <div className="text-5xl mb-3">
                    {creative.format === 'video' && '▶'}
                    {creative.format === 'image' && '🖼'}
                    {creative.format === 'carousel' && '📸'}
                    {creative.format === 'text' && '📝'}
                  </div>
                  <p className="text-sm text-ink-3">No preview available</p>
                </div>
              )}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase mb-1">
                  Platform
                </p>
                <Badge tone="info">{platformLabels[creative.platform]}</Badge>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase mb-1">
                  Format
                </p>
                <Badge tone="neutral">{formatLabels[creative.format]}</Badge>
              </div>
            </div>

            {/* Description */}
            {creative.description && (
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase mb-2">
                  Description
                </p>
                <p className="text-sm text-ink-2 leading-relaxed">
                  {creative.description}
                </p>
              </div>
            )}

            {/* Approval Note Section (if pending) */}
            {creative.status === 'pending-approval' && (
              <div>
                <label htmlFor="approval-note" className="text-xs font-semibold text-ink-3 uppercase block mb-2">
                  Approval Notes
                </label>
                <textarea
                  id="approval-note"
                  placeholder="Add any notes or feedback..."
                  rows={3}
                  className="w-full rounded-lg border border-line bg-canvas p-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
              </div>
            )}

            {/* Status Info */}
            <div className="rounded-lg bg-raised p-3 border border-line">
              <p className="text-xs text-ink-3">
                Status:{' '}
                <span className="font-semibold text-ink capitalize">
                  {creative.status.replace('-', ' ')}
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 border-t border-line bg-surface px-6 py-4 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-md border border-line bg-raised text-ink hover:bg-surface transition-colors"
            >
              Cancel
            </button>

            {creative.status === 'pending-approval' && (
              <>
                <button
                  onClick={onReject}
                  className="px-4 py-2 text-sm font-semibold rounded-md border border-danger bg-danger-tint text-danger hover:bg-danger hover:text-white transition-colors"
                >
                  Request Changes
                </button>
                <button
                  onClick={onApprove}
                  className="px-4 py-2 text-sm font-semibold rounded-md bg-ok text-white hover:opacity-90 transition-opacity"
                >
                  Approve
                </button>
              </>
            )}

            {creative.status === 'approved' && (
              <div className="text-xs text-ok font-semibold">✓ Approved</div>
            )}

            {creative.status === 'rejected' && (
              <div className="text-xs text-danger font-semibold">✕ Changes Requested</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
