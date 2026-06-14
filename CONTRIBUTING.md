# Contributing

Thanks for improving the React on Rails marketplace demo.

This repo exists to make SSR, client components, and React Server Components easy to compare in one place. Contributions should keep that comparison credible and easy to understand.

## Before you start

- Keep the user journeys aligned across the SSR, client, and RSC variants unless the change is explicitly about a behavioral difference.
- Preserve the benchmark story. Artificially removing the slow parts of the demo makes the comparison less useful.
- When you change the deployed experience, make the source code and contributor entry points easier to find, not harder.

## Local setup

1. Install Ruby `3.3.0`, PostgreSQL, and Node `20.x` or newer.
2. Install dependencies:

   ```bash
   bundle install
   pnpm install
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
- `/search/ssr`, `/search/client`, `/search/rsc`
- `/blog/ssr`, `/blog/client`, `/blog/rsc`
- `/product/ssr`, `/product/client`, `/product/rsc`
- `/product-search/ssr`, `/product-search/client`, `/product-search/rsc`
- `/analytics/ssr`, `/analytics/client`, `/analytics/rsc`
- `/dashboard` for comparison metrics

## Demo guardrails

- Treat the variants as apples-to-apples comparisons. If you add a feature to one route family, check whether it belongs in the others too.
- Keep realistic latency in place for the data-heavy flows. The demo is meant to show the architectural difference under load.
- If you touch the RSC pipeline, confirm the SSR and client versions still render the same core information.
- If you change deployment behavior, update [`.controlplane/README.md`](./.controlplane/README.md) as part of the same PR.

## Local validation

Use the repo-specific verification commands before opening or updating a PR:

```bash
script/demo-fleet-verify
pnpm type-check
pnpm lint
bundle exec rubocop
git diff --check
```

`script/demo-fleet-verify` is the broad demo gate. It runs the Rails test task, RSC import checks, generated pack checks, the production build, and RSC chunk verification.

`pnpm lint` checks the JavaScript and TypeScript app tree with the repo ESLint config. `bundle exec rubocop` checks Ruby files with the repo RuboCop config and the current TODO baseline; remove entries from `.rubocop_todo.yml` as existing Ruby style debt is fixed.

## Documentation to read first

- [README.md](./README.md)
- [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md)
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

- Repo issues: https://github.com/shakacode/react-server-components-marketplace-demo/issues
- React on Rails docs: https://reactonrails.com/docs
- ShakaCode forum: https://forum.shakacode.com/c/reactjs
