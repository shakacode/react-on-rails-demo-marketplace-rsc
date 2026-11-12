// Plain helper — no 'use client', usable from both trees.
// The reviews list is a 2-column grid (md:grid-cols-2), and a flat Virtuoso
// stacks one item per row — so each virtual item is a ROW of two cards.
// (VirtuosoGrid is unsuitable: it requires same-size items; review heights vary.)
import { Review } from './types';

export function chunkPairs(reviews: Review[]): Review[][] {
  const rows: Review[][] = [];
  for (let i = 0; i < reviews.length; i += 2) {
    rows.push(reviews.slice(i, i + 2));
  }
  return rows;
}
