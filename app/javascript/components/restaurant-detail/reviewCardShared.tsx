// Plain shared module — no 'use client', usable from both trees (same
// convention as chunkPairs.ts). Presentational bits the server and client
// review cards render identically; keeping one copy means the avatar hash and
// star markup can never drift between the ForServer and client twins.
import React from 'react';

const AVATAR_PALETTE = [
  ['bg-rose-100',    'text-rose-700'],
  ['bg-amber-100',   'text-amber-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-sky-100',     'text-sky-700'],
  ['bg-fuchsia-100', 'text-fuchsia-700'],
  ['bg-orange-100',  'text-orange-700'],
];

export function avatarFor(reviewer: string) {
  const initial = reviewer.trim().charAt(0).toUpperCase();
  let h = 0;
  for (let i = 0; i < reviewer.length; i++) h = (h + reviewer.charCodeAt(i)) % AVATAR_PALETTE.length;
  return { initial, palette: AVATAR_PALETTE[h] };
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${value} of 5`}>
      {'★'.repeat(value)}
      <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}
