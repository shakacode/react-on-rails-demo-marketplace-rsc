import React from 'react';
import CssShared from './CssShared';
import CssBlockB from './CssBlockB';

export default function CssPageTwo() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CSS Demo — Page Two (Shared + B)</h1>
      <CssShared />
      <CssBlockB />
    </main>
  );
}
