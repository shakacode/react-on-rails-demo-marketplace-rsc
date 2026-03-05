'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for BookmarkShareBar.
// Server components import this file; client components import BookmarkShareBar directly.
export { BookmarkShareBar } from './BookmarkShareBar';
