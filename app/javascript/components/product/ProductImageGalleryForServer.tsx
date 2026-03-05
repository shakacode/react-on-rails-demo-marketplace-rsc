'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for ProductImageGallery.
// Server components import this file; client components import ProductImageGallery directly.
export { ProductImageGallery } from './ProductImageGallery';
