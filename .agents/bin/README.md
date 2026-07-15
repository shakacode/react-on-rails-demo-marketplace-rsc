# Agent Workflow Scripts

Standard entry points that portable agent-workflow skills call, so a skill can
run `.agents/bin/<name>` in any repo without knowing this repo's specific
commands. Each script is a thin, repo-owned wrapper. A script that is **absent**
means that capability is n/a here.

| Script | Purpose | This repo runs |
| --- | --- | --- |
| `setup` | Bootstrap dependencies and database | `bin/setup` |
| `validate` | Broad demo validation gate | `script/demo-fleet-verify` |
| `test` | Run the Rails test task | `bundle exec rake` — this app has no committed RSpec suite; the broad demo gate also runs it |
| `lint` | Lint / format | `pnpm type-check`, `pnpm lint`, then `bundle exec rubocop` |
| `build` | Production asset build | `bin/build-production` (sets the Rails/secret/bundler environment, cleans generated assets, regenerates packs, then compiles bundles) |
| `docs` | Docs checks | n/a |
| `ci-detect` | CI change detector | n/a |

Non-command policy lives in [`../agent-workflow.yml`](../agent-workflow.yml).

## Local tool trust

This repository uses `mise.toml` for Ruby. The setup wrapper never runs `mise
trust` for you. Before the first setup in a checkout, review that file and run
`mise trust mise.toml` yourself; until then, `.agents/bin/setup` stops with this
manual prerequisite.
