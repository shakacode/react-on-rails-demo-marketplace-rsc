// The repo-owned react-virtuoso seam (issue #184). react-virtuoso ships NO
// 'use client' directive, so this wrapper is the only module allowed to import
// it — server components pass pre-rendered element arrays across the boundary
// (elements are serializable; functions are not), client trees pass elements
// they created locally. Either way the itemContent callback lives HERE and
// never crosses the RSC boundary.
'use client';

import React, { ReactElement } from 'react';
import { Virtuoso } from 'react-virtuoso';

interface Props {
  // One element per virtual row (for the reviews list: a row of two cards —
  // the 2-col md:grid-cols-2 layout means rows, not cards, are the unit).
  items: ReactElement[];
  // Parallel array of stable ids for computeItemKey — index keys would break
  // identity when the caller reorders/filters the rows.
  keys: (string | number)[];
  // Rows rendered into the server HTML (Virtuoso's initialItemCount). Without
  // it SSR emits ZERO items; with the reviews list far below the fold this is
  // a no-JS/SEO preview knob, not an LCP defense. 0 = no server-rendered rows.
  initialRows?: number;
}

// Deliberately NO defaultItemHeight: rows on this route are responsive
// (2-col row ≈406px on desktop, stacked pair ≈835px on mobile — measured), so
// no single estimate is right, a post-mount switch is ignored (the estimate
// only seeds the size tree at init), and branching on matchMedia during render
// is a hydration mismatch. Omitting it lets the probe measure the first real
// row after hydration — breakpoint-correct by construction.
export default function VirtualElementList({ items, keys, initialRows = 0 }: Props) {
  return (
    <Virtuoso
      useWindowScroll
      data={items}
      initialItemCount={initialRows > 0 ? Math.min(initialRows, items.length) : undefined}
      increaseViewportBy={{ top: 200, bottom: 600 }}
      computeItemKey={(index) => keys[index] ?? index}
      itemContent={(_index, element) => element}
    />
  );
}
