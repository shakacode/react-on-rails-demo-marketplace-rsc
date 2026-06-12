# frozen_string_literal: true

class BlogData
  MAIN_POST = {
    id: 1,
    title: "Migrating to React Server Components with React on Rails",
    author: "ShakaCode Team",
    date: "2025-06-15",
    # reading_time computed at runtime in `find_post`; this stub is overwritten there.
    reading_time: nil,
    tags: %w[react-on-rails rsc streaming migration],
    excerpt: "A complete guide to migrating your React on Rails application from traditional client-side rendering to React Server Components with streaming.",
    toc_entries: [
      { id: "why-migrate-to-rsc", title: "Why Migrate to RSC?", level: 2 },
      { id: "prerequisites", title: "Prerequisites", level: 2 },
      { id: "understanding-the-three-bundle-architecture", title: "Understanding the Three-Bundle Architecture", level: 2 },
      { id: "step-1-enable-rsc-in-configuration", title: "Step 1: Enable RSC in Configuration", level: 2 },
      { id: "step-2-add-use-client-to-existing-components", title: "Step 2: Add 'use client' to Existing Components", level: 2 },
      { id: "step-3-create-your-first-server-component", title: "Step 3: Create Your First Server Component", level: 2 },
      { id: "step-4-implement-streaming-with-async-props", title: "Step 4: Implement Streaming with Async Props", level: 2 },
      { id: "step-5-migration-strategy-for-existing-pages", title: "Step 5: Migration Strategy for Existing Pages", level: 2 },
      { id: "common-migration-patterns", title: "Common Migration Patterns", level: 2 },
      { id: "verifying-your-migration", title: "Verifying Your Migration", level: 2 },
      { id: "troubleshooting", title: "Troubleshooting", level: 2 },
      { id: "summary", title: "Summary", level: 2 }
    ],
    content: <<~MARKDOWN
## Why Migrate to RSC?

React Server Components (RSC) represent a fundamental shift in how React applications render. Instead of shipping all your component code, rendering libraries, and data-fetching logic to the browser, RSC keeps server-only code **entirely on the server**. The client receives only the rendered output and the minimal JavaScript needed for interactivity.

For React on Rails applications, this means:

- **Dramatically smaller client bundles** — Libraries like `marked`, `highlight.js`, `date-fns`, or `lodash` that are only needed for rendering stay server-side. This can mean hundreds of kilobytes less JavaScript shipped to users.
- **Direct access to Rails data** — Server components receive props directly from Rails controllers. No API endpoints needed for initial data.
- **Streaming with Suspense** — Rails can stream async data chunks as they resolve. Users see content progressively instead of waiting for the slowest query.
- **Simplified architecture** — No need to duplicate data-fetching logic between Rails controllers and React `useEffect` calls.

## Prerequisites

Before starting the migration, ensure your project meets these requirements:

```ruby
# Gemfile
gem 'react_on_rails', '17.0.0.rc.3'
gem 'react_on_rails_pro', '17.0.0.rc.3'
```

```json
// package.json — Required dependencies
{
  "dependencies": {
    "react": "19.0.4",
    "react-dom": "19.0.4",
    "react-on-rails-pro": "17.0.0-rc.3",
    "react-on-rails-pro-node-renderer": "17.0.0-rc.3",
    "react-on-rails-rsc": "19.0.5-rc.7"
  }
}
```

> **Important:** RSC requires React 19. The RSC bundler APIs are unstable between React minor versions, so pin to React 19.0.x and the React on Rails RC stack's matching `react-on-rails-rsc` release. The `react-on-rails-rsc` package version tracks the React version it supports.

## Understanding the Three-Bundle Architecture

A React on Rails app with RSC uses **three separate webpack bundles**, each with a distinct purpose:

### Client Bundle (`client-bundle.js`)

Runs in the browser. Contains only `'use client'` component implementations and their dependencies. Server component code never appears here — only lightweight references that tell React "this component was rendered on the server."

```javascript
// app/javascript/packs/client-bundle.js
import ReactOnRails from 'react-on-rails-pro/client';

ReactOnRails.setOptions({
  traceTurbolinks: false,
  turbo: false,
});
```

### Server Bundle (`server-bundle.js`)

Runs in the Node renderer for SSR (generating initial HTML). Server components are registered here, but wrapped with `RSCRoute` — a proxy that delegates to the RSC system rather than including the actual implementation.

```javascript
// app/javascript/generated/server-bundle-generated.js (auto-generated)
import ReactOnRails from 'react-on-rails-pro';
import registerServerComponent from 'react-on-rails-pro/registerServerComponent/server';

// RSC components — registered via registerServerComponent
// In the SSR bundle, these get wrapped with RSCRoute (not the actual code)
registerServerComponent({ DashboardRSC, BlogPostRSC });

// Client components — registered normally for SSR
ReactOnRails.register({ DashboardSSR, HelloWorld });
```

### RSC Bundle (`rsc-bundle.js`)

Runs in the Node renderer under the `react-server` condition. This is the only bundle that contains actual server component implementations. Files with `'use client'` are transformed into client references by the RSC WebpackLoader — their code is stripped and replaced with a reference ID.

```javascript
// In the RSC bundle, 'use client' files become:
// Instead of the actual component code, the bundler emits:
// registerClientReference(proxy, "file-path", "default")
// The actual component code is only in the client bundle.
```

This three-bundle architecture is what makes RSC's bundle size reduction possible. The RSC bundle renders the server component tree into a serialized payload. The client bundle only receives references to client components it already has, plus the rendered output of server components.

## Step 1: Enable RSC in Configuration

### Rails Initializers

```ruby
# config/initializers/react_on_rails.rb
ReactOnRails.configure do |config|
  config.server_bundle_js_file = 'server-bundle.js'
  config.auto_load_bundle = true
  config.components_subdirectory = 'startup'
end

# config/initializers/react_on_rails_pro.rb
ReactOnRailsPro.configure do |config|
  config.enable_rsc_support = true
  config.rsc_bundle_js_file = 'rsc-bundle.js'
  config.server_renderer = 'NodeRenderer'
  config.renderer_url = ENV.fetch('RENDERER_URL', 'http://localhost:3800')
  config.rsc_payload_generation_url_path = 'rsc_payload/'
end
```

### Webpack RSC Bundle Configuration

Create `config/webpack/rscWebpackConfig.js`. This is the most critical configuration file for RSC:

```javascript
// config/webpack/rscWebpackConfig.js
const { default: serverWebpackConfig } = require('./serverWebpackConfig');

const configureRsc = () => {
  const rscConfig = serverWebpackConfig(true);

  // 1. Change entry point from server-bundle to rsc-bundle
  rscConfig.entry = {
    'rsc-bundle': rscConfig.entry['server-bundle']
  };

  // 2. Add the RSC WebpackLoader as a post-processing rule
  //    enforce: 'post' ensures it runs AFTER SWC/Babel compiles TSX to JS
  //    This gives the loader clean JavaScript to parse with acorn
  rscConfig.module.rules.push({
    test: /\\.(ts|tsx|js|jsx|mjs)$/,
    enforce: 'post',
    loader: 'react-on-rails-rsc/WebpackLoader',
  });

  // 3. Enable react-server resolve condition
  //    This tells webpack to use RSC-specific package exports
  rscConfig.resolve = {
    ...rscConfig.resolve,
    conditionNames: ['react-server', '...'],
    alias: {
      ...rscConfig.resolve?.alias,
      // react-dom/server is not needed in the RSC bundle
      'react-dom/server': false,
    },
  };

  // 4. Set the output filename
  rscConfig.output.filename = 'rsc-bundle.js';

  return rscConfig;
};

module.exports = configureRsc;
```

> **Why `enforce: 'post'`?** When using SWC (via Shakapacker), the loader is configured as a function, not an array. The RSC WebpackLoader needs to process JavaScript output, not raw TypeScript/JSX. By adding it as a separate rule with `enforce: 'post'`, it runs after SWC has compiled everything to plain JavaScript.

### Add RSC Plugin to Client and Server Configs

The `RSCWebpackPlugin` must be added to both the client and server webpack configurations:

```javascript
// In clientWebpackConfig.js
const { RSCWebpackPlugin } = require('react-on-rails-rsc/WebpackPlugin');

// Add to plugins array:
config.plugins.push(new RSCWebpackPlugin({ isServer: false }));

// In serverWebpackConfig.js
config.plugins.push(new RSCWebpackPlugin({ isServer: true }));
```

The plugin handles two critical tasks:
- **Client config**: Generates `react-client-manifest.json` mapping `'use client'` components to their webpack chunk IDs
- **Server config**: Adds all `'use client'` files as entry points to ensure they're included in the client bundle

### Process Management (Procfile.dev)

Each bundle needs its own watcher process:

```bash
# Procfile.dev
web: bundle exec rails server -p 3000
webpack: bin/shakapacker-dev-server

# Server bundle watcher (separate from dev server)
rails-server-assets: HMR=true SERVER_BUNDLE_ONLY=yes bin/shakapacker --watch

# RSC bundle watcher
rails-rsc-assets: HMR=true RSC_BUNDLE_ONLY=yes bin/shakapacker --watch

# Node renderer for SSR and RSC execution
renderer: node node-renderer.js
```

### Node Renderer Setup

The Node renderer executes both the server bundle (for SSR) and the RSC bundle (for RSC payload generation):

```javascript
// node-renderer.js
const { reactOnRailsProNodeRenderer } = require('react-on-rails-pro-node-renderer');

const config = {
  port: process.env.RENDERER_PORT || 3800,
  workersCount: 2,
  // Required: React.lazy() uses performance.now() internally
  additionalContext: { URL, AbortController, performance },
};

reactOnRailsProNodeRenderer(config);
```

## Step 2: Add `'use client'` to Existing Components

This is the most important step when enabling RSC. Once RSC support is active, React treats **all files as server components by default**. Any component that uses browser APIs, React hooks, or event handlers must be explicitly marked as a client component.

### What Needs `'use client'`

Add the directive to any file that:

```typescript
'use client';
// Add this as the VERY FIRST line (before any imports)

// Files that need 'use client':
// - Uses useState, useEffect, useRef, useCallback, useMemo, useContext
// - Uses event handlers (onClick, onChange, onSubmit, etc.)
// - Uses browser APIs (window, document, localStorage, etc.)
// - Uses third-party libraries that use hooks internally
// - Uses @loadable/component or React.lazy()
```

### What Does NOT Need `'use client'`

Leave the directive off for components that:

```typescript
// No 'use client' needed for:
// - Pure presentational components that only receive and render props
// - Components that only use: className, style, children, dangerouslySetInnerHTML
// - Components that import and render other components (composition)
// - Components that call server-side APIs or use async/await
// - Utility functions for rendering (markdown, formatting, etc.)
```

### The `'use client'` Boundary Rule

A critical concept: `'use client'` creates a **boundary**. Everything imported by a client component is automatically included in the client bundle, even if those imports don't have the directive themselves.

```typescript
// BlogPostRSC.tsx — Server component (no directive)
import { renderMarkdown } from './renderMarkdown'; // Stays server-side
import { BlogHeader } from './BlogHeader';          // Stays server-side
import { InteractiveSection } from './InteractiveSection'; // Has 'use client'

// renderMarkdown and BlogHeader code is ONLY in the RSC bundle
// InteractiveSection code is in the client bundle

export default async function BlogPostRSC({ post }) {
  const html = renderMarkdown(post.content); // 350KB library, server-only
  return (
    <div>
      <BlogHeader post={post} />
      <article dangerouslySetInnerHTML={{ __html: html }} />
      <InteractiveSection /> {/* Tiny client component */}
    </div>
  );
}
```

```typescript
// InteractiveSection.tsx — Client component
'use client';

import React, { useState } from 'react';

// This component and ALL its imports go to the client bundle
export function InteractiveSection() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>Like</button>;
}
```

**Key insight:** If `BlogHeader` was imported inside `InteractiveSection.tsx` instead of `BlogPostRSC.tsx`, it would be pulled into the client bundle — even though it's a simple presentational component. Always import shared components from the server component side when possible.

## Step 3: Create Your First Server Component

### Startup File Convention

React on Rails uses the `startup/` directory for component auto-discovery. The file naming convention determines which bundle each component is registered in:

```
app/javascript/startup/
  MyPageRSC.tsx          -> RSC bundle (no 'use client' = server component)
  MyPageSSR.tsx          -> Server + Client bundles ('use client' = client component)
  MyPageClient.client.tsx -> Client bundle only (hydration entry)
  MyPageClient.server.tsx -> Server bundle only (SSR with ChunkExtractor)
```

For a server component, the startup file is minimal:

```typescript
// app/javascript/startup/MyPageRSC.tsx
// No 'use client' directive — this is a server component
export { default } from '../components/MyPageRSC';
```

This gets auto-registered via `registerServerComponent()` in the generated server bundle, which handles the three-bundle routing automatically.

### The Server Component

```typescript
// app/javascript/components/MyPageRSC.tsx
// No 'use client' — server component

import React, { Suspense } from 'react';
import { formatDate } from '../utils/formatDate'; // Heavy library, stays server-side

interface Props {
  data: { title: string; date: string };
  getReactOnRailsAsyncProp: (name: string) => Promise<any>;
}

export default async function MyPageRSC({ data, getReactOnRailsAsyncProp }: Props) {
  // This code runs ONLY on the server — never shipped to the browser
  const formattedDate = formatDate(data.date);

  return (
    <div>
      <h1>{data.title}</h1>
      <time>{formattedDate}</time>

      <Suspense fallback={<LoadingSkeleton />}>
        <AsyncSection getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
      </Suspense>
    </div>
  );
}
```

### The Controller

```ruby
# app/controllers/pages_controller.rb
class PagesController < ApplicationController
  include ReactOnRailsPro::RSCPayloadRenderer
  include ReactOnRailsPro::AsyncRendering

  enable_async_react_rendering only: [:show_rsc]

  def show_rsc
    @page_data = { title: 'My Page', date: Date.today.iso8601 }
    stream_view_containing_react_components(template: 'pages/show_rsc')
  end
end
```

Three controller concerns are required:
1. **`RSCPayloadRenderer`** — Handles RSC payload generation and the `rsc_payload/` endpoint
2. **`AsyncRendering`** — Provides streaming support and the `enable_async_react_rendering` class method
3. **`stream_view_containing_react_components`** — Replaces the default `render` to enable HTTP streaming

### The View Template

```erb
<%%= stream_react_component_with_async_props(
  "MyPageRSC",
  props: { data: @page_data },
  prerender: true
) do |emit|
  # This block runs in a background thread
  # Each emit.call sends a named data chunk to the React component
  sleep 2  # Simulate slow database query
  emit.call("related_items", {
    items: ExpensiveQuery.find_related(@page_data[:id])
  })
end %>
```

## Step 4: Implement Streaming with Async Props

The streaming pattern is what makes RSC truly powerful in Rails. Instead of waiting for all data before rendering, Rails streams data chunks as they resolve. React renders each chunk into the appropriate Suspense boundary.

### How the Emit Pattern Works

```
Timeline:
  0ms   Rails starts streaming HTML + RSC payload
  0ms   React renders server component with Suspense fallbacks
  50ms  User sees the page with loading skeletons
  1500ms  emit.call("related_posts", data) sends data
  1500ms  React replaces <Suspense> fallback with actual content
```

### The Async Server Component

The component that receives streamed data uses `getReactOnRailsAsyncProp` — a function injected by React on Rails that returns a Promise resolving when Rails calls `emit.call` with the matching prop name:

```typescript
// app/javascript/components/AsyncRelatedPostsRSC.tsx
// No 'use client' — server component

import React from 'react';

interface Props {
  getReactOnRailsAsyncProp: (propName: string) => Promise<any>;
}

export default async function AsyncRelatedPostsRSC({
  getReactOnRailsAsyncProp
}: Props) {
  // This await resolves when Rails calls emit.call("related_posts", data)
  const data = await getReactOnRailsAsyncProp('related_posts');

  return (
    <section>
      <h2>Related Posts</h2>
      {data.posts.map(post => (
        <article key={post.id}>
          <h3>{post.title}</h3>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </section>
  );
}
```

### Composing with Suspense

Wrap async components in `<Suspense>` to show fallback UI while data streams in:

```typescript
// In the parent server component:
import React, { Suspense } from 'react';
import AsyncRelatedPostsRSC from './AsyncRelatedPostsRSC';
import { RelatedPostsSkeleton } from './RelatedPostsSkeleton';

export default async function BlogPostRSC({ post, getReactOnRailsAsyncProp }) {
  return (
    <div>
      <article>{/* ... main content ... */}</article>

      {/* User sees RelatedPostsSkeleton immediately */}
      {/* Replaced with real content when emit.call resolves */}
      <Suspense fallback={<RelatedPostsSkeleton />}>
        <AsyncRelatedPostsRSC
          getReactOnRailsAsyncProp={getReactOnRailsAsyncProp}
        />
      </Suspense>
    </div>
  );
}
```

### Multiple Concurrent Streams

You can emit multiple async props independently. Each resolves its own Suspense boundary:

```erb
<%%= stream_react_component_with_async_props(
  "DashboardRSC",
  props: { user: @user },
  prerender: true
) do |emit|
  # These can resolve in any order — each streams independently
  Thread.new { emit.call("notifications", Notification.recent(@user.id)) }
  Thread.new { emit.call("analytics", Analytics.summary(@user.id)) }
  Thread.new { emit.call("recommendations", Recommender.for(@user.id)) }
end %>
```

## Step 5: Migration Strategy for Existing Pages

You don't need to migrate everything at once. React on Rails supports all three rendering patterns side by side:

### Pattern 1: Keep as Client Component (No Change)

For pages that are highly interactive (forms, real-time updates, complex state), keep them as client components. No migration needed.

```typescript
// startup/FormPage.tsx
'use client';
export { default } from '../components/FormPage';
```

### Pattern 2: Convert to RSC (Server Rendering, Zero Client JS)

For pages that are primarily content (blogs, documentation, product pages), convert to RSC. The component code and all rendering libraries stay server-side.

```typescript
// Before (client component — all libraries shipped to browser):
'use client';
import { marked } from 'marked';
import hljs from 'highlight.js';

export default function BlogPost({ post }) {
  const html = marked(post.content); // 350KB shipped to client
  return <article dangerouslySetInnerHTML={{ __html: html }} />;
}

// After (server component — libraries stay on server):
// No 'use client'
import { marked } from 'marked';
import hljs from 'highlight.js';

export default async function BlogPost({ post }) {
  const html = marked(post.content); // 350KB stays server-side
  return <article dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### Pattern 3: Hybrid (Server Component with Client Islands)

The most common pattern. The page shell is a server component, with small `'use client'` components for interactive elements:

```typescript
// Server component (page shell)
import { HeavyChartLibrary } from 'chart-lib';    // Server-only
import { InteractiveFilter } from './Filter';       // 'use client'
import { ShareButton } from './ShareButton';         // 'use client'

export default async function AnalyticsPage({ data }) {
  const chartSvg = HeavyChartLibrary.render(data);  // Server-only rendering

  return (
    <div>
      <InteractiveFilter />           {/* ~3KB client JS */}
      <div dangerouslySetInnerHTML={{ __html: chartSvg }} />
      <ShareButton url={data.url} /> {/* ~1KB client JS */}
    </div>
  );
}
// Total client JS: ~4KB instead of ~200KB+
```

## Common Migration Patterns

### Converting `useEffect` Data Fetching to Async Props

**Before (client-side fetching):**

```typescript
'use client';
import { useState, useEffect } from 'react';

export default function Dashboard({ userId }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}/stats`)
      .then(r => r.json())
      .then(setStats);
  }, [userId]);

  if (!stats) return <Spinner />;
  return <StatsGrid stats={stats} />;
}
```

**After (RSC with streaming):**

```typescript
// No 'use client'
import { Suspense } from 'react';

export default async function Dashboard({ userId, getReactOnRailsAsyncProp }) {
  return (
    <Suspense fallback={<Spinner />}>
      <AsyncStats getReactOnRailsAsyncProp={getReactOnRailsAsyncProp} />
    </Suspense>
  );
}

// Separate async server component
async function AsyncStats({ getReactOnRailsAsyncProp }) {
  const stats = await getReactOnRailsAsyncProp('user_stats');
  return <StatsGrid stats={stats} />;
}
```

```erb
<%%= stream_react_component_with_async_props(
  "Dashboard",
  props: { userId: @user.id },
  prerender: true
) do |emit|
  stats = UserStats.compute(@user.id)
  emit.call("user_stats", stats)
end %>
```

### Handling Components That Need Both Server and Client Behavior

Sometimes a component needs server-side rendering for heavy computation but client-side interactivity for user actions. Split it into two:

```typescript
// ServerRenderedChart.tsx — No 'use client' (server component)
import { ChartLibrary } from 'heavy-chart-lib'; // 500KB, server-only

interface Props {
  data: number[];
}

export function ServerRenderedChart({ data }: Props) {
  const svg = ChartLibrary.renderToSVG(data);
  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <ChartControls data={data} />
    </div>
  );
}
```

```typescript
// ChartControls.tsx — 'use client' (client component)
'use client';
import { useState } from 'react';

export function ChartControls({ data }: { data: number[] }) {
  const [zoom, setZoom] = useState(1);
  // Lightweight client-side interactions only
  return (
    <div>
      <button onClick={() => setZoom(z => z * 1.2)}>Zoom In</button>
      <button onClick={() => setZoom(z => z / 1.2)}>Zoom Out</button>
    </div>
  );
}
```

## Verifying Your Migration

### Check Bundle Sizes in DevTools

The most tangible benefit of RSC is measurable in the browser's Network tab:

1. **Before RSC:** Open DevTools Network tab, filter by JS. Note the total JavaScript transferred.
2. **After RSC:** Same page with RSC. The server-only libraries should be completely absent from the JS waterfall.

For example, a blog page using `marked` (50KB) and `highlight.js` (300KB+):
- **Client component version:** ~350KB+ of rendering libraries in the JS payload
- **RSC version:** 0KB of those libraries — only the tiny interactive components (~2-3KB)

### Verify Streaming Behavior

1. Open the Network tab and watch the HTML response
2. The initial response arrives immediately with Suspense fallbacks
3. Additional `<script>` tags stream in as each `emit.call` resolves
4. React swaps the fallbacks with real content — no full-page re-render

### Check Server Component Isolation

In the browser console, try accessing a server-only module:

```javascript
// This should NOT be available in the browser:
import('highlight.js').then(m => console.log(m));
// If RSC is working correctly, this import will fail or not exist
// in the client bundle at all
```

## Troubleshooting

### "Module not found" in RSC Bundle

If the RSC bundle fails to compile with module resolution errors, ensure the `conditionNames` includes `'react-server'`:

```javascript
// rscWebpackConfig.js
rscConfig.resolve.conditionNames = ['react-server', '...'];
```

The `'...'` is important — it tells webpack to also check the default conditions after checking `react-server`.

### Hydration Mismatches

If you see hydration errors after migrating to RSC, the most common cause is a component that uses browser APIs without `'use client'`. Check for:

- `window`, `document`, `localStorage` references
- `useEffect`, `useState`, or other hooks
- Event handler props (`onClick`, `onChange`)

All of these require the `'use client'` directive.

### SWC Loader Compatibility

When using SWC (the default transpiler in Shakapacker), the RSC WebpackLoader must run **after** SWC compilation. Shakapacker configures SWC as a function-based loader, not an array:

```javascript
// Shakapacker sets: rule.use = (info) => ({ loader: 'swc-loader', options })
// NOT: rule.use = [{ loader: 'swc-loader', options }]

// This is why the RSC loader must be a SEPARATE rule with enforce: 'post'
// rather than being appended to the existing SWC rule
rscConfig.module.rules.push({
  test: /\\.(ts|tsx|js|jsx|mjs)$/,
  enforce: 'post',
  loader: 'react-on-rails-rsc/WebpackLoader',
});
```

### Performance: Script Loading Strategy

For streaming pages, use `async` (not `defer`) for script loading. The `defer` attribute delays execution until the entire HTML document is parsed — which defeats the purpose of streaming, since streamed chunks arrive after the initial HTML.

```ruby
# config/initializers/react_on_rails.rb
ReactOnRails.configure do |config|
  # Use :async for streaming pages (default in Shakapacker >= 8.2.0)
  config.generated_component_packs_loading_strategy = :async
end
```

### Node Renderer Context

If server components crash with `ReferenceError: performance is not defined`, add missing globals to the Node renderer's VM context:

```javascript
// node-renderer.js
const config = {
  additionalContext: {
    URL,
    AbortController,
    performance, // Required by React.lazy() in development
  },
};
```

## Summary

Migrating to RSC with React on Rails is an incremental process:

1. **Enable RSC support** — Configure the three-bundle architecture with webpack and Rails initializers
2. **Add `'use client'` to existing components** — Mark all interactive components explicitly
3. **Convert content-heavy pages** — Move rendering-only pages to server components
4. **Add streaming for slow data** — Use `stream_react_component_with_async_props` with Suspense
5. **Measure the impact** — Check bundle sizes and streaming behavior in DevTools

The key mental model: **server components are the default, client components are the opt-in exception.** Push interactivity to the leaves of your component tree, and let the server handle everything else. Your users get faster page loads, less JavaScript to parse, and a progressively-rendered experience — all while your Rails backend remains the single source of truth for data.
    MARKDOWN
  }.freeze

  RELATED_POSTS = [
    {
      id: 2,
      title: "Understanding the RSC Three-Bundle Architecture",
      excerpt: "A deep dive into how React on Rails manages client, server, and RSC bundles with webpack — and why each bundle exists.",
      date: "2025-06-08",
      tags: %w[react-on-rails rsc webpack]
    },
    {
      id: 3,
      title: "Streaming Patterns for Rails and React",
      excerpt: "Advanced streaming techniques using Suspense boundaries, concurrent data loading, and progressive rendering in React on Rails.",
      date: "2025-05-22",
      tags: %w[streaming suspense rails]
    },
    {
      id: 4,
      title: "Client Components vs Server Components: When to Use Which",
      excerpt: "A practical decision framework for choosing between 'use client' components and server components in your React on Rails app.",
      date: "2025-05-15",
      tags: %w[react rsc architecture]
    },
    {
      id: 5,
      title: "Optimizing Bundle Size with React Server Components",
      excerpt: "How to identify heavy client-side libraries and move them server-side with RSC, with real-world before and after measurements.",
      date: "2025-05-01",
      tags: %w[performance rsc optimization]
    }
  ].freeze

  def self.find_post(id)
    return nil unless id.to_i == MAIN_POST[:id]

    MAIN_POST.merge(reading_time: reading_time_label(MAIN_POST[:content]))
  end

  def self.related_posts(exclude_id)
    RELATED_POSTS.reject { |p| p[:id] == exclude_id.to_i }
  end

  # Server-side reading-time estimate. Computed from the markdown body so it
  # stays accurate when the content changes; never shipped to the browser.
  WORDS_PER_MINUTE = 230

  def self.reading_time_label(content)
    word_count = content.to_s.scan(/\w+/).size
    minutes = [(word_count.to_f / WORDS_PER_MINUTE).ceil, 1].max
    "#{minutes} min read (#{word_count.to_s.reverse.gsub(/(\d{3})(?=\d)/, '\\1,').reverse} words)"
  end
end
