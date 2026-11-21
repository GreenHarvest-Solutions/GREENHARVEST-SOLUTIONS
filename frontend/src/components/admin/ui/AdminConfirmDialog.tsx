'use client';

import React, { useState } from 'react';
import { AdminModal } from './AdminModal';

interface AdminConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isDestructive?: boolean;
  isSubmitting?: boolean;
}

export function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  requireReason = true,
  reasonPlaceholder = 'Please explain the reason for this administrative intervention...',
  isDestructive = true,
  isSubmitting = false,
}: AdminConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setError('A valid justification reason is mandatory for administrative auditing.');
      return;
    }
    setError('');
    await onConfirm(reason.trim());
    setReason('');
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Administrative Confirmation Required"
      icon={isDestructive ? 'fa-triangle-exclamation' : 'fa-circle-question'}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#286c00]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || (requireReason && !reason.trim())}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
              isDestructive
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                : 'bg-[#1f5400] hover:bg-[#173e00] text-white'
            }`}
          >
            {isSubmitting && <i className="fa-solid fa-spinner animate-spin text-xs" />}
            <span>{confirmLabel}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-700 [text-wrap:pretty]">
          {description}
        </p>

        {requireReason && (
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-1">
              Audit Reason / Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder={reasonPlaceholder}
              className="w-full bg-[#FCF9F8] border border-gray-200 rounded-xl p-3 text-xs text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#1f5400] focus:ring-1 focus:ring-[#1f5400]/20"
            />
            {error && (
              <p className="text-xs text-red-600 mt-1 font-semibold">{error}</p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">
              This entry is permanently logged to the system audit stream.
            </p>
          </div>
        )}
      </div>
    </AdminModal>
  );
}

