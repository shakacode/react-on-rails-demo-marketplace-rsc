'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for ReadingModeToggle.
// Server components import this file; client components import ReadingModeToggle directly.
export { ReadingModeToggle } from './ReadingModeToggle';
