'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

type AspectPreset = '1:1' | '4:3' | '16:9';

const FILTER_PRESETS = [
  { id: 'original', label: 'Original', brightness: 100, contrast: 100, saturate: 100 },
  { id: 'daylight', label: 'Fresh Daylight', brightness: 108, contrast: 106, saturate: 105 },
  { id: 'crisp', label: 'Crisp Harvest', brightness: 104, contrast: 114, saturate: 118 },
  { id: 'warm', label: 'Warm Earth', brightness: 105, contrast: 104, saturate: 112 },
];

export interface ImageEditorModalProps {
  imageUrl: string;
  localSourceUrl?: string;
  onClose: () => void;
  onSave: (editedFile: File, localBlobUrl: string) => Promise<void>;
}

export default function ImageEditorModal({
  imageUrl,
  localSourceUrl,
  onClose,
  onSave,
}: ImageEditorModalProps) {
  const srcUrl = localSourceUrl || imageUrl;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [straighten, setStraighten] = useState(0); // -45 to +45
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [aspect, setAspect] = useState<AspectPreset>('1:1');

  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [activePreset, setActivePreset] = useState('original');
  const [showGrid, setShowGrid] = useState(true);

  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 1000, h: 1000 });

  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    if (!srcUrl.startsWith('blob:') && !srcUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 });
    };
    img.src = srcUrl;
  }, [srcUrl]);

  const handleResetAll = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
    setStraighten(0);
    setFlipH(false);
    setFlipV(false);
    setAspect('1:1');
    setBrightness(100);
    setContrast(100);
    setSaturate(100);
    setActivePreset('original');
    setErrorMsg(null);
  };

  const applyFilterPreset = (preset: (typeof FILTER_PRESETS)[number]) => {
    setActivePreset(preset.id);
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturate(preset.saturate);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: Math.max(-240, Math.min(240, dragStartRef.current.panX + dx)),
      y: Math.max(-240, Math.min(240, dragStartRef.current.panY + dy)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.max(1, Math.min(3, Number((prev + delta).toFixed(2)))));
  };

  const handleExportAndSave = async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      const targetDims =
        aspect === '1:1'
          ? { w: 1000, h: 1000 }
          : aspect === '4:3'
          ? { w: 1200, h: 900 }
          : { w: 1280, h: 720 };

      const canvas = document.createElement('canvas');
      canvas.width = targetDims.w;
      canvas.height = targetDims.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      const img = new Image();
      if (!srcUrl.startsWith('blob:') && !srcUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load image for editing'));
        img.src = srcUrl;
      });

      const viewportWidth = viewportRef.current?.clientWidth || 360;
      const scaleToCanvas = targetDims.w / viewportWidth;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetDims.w, targetDims.h);

      ctx.save();
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;

      // Move origin to center + scaled user pan
      ctx.translate(targetDims.w / 2 + pan.x * scaleToCanvas, targetDims.h / 2 + pan.y * scaleToCanvas);

      // Apply rotation & straighten angle
      const totalRad = ((rotation + straighten) * Math.PI) / 180;
      ctx.rotate(totalRad);

      // Apply flip and zoom
      ctx.scale((flipH ? -1 : 1) * zoom, (flipV ? -1 : 1) * zoom);

      // Compute cover-fit dimensions relative to target canvas
      const imgAspect = naturalSize.w / naturalSize.h;
      const canvasAspect = targetDims.w / targetDims.h;
      let drawW = targetDims.w;
      let drawH = targetDims.h;
      if (imgAspect > canvasAspect) {
        drawH = targetDims.h;
        drawW = drawH * imgAspect;
      } else {
        drawW = targetDims.w;
        drawH = drawW / imgAspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
      );

      if (!blob) {
        throw new Error('Failed to export customized image');
      }

      const file = new File([blob], `harvest-edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);
      await onSave(file, blobUrl);
      onClose();
    } catch (err: any) {
      console.error('Image customization export error:', err);
      setErrorMsg(
        err?.message?.includes('Tainted') || err?.name === 'SecurityError'
          ? 'Remote server blocked pixel export. Try re-uploading this image directly to customize it.'
          : err?.message || 'Failed to save customized image.'
      );
    } finally {
      setSaving(false);
    }
  };

  const aspectClass =
    aspect === '1:1'
      ? 'aspect-square max-w-[360px]'
      : aspect === '4:3'
      ? 'aspect-[4/3] max-w-[420px]'
      : 'aspect-video max-w-[460px]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 12 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="bg-white border border-gray-300 rounded-none w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-300 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#007a6c] text-[20px]">tune</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Harvest Photo Studio
              </h3>
              <p className="text-[11px] text-gray-500">
                Zoom, drag to reposition, rotate, flip, or tune harvest lighting
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 border border-gray-300 transition-colors"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-8 h-8 flex items-center justify-center border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Studio Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-300">
          {/* Left: Interactive Canvas Viewport */}
          <div className="lg:col-span-7 p-6 bg-gray-50/40 flex flex-col items-center justify-center gap-4 min-h-[360px]">
            {/* Aspect Ratio Switcher & Grid Toggle */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex border border-gray-300 divide-x divide-gray-300 bg-white">
                {(['1:1', '4:3', '16:9'] as AspectPreset[]).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setAspect(ratio)}
                    className={`px-3 py-1 text-[11px] font-bold transition-colors ${
                      aspect === ratio
                        ? 'bg-[#1f5400] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2.5 py-1 text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                  showGrid
                    ? 'border-[#007a6c] text-[#007a6c] bg-teal-50/40'
                    : 'border-gray-300 text-gray-600 bg-white'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">grid_3x3</span>
                <span>Grid</span>
              </button>
            </div>

            {/* Interactive Frame */}
            <div
              ref={viewportRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
              className={`w-full ${aspectClass} relative overflow-hidden border border-gray-400 bg-white select-none touch-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              <img
                src={srcUrl}
                alt="Editable crop preview"
                draggable={false}
                className="w-full h-full object-cover pointer-events-none select-none"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${
                    rotation + straighten
                  }deg) scale(${(flipH ? -1 : 1) * zoom}, ${(flipV ? -1 : 1) * zoom})`,
                  filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`,
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out',
                }}
              />

              {/* Rule of Thirds Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-r border-b border-white/35" />
                  <div className="border-b border-white/35" />
                  <div className="border-r border-white/35" />
                  <div className="border-r border-white/35" />
                  <div />
                </div>
              )}

              {/* Bottom Zoom Pill */}
              <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/70 text-white text-[10px] font-bold tabular-nums pointer-events-none">
                {zoom.toFixed(2)}x
              </div>
            </div>

            <div className="flex items-center justify-between w-full text-[11px] text-gray-500">
              <span>Drag photo to pan • Scroll or slide to zoom</span>
              {(pan.x !== 0 || pan.y !== 0) && (
                <button
                  type="button"
                  onClick={() => setPan({ x: 0, y: 0 })}
                  className="text-[#007a6c] font-bold hover:underline"
                >
                  Re-center
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="w-full p-2.5 bg-rose-50 border border-rose-300 text-xs font-semibold text-rose-700">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Right: Precision Controls */}
          <div className="lg:col-span-5 p-6 bg-white space-y-6">
            {/* Zoom Control */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Zoom Level
                </span>
                <span className="text-xs font-bold text-[#007a6c] tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.15).toFixed(2))))}
                  className="w-8 h-8 border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                </button>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 accent-[#1f5400] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.15).toFixed(2))))}
                  className="w-8 h-8 border border-gray-300 flex items-center justify-center hover:bg-gray-50 text-gray-700"
                >
                  <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                </button>
              </div>
            </div>

            {/* Transform: Rotate & Flip */}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Orientation &amp; Straighten
                </span>
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {rotation + straighten}°
                </span>
              </div>

              <div className="grid grid-cols-4 border border-gray-300 divide-x divide-gray-300">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                  className="py-2 flex items-center justify-center hover:bg-gray-50 text-gray-700"
                  title="Rotate 90° Left"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="py-2 flex items-center justify-center hover:bg-gray-50 text-gray-700"
                  title="Rotate 90° Right"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  className={`py-2 flex items-center justify-center transition-colors ${
                    flipH ? 'bg-emerald-50 text-[#1f5400]' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  title="Flip Horizontal"
                >
                  <span className="material-symbols-outlined text-[18px]">flip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV(!flipV)}
                  className={`py-2 flex items-center justify-center transition-colors ${
                    flipV ? 'bg-emerald-50 text-[#1f5400]' : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  title="Flip Vertical"
                >
                  <span className="material-symbols-outlined text-[18px] rotate-90">flip</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                  <span>Fine Tilt</span>
                  <span className="tabular-nums">{straighten}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={straighten}
                  onChange={(e) => setStraighten(Number(e.target.value))}
                  className="w-full accent-[#007a6c] cursor-pointer"
                />
              </div>
            </div>

            {/* Color Presets */}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-800 block">
                Lighting Presets
              </span>
              <div className="grid grid-cols-2 gap-2">
                {FILTER_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyFilterPreset(p)}
                    className={`px-3 py-1.5 text-xs font-semibold border text-left transition-colors ${
                      activePreset === p.id
                        ? 'border-[#1f5400] bg-emerald-50/60 text-[#1f5400] font-bold'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine Lighting Sliders */}
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <div>
                <div className="flex justify-between text-[11px] text-gray-700 font-semibold mb-1">
                  <span>Brightness</span>
                  <span className="tabular-nums">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="130"
                  value={brightness}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setBrightness(Number(e.target.value));
                  }}
                  className="w-full accent-[#007a6c] cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-gray-700 font-semibold mb-1">
                  <span>Contrast</span>
                  <span className="tabular-nums">{contrast}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="130"
                  value={contrast}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setContrast(Number(e.target.value));
                  }}
                  className="w-full accent-[#007a6c] cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-gray-700 font-semibold mb-1">
                  <span>Natural Vibrancy</span>
                  <span className="tabular-nums">{saturate}%</span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="140"
                  value={saturate}
                  onChange={(e) => {
                    setActivePreset('custom');
                    setSaturate(Number(e.target.value));
                  }}
                  className="w-full accent-[#007a6c] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-300 bg-white flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExportAndSave}
            disabled={saving}
            className="px-6 py-2 text-xs font-bold bg-[#1f5400] hover:bg-[#173f00] text-white border border-[#1f5400] transition-colors inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Applying Edits...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>Apply &amp; Save Photo</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
