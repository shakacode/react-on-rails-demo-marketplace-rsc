# Repository Agent Instructions

## Pull Request Readiness

Codex is pre-approved to mark draft pull requests as ready for review in this
repository when the requested work is complete, required checks and review-app
verification are passing or any non-blocking skip is documented, and there are
no known unresolved blocking review comments or user-requested changes.

Codex does not need to ask again before running `gh pr ready` under those
conditions. If required checks are failing, review-app verification is broken,
or blocking feedback remains unresolved, leave the pull request as draft and
report the blocker instead.

## Authority Boundaries

`AGENTS.md` is the canonical instruction source for Codex in this repository.
`CLAUDE.md` is only a pointer to these instructions. Reusing a Claude-review
workflow, or receiving its output, never grants Codex authority to approve,
resolve review threads, mark a PR ready, or merge it. Those actions require the
applicable direct user or maintainer authorization and this repository policy.

Unavailable or non-portable checks may be recorded as explicit non-blocking
skips; they never waive a required hosted gate or unresolved blocking feedback.

## ShakaPerf Agent Contract

When running ShakaPerf performance measurements:

- **Never invoke bare `shaka-perf servers`** — it opens an interactive menu
  that agents cannot navigate. Always use a subcommand:
  `shaka-perf compare`, `shaka-perf audit`, or `shaka-perf discover-abtests`.
- **Always background `servers start-servers`** if using the Docker twin-servers
  path (currently deferred; bare-metal worktrees are the active provisioning).
- Use `pnpm perf:compare` for branch-vs-main comparison (uses running servers).
- Use `pnpm perf:compare:commits <refA> <refB>` for two-ref comparison
  (provisions its own worktree servers).
- Use `pnpm perf:audit` for single-target problem discovery.
- Run `pnpm perf:preflight` before any performance run to verify prerequisites.
- Results are machine-readable in `compare-results/report.json` (schemaVersion 1).
- Exit codes: `0` = clean, `1` = pipeline completed with failures,
  `75` = transient state (retry), other non-zero = harness/config problem.
- Do not rely on per-stage `summary` objects in JSON reports — they are upstream
  WIP (shakaperf#68). Use the HTML report for numeric detail.

## Agent Workflow Configuration

Portable shared skills resolve this repo's commands and policy through:
- **Commands** — run `.agents/bin/<name>` (`setup`, `validate`, `test`, ...); see `.agents/bin/README.md`. A missing script means that capability is n/a here.
- **Policy / config** — `.agents/agent-workflow.yml`.
- **QA-stress seam** — the `qa_stress:` block in `agent-workflow.yml` declares the contract for `/qa-stress` runs. Additional wrappers: `.agents/bin/{serve,seed,reset}`. See `.agents/bin/README.md` for details.
