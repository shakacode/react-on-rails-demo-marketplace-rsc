import React from 'react';
import CssSharedClient from './CssSharedClient';
import CssBlockBClient from './CssBlockBClient';

export default function CssPageTwoClientCss() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CSS Demo — Page Two (Shared + B, client-CSS)</h1>
      <CssSharedClient />
      <CssBlockBClient />
    </main>
  );
}
