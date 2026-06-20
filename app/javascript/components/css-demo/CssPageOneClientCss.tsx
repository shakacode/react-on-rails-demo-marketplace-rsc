import React from 'react';
import CssSharedClient from './CssSharedClient';
import CssBlockAClient from './CssBlockAClient';

export default function CssPageOneClientCss() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CSS Demo — Page One (Shared + A, client-CSS)</h1>
      <CssSharedClient />
      <CssBlockAClient />
    </main>
  );
}
