'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for SortableOrdersTable.
// Server components import this file; client components import SortableOrdersTable directly.
export { default } from './SortableOrdersTable';
