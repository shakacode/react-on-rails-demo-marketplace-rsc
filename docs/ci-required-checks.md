# Required status checks on `main`

How CI results gate merges in this repo, and the rules for keeping that gate
safe. Design history and full rollout plan: `docs/issue-206-required-checks-plan.md`
([#206](https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/206)).

## The required contexts

| Required check | Emitted by | What it proves |
|---|---|---|
| `browser-smoke` | `browser-smoke.yml` | Production build boots Rails + Node renderer; Chromium smokes every public route |
| `demo-fleet-smoke-result` | `demo-fleet-smoke.yml` (wrapper around the react_on_rails reusable workflow) | The fleet smoke (`bundle exec rake`, `pnpm lint:rsc`, `pnpm verify:rsc`) passed |
| `rspec-result` | `specs.yml` (wrapper around the `rspec` job) | Request/routing specs passed — or nothing Ruby-relevant changed |

Deliberately **not** required: `e2e` (rsc-rspack-e2e.yml, ~40 min, narrow
path filter is a cost-control decision), review-app `deploy` (infra-flaky,
secret-dependent), and all AI review checks (advisory by repo policy).

## The one rule when touching these workflows

**A required context must be always-emitting.** If a required check never
starts on a PR — most commonly because a workflow-level `paths:` filter stopped
the whole workflow — GitHub waits for it forever and the PR can never merge,
not even a README typo.

Therefore:

- Never add a workflow-level `paths:` filter under `on.pull_request` to a
  workflow that emits a required context. Put the filter in a `detect-changes`
  job and skip the expensive job at the job level (see `specs.yml` for the
  pattern; keep its two path lists in sync).
- Never require a check whose name this repo does not control. The fleet
  smoke's own check (`smoke / Demo fleet smoke`) is named inside
  react_on_rails's reusable workflow — a pin bump could rename it and silently
  wedge every PR. That is what the local `demo-fleet-smoke-result` wrapper is
  for.
- If you rename a required job, update `.github/rulesets/main.json` and re-apply
  it (below) in the same change, or merges will hang on the old name.

## The ruleset

`.github/rulesets/main.json` is the versioned source of truth for GitHub
ruleset `14614926`. GitHub does not read it automatically — an admin applies it:

```bash
R=shakacode/react-on-rails-demo-marketplace-rsc

# apply the file to the live ruleset
gh api --method PUT repos/$R/rulesets/14614926 --input .github/rulesets/main.json

# what is actually enforced on main right now
gh api repos/$R/rules/branches/main
```

**Rollback (seconds, admin):** set `"enforcement": "disabled"` in the file and
re-apply — or as an emergency one-off:

```bash
gh api repos/$R/rulesets/14614926 \
  | jq '{name,target,enforcement:"disabled",conditions,bypass_actors,rules}' \
  | gh api --method PUT repos/$R/rulesets/14614926 --input -
```

Enforcement stages: `disabled` → `evaluate` (dry-run; results visible under
the repo's Rule Insights, nothing blocks) → `active`. The flip to
`evaluate`/`active` happens **only after** the #206 flip-gate checklist passes
(all prerequisite PRs merged, latest `main` push fully green) — see the plan
doc, section "Phase C".

## Failure alerts for non-PR runs

`workflow-failure-alerts.yml` watches `Cleanup Stale Review Apps` (nightly
cron) and `Deploy Staging to Control Plane` (push to main). On failure it opens
or updates a `ci-alert` issue mentioning the owners; after two consecutive
green runs it closes the issue. PR runs are ignored — the PR page already shows
those.

To test it end to end (only works after the file is on `main`):

```bash
gh workflow run "Cleanup Stale Review Apps" --repo $R   # currently fails by design
# → expect the `ci-alert` issue to appear/update within a minute of run completion
```
