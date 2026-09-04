'use client';

// ForServer wrapper — gives RSC pages their own clean chunk group for
// VirtualElementList. Server components import this file; client components
// import VirtualElementList directly. See VirtualElementList.tsx for why the
// split is load-bearing (flight-manifest chunk-group union).
export { default } from './VirtualElementList';
