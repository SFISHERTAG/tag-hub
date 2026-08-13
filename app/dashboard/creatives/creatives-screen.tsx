'use client';

import { useState } from 'react';
import { Panel, Badge } from '../../ui';
import { CreativeCard, type Creative } from './creative-card';
import { CreativeApprovalModal } from '../modals/creative-approval-modal';

// Mock creatives data
const MOCK_CREATIVES: Creative[] = [
  {
    id: '1',
    title: 'Summer Campaign Hero',
    platform: 'facebook',
    format: 'video',
    status: 'pending-approval',
    description: '30-second hero video for summer campaign',
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    title: 'Product Showcase',
    platform: 'instagram',
    format: 'carousel',
    status: 'pending-approval',
    description: 'Carousel ad with 5 product photos',
    submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    title: 'Google Search Ad',
    platform: 'google',
    format: 'text',
    status: 'approved',
    description: 'Text ad for search campaign',
    submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    title: 'TikTok Trend Video',
    platform: 'tiktok',
    format: 'video',
    status: 'draft',
    description: 'Trend-following video content',
    submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    title: 'Instagram Story',
    platform: 'instagram',
    format: 'image',
    status: 'approved',
    description: 'Story format ad',
    submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    title: 'Facebook Catalog',
    platform: 'facebook',
    format: 'carousel',
    status: 'rejected',
    description: 'Product catalog carousel',
    submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function CreativesScreen() {
  const [creatives, setCreatives] = useState<Creative[]>(MOCK_CREATIVES);
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Creative['status'] | 'all'>('all');

  const filteredCreatives =
    filterStatus === 'all'
      ? creatives
      : creatives.filter((c) => c.status === filterStatus);

  const handleApprove = (id: string) => {
    setCreatives((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'approved' as const } : c
      )
    );
  };

  const handleReject = (id: string) => {
    setCreatives((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: 'rejected' as const } : c
      )
    );
  };

  const handleViewDetails = (creative: Creative) => {
    setSelectedCreative(creative);
    setShowModal(true);
  };

  const statusCounts = {
    all: creatives.length,
    draft: creatives.filter((c) => c.status === 'draft').length,
    'pending-approval': creatives.filter((c) => c.status === 'pending-approval')
      .length,
    approved: creatives.filter((c) => c.status === 'approved').length,
    rejected: creatives.filter((c) => c.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Creatives</h2>
          <p className="mt-1 text-sm text-ink-2">
            Manage and approve ad creatives across platforms
          </p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-accent-ink hover:opacity-90 transition-opacity">
          + New Creative
        </button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            'all',
            'draft',
            'pending-approval',
            'approved',
            'rejected',
          ] as const
        ).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              filterStatus === status
                ? 'bg-accent text-accent-ink'
                : 'bg-raised text-ink-2 hover:bg-surface'
            }`}
          >
            {status === 'all' ? 'All' : status.replace('-', ' ').charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
            <span className="ml-1.5 font-mono text-xs opacity-75">
              {statusCounts[status]}
            </span>
          </button>
        ))}
      </div>

      {/* Creatives Grid */}
      {filteredCreatives.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredCreatives.map((creative) => (
            <CreativeCard
              key={creative.id}
              creative={creative}
              onApprove={handleApprove}
              onReject={handleReject}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      ) : (
        <Panel title="No creatives">
          <div className="py-12 text-center">
            <p className="text-sm text-ink-2">
              {filterStatus === 'all'
                ? 'No creatives yet. Create your first creative to get started.'
                : `No ${filterStatus.replace('-', ' ')} creatives.`}
            </p>
          </div>
        </Panel>
      )}

      {/* Approval Modal */}
      {selectedCreative && (
        <CreativeApprovalModal
          creative={selectedCreative}
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedCreative(null);
          }}
          onApprove={() => {
            handleApprove(selectedCreative.id);
            setShowModal(false);
            setSelectedCreative(null);
          }}
          onReject={() => {
            handleReject(selectedCreative.id);
            setShowModal(false);
            setSelectedCreative(null);
          }}
        />
      )}
    </div>
  );
}
