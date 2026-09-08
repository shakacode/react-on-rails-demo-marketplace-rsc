# Rails-aware Playwright tests

Run the headless Chromium journey from the repository root:

```bash
pnpm test:e2e
```

The command prepares the journey database, starts the node renderer and Rails
on fixed loopback ports, seeds deterministic product-search, product-page, and
restaurant-detail data, runs Playwright journeys for products, search, blogs,
and restaurants, and stops both servers. The cleanup command deletes products,
product reviews, restaurants, and dependent restaurant records from that
database before and after every stateful test. Both the runner and app commands
refuse database names that do not end in `_test` or `_playwright`.

Local runs use their own `localhub_demo_playwright` database, not the shared
`localhub_demo_test` one that `bundle exec rspec` uses; the runner defaults
`DATABASE_URL` to `postgres:///localhub_demo_playwright` and `bin/rails
db:prepare` creates it on first use. That keeps RSpec's `before(:suite)`
truncation of `_test` databases from deleting a journey's fixtures mid-run. CI
sets `DATABASE_URL` itself and the default leaves that value alone; export your
own `DATABASE_URL` to point a local run somewhere else.

The test compiler writes `loadable-stats.json` under `public/packs-test`, while
the node renderer copies configured companion assets from `public/packs`. The
runner stages that generated test file at the renderer path before startup and
restores or removes it during cleanup, including after failures and signals.

## Rails command security boundary

The Rails command endpoint can execute repository-owned Ruby with the Rails
process's privileges. It is therefore disabled by default and available only
when Rails runs in the test environment. Development and production keep it
disabled. It is bound to `127.0.0.1` and rejects non-loopback socket peers. Even
when enabled by `E2E_RAILS_COMMANDS=1`, only the `clean` and
`scenarios/product_search` files are accepted. The runner generates a fresh
capability token for each invocation; only the Rails process's guarded command
middleware and Playwright's Node request client receive it. The node renderer,
browser, and page JavaScript do not receive the token. Requests with an Origin,
a non-JSON content type, or an invalid token are rejected, and the gem's
unauthenticated state-reset middleware is never mounted.

Do not expose port 5017, log or pass the token to page JavaScript, or add a
generic eval command.
