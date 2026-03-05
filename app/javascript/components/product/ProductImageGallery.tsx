import React, { useState, useCallback } from 'react';
import { ProductImage } from '../../types/product';

interface Props {
  images: ProductImage[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });

  const selectedImage = images[selectedIndex] || images[0];

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, [isZoomed]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  return (
    <div className="space-y-4">
      {/* Main image */}
      <div
        className="relative aspect-square bg-gray-50 rounded-2xl overflow-hidden cursor-zoom-in group"
        onClick={() => setIsZoomed(!isZoomed)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsZoomed(false)}
      >
        <img
          src={selectedImage.url}
          alt={selectedImage.alt || productName}
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isZoomed ? 'scale-150' : 'group-hover:scale-105'
          }`}
          style={isZoomed ? {
            transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
          } : undefined}
          fetchPriority="high"
          decoding="async"
        />

        {/* Navigation arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Previous image"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              aria-label="Next image"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image counter */}
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
          {selectedIndex + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setSelectedIndex(index)}
              className={`relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 transition-all ${
                index === selectedIndex
                  ? 'ring-2 ring-indigo-500 ring-offset-2'
                  : 'ring-1 ring-gray-200 hover:ring-gray-300 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={image.url}
                alt={image.alt || `${productName} - View ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
