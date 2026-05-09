// No 'use client' — pure server component. Renders to plain HTML.
// Used by SSR / Client / RSC variants alike. On the RSC page, the chunk never
// reaches the browser because every link is a regular <a> with no hydration.

import React from 'react';

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
}

export function Breadcrumb({ crumbs }: Props) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate-500">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${idx}`} className="flex items-center gap-1.5">
              {crumb.href && !isLast ? (
                <a href={crumb.href} className="hover:text-indigo-600 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className={isLast ? 'font-medium text-slate-800' : ''} aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
