# Agent Workflow Scripts

Shaka uses the generated wrappers in `.agents/shaka/bin/`. Older portable and
QA skills retain the archive-compatible tools in `.agents/bin/`. An absent script means that
capability is not available here. The Shaka setup wrapper delegates to
`setup`, which preserves the operator's manual mise trust prerequisite.

| Script | Purpose | This repo runs |
| --- | --- | --- |
| `../shaka/bin/setup` | Bootstrap dependencies and database | `bin/setup` |
| `../shaka/bin/validate` | Broad demo validation gate | `script/demo-fleet-verify` |
| `../shaka/bin/test` | Run executable Rails/RSC verification | `script/demo-fleet-verify` — this runs E2E type checks, lint and support unit tests, the Rails task, RSC import checks, pack generation, a production build, and RSC chunk verification |
| `setup`, `test`, `validate` | Compatibility entry points for older portable skills | The original root discovery and commands; suitable for archived QA workspaces |
| `lint` | Lint / format | `pnpm type-check`, `pnpm lint`, then `bundle exec rubocop` |
| `build` | Production asset build | `bin/build-production` (sets the Rails/secret/bundler environment, cleans generated assets, regenerates packs, then compiles bundles) |
| `install` | Install dependencies only | `bundle install` + `pnpm install --frozen-lockfile` — no database operations, safe for materialized QA workspaces |
| `serve` | Boot app for QA-stress runs | Rails + node-renderer on run-scoped ports (`QA_RAILS_PORT`/`QA_RENDERER_PORT`); requires `QA_RUN_ID`; generates synthetic secrets; health-probes both processes |
| `seed` | Create and seed QA database | `db:prepare` against `localhub_demo_qa_<QA_RUN_ID>` with `SEED_MODE=small`; refuses protected DB names |
| `reset` | Restore QA target to baseline | Drops and recreates the run DB, re-seeds, clears renderer bundle cache and Rails cache |
| `docs` | Docs checks | n/a |
| `ci-detect` | CI change detector | n/a |

Shaka delivery settings live in [`../shaka/config.yml`](../shaka/config.yml). Human constraints live in [`../../AGENTS.md`](../../AGENTS.md); operational notes live in [`../operations.yml`](../operations.yml).

## QA-stress contract

The `qa_stress:` block in [`../qa-stress.yml`](../qa-stress.yml) declares the seam that the
`/qa-stress` skill reads during its Phase 0 contract check. It covers:

- **Workspace isolation** — `scratch_root`, `materialization` (`git archive`),
  `workspace_cleanup`
- **Database isolation** — per-run DB name template, protected-name guards
- **Install / serve / seed / reset** — the four QA wrappers above
- **Identity model** — cache-key + locale + request headers (no auth)
- **Load tool** — `autocannon` (named; not yet installed as devDependency)
- **Browser tool** — `puppeteer` (already a devDependency)
- **Tier configs** — quick / standard / deep (exhaustive marked unavailable)
- **Feature matrix** — derived from `.verify-routes.js` route inventory
- **Reporting** — workspace-only; no auto-filed issues; approval required for
  non-security findings
- **Fault injection** — forbidden for v1

## Local tool trust

This repository uses `mise.toml` for Ruby. The setup wrapper never runs `mise
trust` for you. Before the first setup in a checkout, review that file and run
`mise trust mise.toml` yourself; until then, `.agents/shaka/bin/setup` stops with this
manual prerequisite. `mise trust --show` also lists parent directories, so setup
accepts only the exact trusted-status line for this checkout. It stops if that
line is absent or unrecognized; a trusted parent, query failure, or output-format
error can never bypass the manual review step.
