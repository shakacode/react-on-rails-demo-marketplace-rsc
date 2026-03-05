'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for DashboardFilters.
// Server components import this file; client components import DashboardFilters directly.
export { default } from './DashboardFilters';
