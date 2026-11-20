'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';

interface UploadedImage {
  url: string;
  public_id?: string;
}

interface MultiImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function MultiImageUploader({
  images,
  onChange,
  maxImages = 5,
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    setErrorMessage(null);
    const validFiles: File[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    const fileArray = Array.from(files);

    if (images.length + fileArray.length > maxImages) {
      setErrorMessage(`You can upload a maximum of ${maxImages} images per product.`);
      return;
    }

    for (const file of fileArray) {
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        setErrorMessage('Only JPG, PNG, and WebP image formats are accepted.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the 5MB file size limit.`);
        return;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      if (validFiles.length === 1) {
        const res = await api.uploadProductImage(validFiles[0]);
        if (res.url) {
          onChange([...images, res.url]);
        }
      } else {
        const res = await api.uploadProductImages(validFiles);
        if (res.urls && res.urls.length > 0) {
          onChange([...images, ...res.urls]);
        }
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setErrorMessage(err.response?.data?.message || 'Failed to upload images. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const updated = images.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const handleSetPrimary = (indexToPrimary: number) => {
    if (indexToPrimary === 0) return;
    const target = images[indexToPrimary];
    const filtered = images.filter((_, idx) => idx !== indexToPrimary);
    onChange([target, ...filtered]);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-[#16a34a] bg-emerald-50/60'
            : 'border-gray-200 bg-gray-50/50 hover:bg-emerald-50/20 hover:border-emerald-300'
        } ${images.length >= maxImages ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(e.target.files);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100/70 text-[#16a34a] flex items-center justify-center mb-1">
            <span className="material-symbols-outlined text-3xl">add_photo_alternate</span>
          </div>
          <p className="text-sm font-bold text-gray-800">
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-[#16a34a]">
                <span className="w-4 h-4 border-2 border-[#16a34a] border-t-transparent rounded-full animate-spin" />
                Uploading harvest pictures to Cloudinary...
              </span>
            ) : (
              <>
                <span className="text-[#16a34a] hover:underline">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">
            JPG, PNG or WebP (max 5 MB each) • Up to {maxImages} images
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Image Previews Grid */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Product Gallery ({images.length}/{maxImages})
            </span>
            <span className="text-[11px] text-gray-400">First image is the main store cover</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {images.map((imgUrl, index) => (
              <div
                key={imgUrl + index}
                className={`relative group rounded-2xl overflow-hidden border-2 aspect-square bg-gray-100 ${
                  index === 0 ? 'border-[#16a34a] shadow-sm' : 'border-gray-200'
                }`}
              >
                <img
                  src={imgUrl}
                  alt={`Product view ${index + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Primary Tag */}
                {index === 0 ? (
                  <span className="absolute top-2 left-2 bg-[#16a34a] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    Main Cover
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetPrimary(index);
                    }}
                    className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Set as Cover
                  </button>
                )}

                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(index);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Remove image"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
