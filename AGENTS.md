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

## Agent Workflow Configuration

Portable shared skills resolve this repo's commands and policy through:
- **Commands** — run `.agents/bin/<name>` (`setup`, `validate`, `test`, ...); see `.agents/bin/README.md`. A missing script means that capability is n/a here.
- **Policy / config** — `.agents/agent-workflow.yml`.
- **QA-stress seam** — the `qa_stress:` block in `agent-workflow.yml` declares the contract for `/qa-stress` runs. Additional wrappers: `.agents/bin/{serve,seed,reset}`. See `.agents/bin/README.md` for details.
