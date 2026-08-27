// The repo-owned react-virtuoso seam (issue #184). react-virtuoso ships NO
// 'use client' directive, so this pair of files is the only place allowed to
// import it. Client trees import this implementation directly; server
// components import VirtualElementListForServer — the 'use client' re-export
// that forms the RSC boundary. The split matters: the flight manifest lists a
// referenced module's chunks as the union of every chunk group containing it,
// so referencing THIS file (which client entries also bundle) from an RSC
// page would drag the whole client entry's chunk group — markdown-libs
// included — onto the RSC route. The ForServer re-export lives in no client
// entry, so its chunk list stays clean (same trick as AddToCartSectionForServer).
//
// Server components pass pre-rendered element arrays across the boundary
// (elements are serializable; functions are not) and the itemContent callback
// stays inside this module — it never crosses the RSC boundary.
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
      // Generous below: rows are heavy (markdown + hljs), and under window
      // scrolling every estimate→real correction that lands inside the
      // viewport is a layout shift. Measuring rows ~2 viewports before they
      // (and the section below the list) become visible keeps the final
      // geometry correction off-screen, which is what holds CLS at 0.
      increaseViewportBy={{ top: 300, bottom: 2400 }}
      computeItemKey={(index) => keys[index] ?? index}
      itemContent={(_index, element) => element}
    />
  );
}
