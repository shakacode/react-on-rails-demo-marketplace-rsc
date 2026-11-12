'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for HelpfulButton.
// Server components import this file; client components import HelpfulButton directly.
export { HelpfulButton } from './HelpfulButton';
