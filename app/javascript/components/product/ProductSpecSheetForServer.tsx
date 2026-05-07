// Server-only — long-form markdown spec sheet for the product page.
// Imported only from ProductPageRSC (no 'use client'), so marked + highlight.js
// + sanitize-html stay on the server.
import React from 'react';
import { renderSanitizedMarkdown } from '../../utils/sanitizeAndRender';
import { PriceLadder } from '../restaurant-detail/PriceLadder';

interface Props {
  productName: string;
  productPriceUsd: number;
  specMarkdown: string;
}

export function ProductSpecSheet({ productName, productPriceUsd, specMarkdown }: Props) {
  const html = renderSanitizedMarkdown(specMarkdown);
  return (
    <section className="border-t border-gray-200 pt-8 mt-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pricing — global ladder</h2>
        <p className="text-sm text-slate-600 mb-3">
          {productName} priced for {6} regions, computed server-side via
          intl-messageformat (kept off the client bundle on RSC pages).
        </p>
        <PriceLadder priceUsd={productPriceUsd} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed specifications</h2>
        <div
          className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-a:text-indigo-600 prose-code:text-indigo-600 prose-pre:bg-gray-900 prose-pre:text-gray-100"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  );
}
