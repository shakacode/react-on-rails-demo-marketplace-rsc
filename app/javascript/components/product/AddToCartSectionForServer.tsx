'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for AddToCartSection.
// Server components import this file; client components import AddToCartSection directly.
export { AddToCartSection } from './AddToCartSection';
