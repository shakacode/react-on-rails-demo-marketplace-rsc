'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for ReviewMutationIsland.
// Server components import this file; client components import ReviewMutationIsland directly.
export { ReviewMutationIsland } from './ReviewMutationIsland';
