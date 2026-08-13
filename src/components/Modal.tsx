import React, { useEffect } from 'react';
import './Modal.css';

export interface ModalProps {
  isOpen: boolean;
  title: string;
  children?: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Modal Component
 * Reusable modal dialog with overlay and close functionality
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  title,
  children,
  onClose,
  actions,
  size = 'md',
}) => {
  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className={`modal modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>
          <button
            className="modal-close"
            onClick={onClose}
            aria-label="Close modal"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {actions && (
          <div className="modal-footer">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Creative Approval Modal
 * Specialized modal for reviewing and approving ad creatives
 */
interface CreativeApprovalModalProps {
  isOpen: boolean;
  creative?: {
    id: string;
    title: string;
    platform: string;
    format: string;
    color?: string;
    notes?: string;
  };
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isLoading?: boolean;
}

export const CreativeApprovalModal: React.FC<CreativeApprovalModalProps> = ({
  isOpen,
  creative,
  onClose,
  onApprove,
  onReject,
  isLoading = false,
}) => {
  if (!creative) return null;

  return (
    <Modal
      isOpen={isOpen}
      title={creative.title}
      onClose={onClose}
      size="lg"
      actions={
        <div className="modal-actions">
          <button
            className="btn success"
            onClick={() => onApprove?.(creative.id)}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Approve'}
          </button>
          <button
            className="btn danger"
            onClick={() => onReject?.(creative.id)}
            disabled={isLoading}
          >
            Request Changes
          </button>
        </div>
      }
    >
      <div className="creative-preview">
        <div
          className="preview-box"
          style={{ backgroundColor: creative.color || '#1e3a8a' }}
        >
          <span className="preview-text">
            {creative.platform} - {creative.format}
          </span>
        </div>
      </div>

      {creative.notes && (
        <div className="creative-section">
          <label className="creative-label">Notes</label>
          <p className="creative-notes">{creative.notes}</p>
        </div>
      )}
    </Modal>
  );
};

export default Modal;
