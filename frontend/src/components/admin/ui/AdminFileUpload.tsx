'use client';

import React, { useRef, useState } from 'react';

interface AdminFileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSizeMb?: number;
  label?: string;
  helperText?: string;
}

export function AdminFileUpload({
  onFileSelect,
  accept = 'image/*,application/pdf',
  maxSizeMb = 5,
  label = 'Upload Supporting Document',
  helperText = 'PNG, JPG, or PDF up to 5 MB',
}: AdminFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`File size exceeds maximum allowed size of ${maxSizeMb} MB`);
      return;
    }
    setError(null);
    setSelectedFileName(file.name);
    onFileSelect(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-bold text-gray-800">
          {label}
        </label>
      )}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 hover:border-[#1f5400] bg-[#FCF9F8] rounded-xl p-6 text-center cursor-pointer transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          aria-label={label}
        />
        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1f5400] flex items-center justify-center mx-auto mb-2 text-base">
          <i className="fa-solid fa-cloud-arrow-up" />
        </div>
        {selectedFileName ? (
          <div className="text-xs font-bold text-gray-900 flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-file-check text-[#1f5400]" />
            <span className="truncate max-w-xs">{selectedFileName}</span>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-gray-800">
              Click to select or drag and drop document
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">{helperText}</p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 font-semibold mt-1">{error}</p>
      )}
    </div>
  );
}
