import React from 'react';
import CssShared from './CssShared';
import CssBlockA from './CssBlockA';

export default function CssPageOne() {
  return (
    <main style={{ padding: 24 }}>
      <h1>CSS Demo — Page One (Shared + A)</h1>
      <CssShared />
      <CssBlockA />
    </main>
  );
}
