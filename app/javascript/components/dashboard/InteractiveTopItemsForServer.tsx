'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for InteractiveTopItems.
// Server components import this file; client components import InteractiveTopItems directly.
export { default } from './InteractiveTopItems';
