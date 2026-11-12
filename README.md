# React on Rails Marketplace Demo

Compare server-side rendering (SSR), client-side loading, and React Server Components (RSC) streaming in a Rails app. The demo includes product search, product and restaurant details, blog posts, and cached variants.

- [Live demo](https://rsc.reactonrails.com/)
- [Source code](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc)
- [Contributing and local verification](./CONTRIBUTING.md)
- [Issue tracker](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues)

## Explore the demo

Open the same page in each rendering mode to compare its loading behavior and browser JavaScript:

| Page | SSR | Client | RSC |
| --- | --- | --- | --- |
| Blog post | [SSR](https://rsc.reactonrails.com/blog/ssr) | [Client](https://rsc.reactonrails.com/blog/client) | [RSC](https://rsc.reactonrails.com/blog/rsc) |
| Product detail | [SSR](https://rsc.reactonrails.com/product/ssr) | [Client](https://rsc.reactonrails.com/product/client) | [RSC](https://rsc.reactonrails.com/product/rsc) |
| Restaurant detail | [SSR](https://rsc.reactonrails.com/restaurant/1/ssr) | [Client](https://rsc.reactonrails.com/restaurant/1/client) | [RSC](https://rsc.reactonrails.com/restaurant/1/rsc) |
| Product search | [SSR](https://rsc.reactonrails.com/product-search/ssr) | [Client](https://rsc.reactonrails.com/product-search/client) | [RSC](https://rsc.reactonrails.com/product-search/rsc) |

[Browse products](https://rsc.reactonrails.com/products) opens the RSC product search. Each family also has SSR and RSC cached variants; start with the [cached SSR blog](https://rsc.reactonrails.com/blog/ssr-cached) and [cached RSC blog](https://rsc.reactonrails.com/blog/rsc-cached). See the [cached-variant measurements](./docs/cached-page-variants-benchmark.md) for cache state and test conditions.

Other examples:

- [Product pull mode](https://rsc.reactonrails.com/product/rsc-pull): bidirectional async props and server caching; [design and measurements](./docs/pull-mode-async-props-benchmark.md).
- [Media gallery](https://rsc.reactonrails.com/media-gallery): video and image galleries rendered RSC-first.
- CSS code splitting: compare [SSR](https://rsc.reactonrails.com/css-demo/one/ssr), [RSC server components](https://rsc.reactonrails.com/css-demo/one/rsc-server), and [RSC client components](https://rsc.reactonrails.com/css-demo/one/rsc-client); the [experiment report](./docs/css-code-splitting-experiment.md) describes the observed CSS delivery limitations.
- [Interactive SSR/RSC playground](https://rsc.reactonrails.com/ssr-rsc-playground) and [how RSC works](https://rsc.reactonrails.com/how-rsc-works).

This is a curated tour. [The route contract](./spec/support/route_contract.rb) lists the full GET-route inventory, including experiments with feature flags or other prerequisites. Those experiments are not part of the default tour.

## Run locally

Prerequisites: Ruby **3.4.9**, PostgreSQL, Node **22.12+** (or a supported Node 20 release listed in [package.json](./package.json)), and pnpm **9.15.2**. Ruby and JavaScript dependencies are pinned in [Gemfile](./Gemfile) and [package.json](./package.json).

```bash
bundle install
pnpm install --frozen-lockfile
bin/rails db:prepare
bin/dev
```

Open [localhost:3000](http://localhost:3000/), then use the same paths as the live-demo links above. `bin/dev` runs Rails, asset watchers, and the Node renderer together. Rails uses port 3000 and the renderer defaults to port 3800.

The app uses Rails 8.1, React 19, React on Rails Pro, TypeScript, and Tailwind CSS. Production builds use Rspack through Shakapacker; Webpack configurations remain available for comparison. See [the bundler migration notes](./RSPACK_MIGRATION.md) for details.

### Seed data and a quick check

`db:prepare` uses the default `SEED_MODE=small` on a new database. This still creates substantial review data and may take several minutes. `SEED_MODE=full` is an opt-in large restaurant dataset, not a prerequisite for browsing the demo. [The seed entry point](./db/seeds.rb) selects the restaurant seed mode and also seeds products, product reviews, and the search catalog.

Dataset sizes depend on seed mode and the deployed database. Product counts and review counts describe different things; the old planning targets do not describe every deployment.

With the app running, check health and the actual product-search API:

```bash
curl --fail http://localhost:3000/up
curl --fail http://localhost:3000/api/product_search/results
```

The search response includes `total_count`, which reports the current matching product count.

## A short walkthrough

1. Open the blog's SSR, client, and RSC links from the table. Compare when content appears and inspect JavaScript requests in browser developer tools.
2. Repeat with product search; use the same filters and pagination to compare equivalent results.
3. Open the [performance evidence page](https://rsc.reactonrails.com/rsc-performance) to inspect the linked reports and their measurement conditions.

Performance depends on the page, device, network, cache state, dataset, and build. This README makes no universal speedup claim. [PERFORMANCE_EVIDENCE.md](./PERFORMANCE_EVIDENCE.md) records dated measurements and their limitations; [BENCHMARKING.md](./BENCHMARKING.md) explains how to reproduce measurements and compare changes.

## Contribute and read further

- [CONTRIBUTING.md](./CONTRIBUTING.md): development setup, RSpec, lint, browser journeys, and PR expectations.
- [DOCS_MANIFEST.md](./DOCS_MANIFEST.md): current guides and experiment reports.
- [Deployment guide](./.controlplane/README.md): Control Plane environments and review apps.
- [React on Rails documentation](https://reactonrails.com/docs).
- [TanStack Query integration](https://reactonrails.com/docs/building-features/tanstack-query): an option for interactive client-owned state alongside RSC; [companion starter](https://starter.reactonrails.com).

The [original implementation plan](./IMPLEMENTATION_TASKS.md) and [task specifications](./tasks/Task_1_Setup_and_Database.md) are historical design material. Their routes, commands, performance targets, and completion checklists are not current operating instructions.

The documentation route guard checks this README and the contributor guide against the canonical route contract. It also checks local file links and executable entry points. Update those documents when changing routes; see [the guard](./spec/routing/documented_routes_spec.rb).
