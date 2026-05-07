import React from 'react';

const SimpleServerComponent = () => (
  <div className="container mx-auto px-4 py-8 prose prose-slate max-w-3xl">
    <h1>Simple Server Component</h1>
    <p>
      This page is rendered as an RSC server component via{' '}
      <code>stream_react_component</code>. There is no client-side JS for the
      content below — what you see was assembled on the server and streamed as
      HTML.
    </p>
    <p>
      Visit any of the four demo pages from the home page to see the SSR /
      Client / RSC variants of the same content side-by-side.
    </p>
  </div>
);

export default SimpleServerComponent;
