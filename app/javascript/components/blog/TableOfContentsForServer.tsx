'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for TableOfContents.
// Server components import this file; client components import TableOfContents directly.
export { TableOfContents } from './TableOfContents';
