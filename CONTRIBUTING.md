# Contributing

Thanks for improving the React on Rails marketplace demo.

This repo exists to make SSR, client components, and React Server Components easy to compare in one place. Contributions should keep that comparison credible and easy to understand.

## Before you start

- Keep the user journeys aligned across the SSR, client, and RSC variants unless the change is explicitly about a behavioral difference.
- Preserve the benchmark story. Artificially removing the slow parts of the demo makes the comparison less useful.
- When you change the deployed experience, make the source code and contributor entry points easier to find, not harder.

## Local setup

1. Install Ruby `3.4.9`, PostgreSQL, and Node `22.12` or newer (or a supported Node 20 release in `package.json`), and pnpm `9.15.2`.
2. Install dependencies:

   ```bash
   bundle install
   pnpm install --frozen-lockfile
   ```

3. Prepare the database:

   ```bash
   bin/rails db:prepare
   ```

4. Start the app:

   ```bash
   bin/dev
   ```

5. Open `http://localhost:3000`.

## Useful routes

- `/` for the demo landing page and project links
- `/products` for the RSC product catalog
- `/blog/ssr`, `/blog/client`, `/blog/rsc`
- `/product/ssr`, `/product/client`, `/product/rsc`
- `/product-search/ssr`, `/product-search/client`, `/product-search/rsc`
- `/restaurant/1/ssr`, `/restaurant/1/client`, `/restaurant/1/rsc`
- `/media-gallery` for the multimedia showcase
- `/rsc-performance` for linked performance reports

The [README demo table](./README.md#explore-the-demo) links to the live versions. The [route contract](./spec/support/route_contract.rb) is the complete GET-route inventory, including feature-gated experiments.

## Demo guardrails

- Treat the variants as apples-to-apples comparisons. If you add a feature to one route family, check whether it belongs in the others too.
- Keep realistic latency in place for the data-heavy flows. The demo is meant to show the architectural difference under load.
- If you touch the RSC pipeline, confirm the SSR and client versions still render the same core information.
- If you change deployment behavior, update [`.controlplane/README.md`](./.controlplane/README.md) as part of the same PR.

## Local validation

Use the repo-specific verification commands before opening or updating a PR:

```bash
bundle exec rspec spec/requests spec/routing spec/services spec/concerns spec/workflows spec/ppr_production_boot_spec.rb
script/demo-fleet-verify
pnpm type-check
pnpm lint
bundle exec rubocop
git diff --check
```

`script/demo-fleet-verify` is the broad demo gate. It runs E2E type checks, lint and support unit tests, the Rails task, RSC import checks, the production build, and RSC chunk verification. RSpec runs separately; `bundle exec rake` does not run it.

The routing specs check README and contributor-guide routes against the canonical route contract. CI runs these specs for changes to either document, including documentation-only PRs.

`pnpm lint` checks the JavaScript and TypeScript app tree with the repo ESLint config. `bundle exec rubocop` checks Ruby files with the repo RuboCop config and the current TODO baseline; remove entries from `.rubocop_todo.yml` as existing Ruby style debt is fixed.

### Browser journey

After the normal dependency install, install Playwright's Chromium binary once:

```bash
pnpm exec playwright install chromium
```

Run the canonical Rails-aware browser test with:

```bash
pnpm test:e2e
```

This command uses its own `localhub_demo_playwright` database — not the
`localhub_demo_test` one `bundle exec rspec` uses — and deletes its product and
product-review rows before and after the journey, so the two suites can run at
the same time without truncating each other's data. It enables a loopback-only
Rails command bridge with an ephemeral capability token for two allowlisted
repository files; the bridge remains disabled during normal app development
and cannot boot in production. See
[`e2e/README.md`](./e2e/README.md) for the security boundary and artifact paths.

## Documentation to read first

- [README.md](./README.md)
- [PERFORMANCE_EVIDENCE.md](./PERFORMANCE_EVIDENCE.md)
- [BENCHMARKING.md](./BENCHMARKING.md)
- [DOCS_MANIFEST.md](./DOCS_MANIFEST.md)

## Pull requests

Please keep PRs focused and include:

- a short summary of what changed
- a test plan with commands you ran or the checks you performed
- screenshots or route notes for visible UI changes
- benchmark notes if the change affects the comparison story

If your work changes deployment or review-app behavior, mention that explicitly in the PR description.

## Questions and follow-up

- Repo issues: https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues
- React on Rails docs: https://reactonrails.com/docs
- ShakaCode forum: https://forum.shakacode.com/c/reactjs
