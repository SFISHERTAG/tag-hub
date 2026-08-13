'use client';

import { useState } from 'react';
import { Panel, Fold } from '../../ui';
import { FileItem, type FileResource } from './file-item';

// Mock resources data
const MOCK_RESOURCES: FileResource[] = [
  {
    id: '1',
    name: 'Campaign Strategy Guide',
    type: 'pdf',
    size: '2.4 MB',
    modifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'guide',
    sharedWith: ['sales@acme.com', 'marketing@acme.com'],
  },
  {
    id: '2',
    name: 'Ad Creative Template',
    type: 'doc',
    size: '1.1 MB',
    modifiedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'template',
    sharedWith: ['creative@acme.com'],
  },
  {
    id: '3',
    name: 'Q3 Performance Report',
    type: 'sheet',
    size: '856 KB',
    modifiedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'report',
  },
  {
    id: '4',
    name: 'Brand Assets Folder',
    type: 'folder',
    modifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'asset',
    sharedWith: ['design@acme.com'],
  },
  {
    id: '5',
    name: 'Product Demo Video',
    type: 'video',
    size: '125 MB',
    modifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'asset',
  },
  {
    id: '6',
    name: 'Campaign Budget Spreadsheet',
    type: 'sheet',
    size: '342 KB',
    modifiedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'other',
  },
  {
    id: '7',
    name: 'Client Onboarding Checklist',
    type: 'doc',
    size: '234 KB',
    modifiedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'guide',
  },
  {
    id: '8',
    name: 'Social Media Graphics',
    type: 'image',
    size: '4.2 MB',
    modifiedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'asset',
    sharedWith: ['social@acme.com', 'marketing@acme.com'],
  },
];

export function ResourcesScreen() {
  const [resources, setResources] = useState<FileResource[]>(MOCK_RESOURCES);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | 'all'>('all');

  const filteredResources = resources.filter((r) => {
    const matchesSearch = r.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      filterCategory === 'all' || r.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(
    new Set(resources.map((r) => r.category).filter(Boolean))
  ) as string[];

  const handleDownload = (id: string) => {
    const file = resources.find((r) => r.id === id);
    if (file) {
      // Simulate download
      console.log('Downloading:', file.name);
    }
  };

  const handleShare = (id: string) => {
    const file = resources.find((r) => r.id === id);
    if (file) {
      console.log('Sharing:', file.name);
      // Could open a share modal
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this resource?')) {
      setResources((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleOpen = (file: FileResource) => {
    console.log('Opening:', file.name);
  };

  const recentResources = resources.sort(
    (a, b) =>
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Resources</h2>
          <p className="mt-1 text-sm text-ink-2">
            Documents, templates, and assets for campaigns
          </p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold rounded-md bg-accent text-accent-ink hover:opacity-90 transition-opacity">
          + Upload
        </button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div>
          <input
            type="text"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
              filterCategory === 'all'
                ? 'bg-accent text-accent-ink'
                : 'bg-raised text-ink-2 hover:bg-surface'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors capitalize ${
                filterCategory === cat
                  ? 'bg-accent text-accent-ink'
                  : 'bg-raised text-ink-2 hover:bg-surface'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Resources Grid */}
      {filteredResources.length > 0 ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filteredResources.map((resource) => (
            <FileItem
              key={resource.id}
              file={resource}
              onDownload={handleDownload}
              onShare={handleShare}
              onDelete={handleDelete}
              onOpen={handleOpen}
            />
          ))}
        </div>
      ) : (
        <Panel title="No resources found">
          <div className="py-12 text-center">
            <p className="text-sm text-ink-2">
              {searchTerm || filterCategory !== 'all'
                ? 'No resources match your search.'
                : 'No resources available yet.'}
            </p>
          </div>
        </Panel>
      )}

      {/* Recent Activity */}
      <Fold title="Recently Modified" defaultOpen={true}>
        <div className="space-y-2">
          {recentResources.slice(0, 5).map((resource) => (
            <div
              key={resource.id}
              className="flex items-center justify-between gap-3 p-2 rounded hover:bg-raised transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span>{resource.type === 'folder' ? '📁' : resource.type === 'video' ? '🎥' : resource.type === 'pdf' ? '📄' : '📋'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-ink truncate">
                    {resource.name}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {new Date(resource.modifiedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(resource.id)}
                className="flex-shrink-0 px-2 py-1 text-xs font-semibold rounded border border-line text-ink hover:bg-raised transition-colors"
              >
                Get
              </button>
            </div>
          ))}
        </div>
      </Fold>
    </div>
  );
}
