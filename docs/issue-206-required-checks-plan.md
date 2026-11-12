# Issue #206 — Make CI results actually gate merges on `main`

- **Issue:** https://github.com/shakacode/react-on-rails-demo-marketplace-rsc/issues/206
- **Branch:** `206-no-required-status-checks-on-main-ci-results` (from `main` @ `c8eae26`)
- **Plan written:** 2026-09-03, all evidence re-verified live against GitHub on this date
- **Status:** DECIDED & IMPLEMENTED (Phase A) — all former `[DECIDE]` points were resolved
  with the user on 2026-09-03 (answers recorded inline as **DECIDED**). Phase A files are
  written on this branch; Phases B–D pend on merge + prerequisites.

---

## Part 1 — What's going on here, in plain words

*This section assumes no knowledge of the codebase or of CI tooling. Read this first; everything below Part 2 is the technical version of the same plan.*

### What is the problem?

Every time someone proposes a change to this project, robots automatically run a battery of
tests: they build the site, click through its pages in a real browser, and check nothing is
broken. That part works.

The problem: **nobody is forced to look at the results.** The "Merge" button — the button
that accepts a change into the live codebase — works even when the tests are screaming red.
The tests are advice, not a gate. It's a smoke detector that blinks in a room nobody sits in,
instead of sounding an alarm.

### Has this actually hurt us, or is it theoretical?

It has hurt us, twice, measurably:

1. A nightly housekeeping robot ("clean up old preview copies of the site") has failed
   **96 times in a row over 3 months** — every single night — and nobody knew. (While
   researching this plan I found the reason: it's missing one configuration line. Details in
   Part 2.)
2. The robot that publishes the site to the staging server has failed on **every one of the
   last 13 updates** since July 21. Nobody was told.

Why did nobody notice? GitHub only emails these failures to whoever originally *created* the
scheduled robot — not to the team. If that person is busy or gone, the failures go nowhere.

### What is the fix?

Two switches, plus one alarm:

1. **Tell GitHub which tests must pass before the Merge button works.** GitHub has a
   built-in feature for this; this project has it half-configured and turned off. We pick the
   two test suites that already run on every proposed change, and mark them "required".
2. **Turn the enforcement on.** The half-configured rule that exists today is *off*, and even
   if turned on it wouldn't check any test results — so this is genuinely two steps: add the
   test requirement, then flip the whole thing on.
3. **Give failures a voice.** A small new robot watches the nightly/deploy robots. When one
   fails, it opens a ticket in the project's issue list, addressed to a named person. No more
   silent failures.

### Is there a trap to avoid?

Yes, one big one. Some of the test suites are deliberately configured to *not run* when a
change couldn't possibly affect them (example: a 40-minute build test doesn't run for a
README typo — that's a sensible cost saving). But GitHub's "required tests" feature has a
sharp edge: if a required test never starts, GitHub waits for it **forever**, and the change
can never be merged — not even a README typo.

The fix has two parts. The two suites that already run on *every* change are simply marked
required. The fast Ruby test suite (which used to skip irrelevant changes entirely) was
**reworked in this session**: it now always starts, a quick first step checks whether the
change could affect it, the real tests are skipped when they can't be, and a small final
step *always* reports a verdict — "passed" or "nothing to test" both count as green. That
reworked verdict is safe to require, so it's required too. (The slow 40-minute build test
keeps its cost-saving skip and stays *not* required.)

### Why can't we just flip it on today?

Because one of the two tests we want to require is **currently failing on the main copy of
the code** — for a reason unrelated to our code: it checks a public database of known
security problems in third-party libraries, and new entries appeared there overnight. Flip
the switch today and *every* change would be blocked until that's cleaned up.

Four other fixes (already in flight, by others: PRs #200, #166, #199 and issue #205) get main
back to green and make that test stop failing for outside-world reasons. **Order matters:
those land first, this lands last.** Everything in this plan except the final flip is safe to
do now, because adding rules while enforcement is off changes nothing.

### How will we know it worked?

We rehearse both directions:

- Open a throwaway change that deliberately breaks a test → GitHub must **refuse** to merge it.
- Open a harmless change (edit one comment line) → GitHub must allow merging normally.
- Trigger the (currently failing) nightly robot by hand → a ticket must appear, addressed to
  the named owner.

### What if it goes wrong?

One admin API call (or one click in settings) turns enforcement back off. Nothing in this
plan is irreversible, and none of it touches the application itself — only the project's
test-and-merge machinery. Worst realistic failure: merges get blocked for a while; the
undo takes seconds.

---

## Part 2 — Technical implementation plan

### 2.0 Verified current state (all live-checked 2026-09-03)

| Fact | Evidence |
|---|---|
| No branch protection on `main` | `gh api .../branches/main/protection` → 404 "Branch not protected" (per issue; consistent with below) |
| Ruleset `14614926` ("main", target `~DEFAULT_BRANCH`) exists, `enforcement: disabled` | `gh api repos/…/rulesets/14614926` |
| Its rules: `deletion`, `non_fast_forward`, `pull_request` (0 approvals, all merge methods, `require_extra_approval_for_unattributed_changes: true`). **No** `required_status_checks` rule. `bypass_actors: []` | same |
| No rules of any kind active on `main` right now (repo **or** org level) | `gh api repos/…/rules/branches/main` → `[]` |
| Org-level ruleset listing | UNKNOWN — token lacks `admin:org`; irrelevant while `rules/branches/main` is `[]`, i.e. nothing org-level is active on `main` today |
| We have admin on the repo | `gh repo view --json viewerPermission` → `ADMIN` (issue's "confirm admin rights early" — answered) |
| Checks that run on **every** PR (no path filter) | `browser-smoke` (browser-smoke.yml), `smoke / Demo fleet smoke` (demo-fleet-smoke.yml, reusable workflow from react_on_rails pinned @ `613c6c2`) |
| Checks that are **path-filtered** on PRs | `rspec` (specs.yml), `e2e` (rsc-rspack-e2e.yml, ~40 min, deliberately narrow) |
| Live proof of the pending-forever trap | PR #200's head `24a65d2` has **no** `rspec` check-run at all (its diff is outside specs.yml paths). If `rspec` were required today, #200 could never merge |
| `Browser Smoke` red on `main@c8eae26` | Its `pnpm audit:high` preflight step fails on new fast-uri (x4) + browserslist (x2) advisories — mechanism owned by issue #205 |
| `Deploy Staging` red on all pushes | Fix in flight: PR #200 |
| `Cleanup Stale Review Apps`: 96/96 scheduled failures | **Root cause found during this research:** exit 64 — `ERROR: Can't find option 'stale_app_image_deployed_days' for app 'react-server-components-demo-review' in 'controlplane.yml'` (run 33712767365). One missing config option in `.controlplane/controlplane.yml` |
| GitHub Actions app `integration_id` | `15368` (from check-run `.app.id`) |
| **Collision warning** | Open PR #204 touches ALL `cpflow-*.yml` workflow files (v5.3.0 wrapper upgrade). This plan deliberately does **not** edit any `cpflow-*.yml` file |

Prerequisite items (flip gate) as of today: PR #200 OPEN, PR #166 OPEN (stale vs the new
fast-uri advisories — needs refresh or a fast-uri bump), PR #199 OPEN (draft), issue #205 OPEN.

### 2.1 Design decisions

#### D1. Which checks become required — DECIDED 2026-09-03

**Decision: three — `browser-smoke`, `demo-fleet-smoke-result`, and `rspec-result`.**

- `browser-smoke` and the fleet smoke run on every PR with no path filter → no
  pending-forever trap. The fleet smoke is required via the locally-owned wrapper (D2).
- `rspec-result` joins because this session also implements the specs.yml always-emitting
  conversion (D2): the suite is seconds-fast and `main` is spec-green (verified by #208's
  dispatch run), so the whole point of the conversion is to require it.
- `e2e` stays **not required**: its narrow filter is a deliberate ~40-min cost control.
- Advisory checks are never required: `claude-review`, `Greptile Review`, review-app
  `deploy` (infra-flaky, secret-dependent), per repo policy ("AI reviewers are advisory").

#### D2. Aggregate check shape `[DECIDE]`

**Recommendation: per-workflow, locally-owned `*-result` jobs (`if: always()` + `needs`), not
one repo-wide mega-aggregate; and require the raw job where we already own its name.**

- `browser-smoke`: require the existing job name directly. It's defined in this repo; no
  wrapper needed.
- `Demo fleet smoke`: the PR-visible context is `smoke / Demo fleet smoke` — the inner job
  name is owned by *react_on_rails*'s reusable workflow. If a future pin bump renames that
  job, a required context would silently never report again → every PR wedged. So add to
  `demo-fleet-smoke.yml` a tiny local wrapper job (name we own, survives upstream renames):

  ```yaml
  # Always-emitting, locally-owned result for the required-checks gate (#206).
  # Required contexts must have names this repo controls: the reusable
  # workflow's inner job name ("smoke / Demo fleet smoke") belongs to
  # react_on_rails and a pin bump could rename it, silently wedging merges.
  demo-fleet-smoke-result:
    needs: [smoke]
    if: always()
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Fail unless the fleet smoke succeeded
        env:
          RESULT: ${{ needs.smoke.result }}
        run: |
          echo "Demo fleet smoke result: ${RESULT}"
          [[ "${RESULT}" == "success" ]]
  ```

- **DECIDED 2026-09-03 — the `specs.yml` conversion is implemented in this PR.** History:
  PR #208 (open, closes #207) adds the push trigger + `Rakefile`/`bin/**` paths but keeps
  `on.paths` at workflow level and labels the always-emitting pattern "#206 scope", while
  this plan had assigned it to #207 — the work was ownerless. Resolution: this PR owns it,
  written **on top of #208's file content**, and **lands after #208 merges** (chosen over
  superseding #208). Rebase note: at #208-merge time, re-check #208's final `specs.yml`
  didn't drift from the version this branch built on (`origin/207-specs-yml-no-push-trigger`
  as of today); if unchanged, taking ours resolves the conflict.
  Conversion shape implemented: `on.pull_request` loses its `paths:` (always starts);
  a cheap `detect-changes` job lists PR files via the API and matches the same path set
  (fail-OPEN: an API error runs the suite rather than skipping it); `rspec` gains
  `needs: detect-changes` + a job-level `if`; a final `rspec-result` (`if: always()`) is the
  required context — success when specs passed OR were legitimately skipped, failure when
  specs failed/cancelled **or the detector itself failed** (requiring bare `rspec` would
  count a detector breakage as a pass, since GitHub treats skipped-required as success).
  Push runs keep the workflow-level filter (not required-check relevant); the two path
  lists carry keep-in-sync comments.
  Rejected alternatives: one cross-workflow poller (racy, complex); mirrored "skipped-stub"
  workflows with inverse `paths-ignore` (filter drift hazard); merging all suites into one
  mega-workflow (loses per-suite concurrency groups, big blast radius); third-party
  paths-filter action (new supply-chain dependency for 15 lines of bash).

#### D3. Approvals — DECIDED 2026-09-03: keep 0; unattributed flag stays `true`, canary-tested

**Decision: keep `required_approving_review_count: 0`.** This is a demo repo
driven by one/two maintainers plus agents; requiring an approval today would stall solo work
without adding real review capacity. Revisit once more humans are active.

⚠️ Note the pre-existing `require_extra_approval_for_unattributed_changes: true` in the
`pull_request` rule. Once enforcement is on, this may demand an approval for commits GitHub
can't attribute to a GitHub account (possible with some agent/bot commit identities). The
canary rehearsal (2.4) explicitly tests this; **decided:** keep it `true` for now, and if it
wedges normal agent PRs, set it `false` in the same PUT.

#### D4. Where scheduled failures land, and who owns them — DECIDED 2026-09-03

**Decision: GitHub issue, auto-filed/updated by a new `workflow-failure-alerts.yml`,
labeled `ci-alert`. Notification = @-mentions of `AbanoubGhadban` and `justin808`
(GitHub turns mentions into email/bell notifications per each person's settings; the robot
itself sends no email). Lifecycle per user spec:**

- **First failure** → create `CI alert: <workflow name> is failing on main`, both handles
  mentioned in the body (so the very first failure already notifies humans), run link included.
- **Repeat failures** → single comment per failed run on the open issue, mentioning both.
- **Recovery** → on a successful run, inspect that workflow's two most recent completed
  non-PR runs on `main` (Actions API; `cancelled`/`skipped` conclusions ignored, not counted
  as passes): if **both are `success`** and an alert issue is open → comment "recovered —
  two consecutive green runs" with both links + both mentions, and close the issue. One
  green run alone changes nothing.

- Zero new secrets (uses `GITHUB_TOKEN` with `issues: write`; the two-consecutive-runs check
  additionally needs `actions: read`). Slack/email would need webhooks/infra; an issue is
  durable, visible in the repo, and pings the mentioned people via normal GitHub
  notifications. GitHub's own cron notifications only reach the cron's author — this
  replaces that dead end.
- **New file** (`.github/workflows/workflow-failure-alerts.yml`), so zero overlap with PR
  #204's `cpflow-*.yml` diffs.
- Watch list — **DECIDED 2026-09-03: only the two proven silent failers**
  (`Cleanup Stale Review Apps`, `Deploy Staging to Control Plane`), via
  `on: workflow_run`, `types: [completed]`. Browser/fleet smoke push runs stay email-only;
  extending later = adding one line to the `workflows:` list.
- Skips `pull_request`-event runs (those already surface on the PR itself).
- Implementation notes: dedupe by exact issue title + `ci-alert` label; all event data passed
  via `env:` (never interpolated into scripts); idempotent label bootstrap; mentions
  hard-coded in one place at the top of the workflow for easy handoff.
- Note: `workflow_run` triggers only run the alerts file version on the default branch → it
  cannot be exercised from the PR; first real test happens right after merge (2.4 step V3 —
  conveniently, cleanup fails nightly, so there's a guaranteed live failure to catch).

#### D5. Direct pushes to `main` `[DECIDE]`

**Recommendation: yes, restricted — and it comes for free.** The existing `pull_request` rule
(enforced at flip time) requires changes to arrive via PR; `non_fast_forward` + `deletion`
already block force-pushes and deletion. Keep `bypass_actors: []` (nobody bypasses; recovery
path is an admin disabling enforcement, which admins can always do — documented in 2.5).

#### D6. Required-check policy knobs

- `strict_required_status_checks_policy: false` (don't require branches to be up-to-date with
  main before merge — would force constant rebase+full-CI churn in an agent-heavy repo; the
  demo-fleet + browser smokes re-run on main pushes anyway).
- `do_not_enforce_on_create: false` (default).

#### D7. Dry-run before the real flip — DECIDED 2026-09-03: yes

**Decision: try `enforcement: evaluate` first** (rulesets' dry-run mode: rules are
logged under Rule Insights but don't block). If the plan/tier rejects `evaluate`, skip
straight to `active` — the canary rehearsal in 2.4 covers us either way.

#### D8. Cleanup root cause (bonus finding) — DECIDED 2026-09-03: separate tiny PR

The 96 nightly failures are one missing option: `stale_app_image_deployed_days` under
`react-server-components-demo-review:` in `.controlplane/controlplane.yml`.
**Decision: fix in a separate tiny PR** (verify the option name against the cpflow
version that's live *after* PR #204's v5.1.1→v5.3.0 bump lands, to avoid churn). Not folded
into this PR: #206 owns *visibility* of such failures, not this particular failure. Once
fixed, the alerts workflow (D4) will auto-close the alert issue on the first green run.

### 2.2 Deliverables and sequencing

Four phases. **A is a normal PR from this branch; B–D are admin/settings actions with no code
diff (except the one-line flip PR in C).**

#### Phase A — plumbing PR (this branch) — IMPLEMENTED 2026-09-03

1. `.github/workflows/demo-fleet-smoke.yml` — added the `demo-fleet-smoke-result` wrapper job (D2). ✅
2. `.github/workflows/specs.yml` — always-emitting conversion (`detect-changes` →
   job-gated `rspec` → required `rspec-result`), written on top of PR #208's content (D2). ✅
3. `.github/workflows/workflow-failure-alerts.yml` — new alerts workflow (D4): watches the
   2 silent failers; issue on first failure, mention-both comments on repeats, auto-close
   after two consecutive greens. ✅
4. `.github/rulesets/main.json` — the target ruleset as a reviewable, versioned file
   (source of truth for Phase B/C PUTs). Committed state: full current ruleset unchanged
   (approvals 0, unattributed flag true per D3) + the new `required_status_checks` rule with
   the three D1 contexts (`browser-smoke`, `demo-fleet-smoke-result`, `rspec-result`,
   all `integration_id: 15368`), and `"enforcement": "disabled"`. ✅
5. `docs/ci-required-checks.md` — the operator page: required contexts, the always-emitting
   rule, apply/rollback commands, alerts lifecycle + post-merge test. ✅

*Phase A merge gate: ordinary (changes no enforcement) — but **lands after PR #208**, which
edits the same `specs.yml` (D2 rebase note).*

#### Phase B — register the rule while still disabled (admin, after A merges)

```bash
gh api --method PUT repos/shakacode/react-on-rails-demo-marketplace-rsc/rulesets/14614926 \
  --input .github/rulesets/main.json
# verify shape landed:
gh api repos/shakacode/react-on-rails-demo-marketplace-rsc/rulesets/14614926 \
  --jq '.enforcement, ([.rules[].type] | join(","))'
# expect: disabled + deletion,non_fast_forward,pull_request,required_status_checks
```

Inert while disabled (`rules/branches/main` stays `[]`) — safe any time after A.

#### Phase C — the flip (LAST; blocked on the gate checklist below)

**Gate checklist — every box checked before flipping:**

- [ ] PR #200 merged; next `Deploy Staging` push run green
- [ ] Issue #205 resolved (an advisory can no longer skip/step-fail the Chromium smoke)
- [ ] PR #166 (refreshed) and/or fast-uri bump merged — whatever #205's mechanism still needs
- [ ] PR #199 landed or confirmed not needed for a green smoke
- [ ] Latest push to `main`: `browser-smoke` AND `smoke / Demo fleet smoke` (and the new
      `demo-fleet-smoke-result`) all green
- [ ] Phase B verified (rule present, still disabled)
- [ ] A maintainer is around for the next hour (fast rollback window)

Then: one-line change in `.github/rulesets/main.json` → `"enforcement": "evaluate"` (D7;
or `"active"` if evaluate is unavailable) via tiny PR, and re-run the same PUT. If evaluate:
watch Rule Insights across a few PRs, then repeat with `"active"`.

#### Phase D — verify, evidence, close (2.4)

### 2.3 Exact command reference

```bash
R=shakacode/react-on-rails-demo-marketplace-rsc

# live effective rules on main (expect [] until the flip, populated after)
gh api repos/$R/rules/branches/main

# ruleset state
gh api repos/$R/rulesets/14614926 --jq '.enforcement, ([.rules[].type]|join(","))'

# apply the versioned ruleset (Phases B and C; admin)
gh api --method PUT repos/$R/rulesets/14614926 --input .github/rulesets/main.json

# ROLLBACK (seconds, admin): set "enforcement": "disabled" in the file and re-PUT,
# or as a pure emergency one-off without a commit:
gh api repos/$R/rulesets/14614926 | jq '{name,target,enforcement:"disabled",conditions,bypass_actors,rules}' \
  | gh api --method PUT repos/$R/rulesets/14614926 --input -

# trigger the (currently failing) cleanup to test alerts end-to-end
gh workflow run "Cleanup Stale Review Apps" --repo $R
```

### 2.4 Verification matrix (maps 1:1 to the issue's acceptance criteria)

| # | Acceptance criterion | Proof |
|---|---|---|
| V1 | `required_status_checks` rule exists and enforcement active | `gh api repos/$R/rules/branches/main` lists `required_status_checks` with both contexts |
| V2 | Red required check blocks merge | Canary PR 1: deliberately break the smoke (e.g. assert a bogus route in `.verify-routes.js`) → `browser-smoke` fails → GitHub mergeability `blocked`; capture API/UI evidence; close unmerged |
| V3 | Failing scheduled workflow reaches a named owner | `gh workflow run "Cleanup Stale Review Apps"` (fails today by design) → `ci-alert` issue exists, assigned, run link in comment |
| V4 | Path-filtered no-run doesn't wedge a PR | Canary PR 2: docs-only change → `e2e` absent (unrequired, fine); `rspec` job skipped but required `rspec-result` reports green ("nothing to test"); `browser-smoke` + `demo-fleet-smoke-result` green → mergeable; merge or close |
| V5 | (D3 risk) unattributed-changes param doesn't wedge agent PRs | On canary PR 2, confirm no unexpected "approval required" state; if wedged → set param false (D3) and re-PUT |
| V6 | Post-merge visibility | First red push-run of a watched workflow after merge files/updates its alert issue (cleanup guarantees one nightly until D8 fix lands) |

Post-verification: comment results + evidence links on #206, then close it.

### 2.5 Risks and rollback

| Risk | Likelihood | Mitigation |
|---|---|---|
| Flip while a required suite is red on main → repo-wide merge freeze | High if sequencing ignored | Phase C gate checklist; this is why #206 "lands last" |
| Required context name typo/rename → PR stuck `pending` forever | Low | Contexts copied from live check-run names; fleet name wrapped locally (D2); canary PR 2 catches it within minutes; rollback = one PUT |
| Upstream react_on_rails reusable workflow renames inner job | Low | `demo-fleet-smoke-result` wrapper decouples us (D2) |
| `require_extra_approval_for_unattributed_changes` blocks agent PRs | Unknown | Explicit V5 canary test; flag ready to turn off |
| Alerts workflow noisy (daily comments while cleanup still broken) | Certain until D8 | One issue per workflow + comments, not new issues; D8 fix ends it |
| `evaluate` enforcement unsupported on this plan | Possible | Fall back to `active` + immediate canary (D7) |
| Org-level ruleset appears later and stacks | Low | Rulesets aggregate (most-restrictive wins); today `rules/branches/main` = `[]`; re-check at flip time |
| PR #204 merges around the same time | Certain-ish | Zero file overlap by design (D4 new file; fleet wrapper is not a cpflow file) |
| PR #208 gains more `specs.yml` changes before merging | Possible | Our conversion is built on #208's branch content as of 2026-09-03; re-diff `origin/207-specs-yml-no-push-trigger` at rebase time (D2 note) |

**Universal rollback:** one admin PUT setting `"enforcement": "disabled"` (2.3). No app code
is touched by any phase; nothing here can break the running site.

### 2.6 Explicitly out of scope / hand-offs

- **#207 / PR #208** (`rspec` on push): in flight; **this PR now overlaps it on `specs.yml`**
  because the always-emitting conversion was pulled into #206 scope (D2, decided). Landing
  order: #208 first, then this PR (built on #208's file content; see D2 rebase note).
- **#205 / #166 / #199 / #200**: prerequisites owned elsewhere; this plan only *consumes*
  their outcome (green main) as the Phase C gate.
- **D8 cleanup config fix**: separate tiny PR (recommended after #204 lands).
- Merge-queue, CODEOWNERS, org-level rulesets: not needed for the acceptance criteria.

### 2.7 Estimated effort

- Phase A: ~2–3 h including alerts-workflow testing and review.
- Phase B: minutes. Phase C: minutes + monitoring window. Phase D: ~1 h (two canary PRs + evidence).
- Wall-clock dominated by waiting on the four prerequisite items.
