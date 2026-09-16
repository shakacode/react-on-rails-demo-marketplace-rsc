'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for ReviewsSectionRoute.
// Server components import this file; client components import ReviewsSectionRoute directly.
export { ReviewsSectionRoute } from './ReviewsSectionRoute';
