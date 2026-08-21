'use client';

import { useState } from 'react';
import { Badge } from '../../ui';

export interface Creative {
  id: string;
  title: string;
  platform: 'facebook' | 'instagram' | 'google' | 'tiktok';
  format: 'image' | 'video' | 'carousel' | 'text';
  status: 'draft' | 'pending-approval' | 'approved' | 'rejected';
  thumbnail?: string;
  description?: string;
  submittedAt?: string;
}

export interface CreativeCardProps {
  creative: Creative;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onEdit?: (id: string) => void;
  onViewDetails?: (creative: Creative) => void;
}

const platformColors = {
  facebook: 'text-info',
  instagram: 'text-warn',
  google: 'text-accent',
  tiktok: 'text-danger',
};

const statusBadges = {
  'draft': { tone: 'neutral' as const, label: 'Draft' },
  'pending-approval': { tone: 'warn' as const, label: 'Pending' },
  'approved': { tone: 'ok' as const, label: 'Approved' },
  'rejected': { tone: 'danger' as const, label: 'Rejected' },
};

export function CreativeCard({
  creative,
  onApprove,
  onReject,
  onEdit,
  onViewDetails,
}: CreativeCardProps) {
  const [showActions, setShowActions] = useState(false);
  const statusInfo = statusBadges[creative.status];

  return (
    <div
      className="rounded-lg border border-line bg-surface lift overflow-hidden hover:border-line-strong transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-sunken flex items-center justify-center overflow-hidden">
        {creative.thumbnail ? (
          <img
            src={creative.thumbnail}
            alt={creative.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="text-3xl mb-2">
              {creative.format === 'video' && '▶'}
              {creative.format === 'image' && '🖼'}
              {creative.format === 'carousel' && '📸'}
              {creative.format === 'text' && '📝'}
            </div>
            <p className="text-xs text-ink-3 capitalize">{creative.format}</p>
          </div>
        )}

        {/* Platform badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`text-xs font-semibold px-2 py-1 rounded bg-surface/80 backdrop-blur ${platformColors[creative.platform]}`}
          >
            {creative.platform}
          </span>
        </div>

        {/* Status overlay on hover */}
        {showActions && creative.status === 'pending-approval' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2">
            {onApprove && (
              <button
                onClick={() => onApprove(creative.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-ok text-white hover:opacity-90 transition-opacity"
              >
                Approve
              </button>
            )}
            {onReject && (
              <button
                onClick={() => onReject(creative.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded bg-danger text-white hover:opacity-90 transition-opacity"
              >
                Reject
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-ink truncate">{creative.title}</h3>
          <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
        </div>

        {creative.description && (
          <p className="text-xs text-ink-2 line-clamp-2 mb-2">{creative.description}</p>
        )}

        {creative.submittedAt && (
          <p className="text-[11px] text-ink-3 mb-3">
            Submitted {new Date(creative.submittedAt).toLocaleDateString()}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(creative)}
              className="flex-1 px-2 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-ink hover:bg-surface transition-colors"
            >
              View
            </button>
          )}
          {onEdit && creative.status === 'draft' && (
            <button
              onClick={() => onEdit(creative.id)}
              className="flex-1 px-2 py-1.5 text-xs font-semibold rounded border border-line bg-raised text-ink hover:bg-surface transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
