'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for ReviewFormIsland.
// Server components import this file; client components import ReviewFormIsland directly.
export { ReviewFormIsland } from './ReviewFormIsland';
