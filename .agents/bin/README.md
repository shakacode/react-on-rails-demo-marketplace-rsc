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
| `build` | Production asset build | `pnpm build:production` |
| `docs` | Docs checks | n/a |
| `ci-detect` | CI change detector | n/a |

Non-command policy lives in [`../agent-workflow.yml`](../agent-workflow.yml).
