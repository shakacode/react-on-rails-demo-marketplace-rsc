// 'use client' — same redesigned JSX as MenuSectionForServer plus an
// interactive category filter and markdown rendering during hydration.
// SSR/Client variants ship marked + highlight.js + sanitize-html.
'use client';

import React, { useState } from 'react';
import { MenuItem, MenuPayload } from './types';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';
import { PriceLadder } from './PriceLadder';

interface Props {
  menu: MenuPayload;
}

const SPICE_LEVELS = ['', '🌶', '🌶🌶', '🌶🌶🌶'];

const CATEGORY_ACCENT: Record<string, { bar: string; chip: string }> = {
  Starters:        { bar: 'bg-rose-400',    chip: 'bg-rose-50 text-rose-700' },
  'Salads & Sides':{ bar: 'bg-lime-400',    chip: 'bg-lime-50 text-lime-700' },
  Mains:           { bar: 'bg-amber-400',   chip: 'bg-amber-50 text-amber-700' },
  'House Specials':{ bar: 'bg-fuchsia-400', chip: 'bg-fuchsia-50 text-fuchsia-700' },
  'Pasta & Noodles':{bar: 'bg-orange-400',  chip: 'bg-orange-50 text-orange-700' },
  Dessert:         { bar: 'bg-pink-400',    chip: 'bg-pink-50 text-pink-700' },
  Beverages:       { bar: 'bg-sky-400',     chip: 'bg-sky-50 text-sky-700' },
};

function MenuItemCard({ item }: { item: MenuItem }) {
  const accent = CATEGORY_ACCENT[item.category] ?? { bar: 'bg-slate-300', chip: 'bg-slate-100 text-slate-700' };
  const descHtml = renderSanitizedMarkdown(item.description);
  const photo = `https://picsum.photos/seed/menu-${item.id}/240/180`;
  return (
    <article className="group relative rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${accent.bar}`} aria-hidden="true" />
      <div className="flex gap-4 p-5 pl-6">
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-xl shrink-0"
        />
        <div className="flex-1 min-w-0">
          <header className="flex items-baseline justify-between gap-2 mb-1">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {item.name}
              {item.spice_level > 0 && <span className="text-amber-600 ml-1">{SPICE_LEVELS[item.spice_level]}</span>}
            </h3>
            <span className="text-base font-mono font-semibold text-slate-900 tabular-nums shrink-0">${item.price_usd.toFixed(2)}</span>
          </header>
          <div className={`inline-block text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 mb-2 ${accent.chip}`}>{item.category}</div>
          <div
            className="prose prose-sm prose-slate max-w-none text-slate-700 mb-3 prose-p:my-1"
            dangerouslySetInnerHTML={{ __html: descHtml }}
          />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.tags.map((t) => (
              <span key={t} className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">{t}</span>
            ))}
            <span className="text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{item.calories} kcal</span>
            <span className="text-[10px] tracking-wider px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-600">{item.prep_minutes} min</span>
          </div>
          <PriceLadder priceUsd={item.price_usd} />
          {item.pairings.length > 0 && (
            <p className="text-xs text-slate-500 mt-3"><span className="font-semibold text-slate-600">Pairs with:</span> {item.pairings.join(' · ')}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function MenuSection({ menu }: Props) {
  const [active, setActive] = useState<string | null>(null);
  const visibleItems = active ? menu.items.filter((it) => it.category === active) : menu.items;

  return (
    <section id="menu" className="container mx-auto px-4 mb-14 scroll-mt-24">
      <div className="flex items-end justify-between flex-wrap gap-2 mb-6 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-amber-600 font-semibold mb-1">Our Kitchen</p>
          <h2 className="text-3xl font-bold text-slate-900">The Menu</h2>
        </div>
        <p className="text-sm text-slate-500">{menu.items.length} dishes across {menu.categories.length} sections</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <button
          type="button"
          className={
            'text-xs px-3 py-1.5 rounded-full border transition-colors ' +
            (active === null
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50')
          }
          onClick={() => setActive(null)}
        >
          All ({menu.items.length})
        </button>
        {menu.categories.map((c) => (
          <button
            key={c}
            type="button"
            className={
              'text-xs px-3 py-1.5 rounded-full border transition-colors ' +
              (active === c
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50')
            }
            onClick={() => setActive(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {visibleItems.map((it) => (
          <MenuItemCard key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
}
