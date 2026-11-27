'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import ImageEditorModal from './ImageEditorModal';

interface MultiImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  variant?: 'rounded' | 'lined';
}

export default function MultiImageUploader({
  images,
  onChange,
  maxImages = 5,
  variant = 'rounded',
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLined = variant === 'lined';

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
        const localUrl = URL.createObjectURL(validFiles[0]);
        const res = await api.uploadProductImage(validFiles[0]);
        if (res.url) {
          setLocalPreviews((prev) => ({ ...prev, [res.url]: localUrl }));
          onChange([...images, res.url]);
        }
      } else {
        const localUrls = validFiles.map((f) => URL.createObjectURL(f));
        const res = await api.uploadProductImages(validFiles);
        if (res.urls && res.urls.length > 0) {
          const mapUpdates: Record<string, string> = {};
          res.urls.forEach((remoteUrl, idx) => {
            if (localUrls[idx]) mapUpdates[remoteUrl] = localUrls[idx];
          });
          setLocalPreviews((prev) => ({ ...prev, ...mapUpdates }));
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

  const handleMoveImage = (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    const copy = [...images];
    [copy[index], copy[targetIdx]] = [copy[targetIdx], copy[index]];
    onChange(copy);
  };

  const handleSaveEditedImage = async (editedFile: File, localBlobUrl: string) => {
    if (editingIndex === null) return;
    const res = await api.uploadProductImage(editedFile);
    if (res.url) {
      setLocalPreviews((prev) => ({ ...prev, [res.url]: localBlobUrl }));
      const nextImages = images.map((url, idx) => (idx === editingIndex ? res.url : url));
      onChange(nextImages);
    }
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
        className={`relative border ${
          isLined
            ? `border-dashed rounded-none p-7 ${
                dragActive
                  ? 'border-[#1f5400] bg-emerald-50/40'
                  : 'border-gray-300 bg-white hover:border-[#007a6c] hover:bg-gray-50/60'
              }`
            : `border-2 border-dashed rounded-3xl p-6 sm:p-8 ${
                dragActive
                  ? 'border-[#16a34a] bg-emerald-50/60'
                  : 'border-gray-200 bg-gray-50/50 hover:bg-emerald-50/20 hover:border-emerald-300'
              }`
        } text-center cursor-pointer transition-all ${
          images.length >= maxImages ? 'opacity-50 pointer-events-none' : ''
        }`}
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
          <div
            className={`w-12 h-12 flex items-center justify-center mb-1 ${
              isLined
                ? 'rounded-none border border-gray-300 bg-white text-[#1f5400]'
                : 'rounded-2xl bg-emerald-100/70 text-[#16a34a]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {uploading ? (
              <span className="inline-flex items-center gap-2 text-[#007a6c]">
                <span className="w-4 h-4 border-2 border-[#007a6c] border-t-transparent rounded-full animate-spin" />
                Uploading harvest pictures...
              </span>
            ) : (
              <>
                <span
                  className={
                    isLined
                      ? 'text-[#1f5400] underline underline-offset-2'
                      : 'text-[#16a34a] hover:underline'
                  }
                >
                  Click to upload
                </span>{' '}
                or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-500">
            JPG, PNG or WebP (max 5 MB each) • Up to {maxImages} images • Zoom &amp; crop supported
          </p>
        </div>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div
          className={`p-3 bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-700 flex items-center gap-2 ${
            isLined ? 'rounded-none' : 'rounded-xl'
          }`}
        >
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Image Previews Grid */}
      {images.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Product Gallery ({images.length}/{maxImages})
            </span>
            <span className="text-[11px] text-gray-500">
              Hover any photo to zoom, crop, rotate, or set as cover
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <AnimatePresence initial={false}>
              {images.map((imgUrl, index) => (
                <motion.div
                  key={imgUrl + index}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.22 }}
                  className={`relative group overflow-hidden aspect-square bg-gray-100 ${
                    isLined
                      ? `rounded-none border ${
                          index === 0 ? 'border-[#1f5400] ring-1 ring-[#1f5400]' : 'border-gray-300'
                        }`
                      : `rounded-2xl border-2 ${
                          index === 0 ? 'border-[#16a34a] shadow-sm' : 'border-gray-200'
                        }`
                  }`}
                >
                  <img
                    src={localPreviews[imgUrl] || imgUrl}
                    alt={`Product view ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Primary Tag or Set Cover */}
                  {index === 0 ? (
                    <span
                      className={`absolute top-2 left-2 text-white text-[10px] font-bold px-2 py-0.5 ${
                        isLined ? 'bg-[#1f5400] rounded-none' : 'bg-[#16a34a] rounded-full shadow-xs'
                      }`}
                    >
                      Main Cover
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetPrimary(index);
                      }}
                      className={`absolute top-2 left-2 bg-black/75 hover:bg-black text-white text-[10px] font-semibold px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                        isLined ? 'rounded-none' : 'rounded-full'
                      }`}
                    >
                      Set Cover
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(index);
                    }}
                    className={`absolute top-2 right-2 w-7 h-7 bg-rose-600/90 hover:bg-rose-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                      isLined ? 'rounded-none' : 'rounded-full shadow-sm'
                    }`}
                    title="Remove image"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>

                  {/* Bottom Toolbar: Customize (Zoom/Crop/Filter) + Reorder */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIndex(index);
                      }}
                      className="flex-1 py-1 px-2 bg-white hover:bg-gray-100 text-gray-900 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                      title="Zoom, crop, rotate & enhance"
                    >
                      <span className="material-symbols-outlined text-[13px]">tune</span>
                      <span>Customize</span>
                    </button>

                    {images.length > 1 && (
                      <div className="flex items-center gap-0.5">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveImage(index, -1);
                            }}
                            className="w-6 h-6 bg-white/90 hover:bg-white text-gray-900 flex items-center justify-center"
                            title="Move left"
                          >
                            <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                          </button>
                        )}
                        {index < images.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMoveImage(index, 1);
                            }}
                            className="w-6 h-6 bg-white/90 hover:bg-white text-gray-900 flex items-center justify-center"
                            title="Move right"
                          >
                            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Image Studio Modal */}
      <AnimatePresence>
        {editingIndex !== null && images[editingIndex] && (
          <ImageEditorModal
            imageUrl={images[editingIndex]}
            localSourceUrl={localPreviews[images[editingIndex]]}
            onClose={() => setEditingIndex(null)}
            onSave={handleSaveEditedImage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
