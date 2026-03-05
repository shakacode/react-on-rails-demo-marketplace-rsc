'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for InteractiveSection.
// Server components import this file; client components import InteractiveSection directly.
export { InteractiveSection } from './InteractiveSection';
