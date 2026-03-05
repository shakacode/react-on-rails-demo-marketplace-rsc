'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for INPOverlay.
// Server components import this file; client components import INPOverlay directly.
export { INPOverlay } from './INPOverlay';
