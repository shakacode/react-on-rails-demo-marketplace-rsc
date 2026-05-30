# Review App Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Control Plane Flow review-app support for pull requests.

**Architecture:** Reuse the existing `.controlplane/` deployment scaffold, add one review-app prefix config entry, generate upstream `cpflow-*` GitHub Actions wrappers, and document the operator commands and repository settings. The app continues to use the existing `rails` workload and Control Plane templates.

**Tech Stack:** Rails 7.1, React on Rails, Control Plane, `cpflow` 5.0.4, GitHub Actions.

---

## File Structure

- Modify `.controlplane/controlplane.yml`: add the review-app prefix entry and hooks.
- Modify `.controlplane/README.md`: document review-app setup, commands, secrets, and validation.
- Create `.github/cpflow-help.md`: generated PR command help.
- Create `.github/workflows/cpflow-*.yml`: generated Control Plane Flow workflow wrappers.
- Create `bin/pin-cpflow-github-ref` and `bin/test-cpflow-github-flow`: generated maintenance and validation helpers.

### Task 1: Add Review App Control Plane Config

**Files:**
- Modify: `.controlplane/controlplane.yml`

- [ ] **Step 1: Add a review prefix app**

```yaml
  react-server-components-demo-review:
    <<: *common
    match_if_app_name_starts_with: true
    release_script: rails db:migrate
    setup_app_templates:
      - app
      - rails
```

- [ ] **Step 2: Validate YAML**

Run: `ruby -e 'require "yaml"; YAML.load_file(".controlplane/controlplane.yml", aliases: true); puts "ok"'`

Expected: `ok`

### Task 2: Generate GitHub Actions Wrappers

**Files:**
- Create: `.github/cpflow-help.md`
- Create: `.github/workflows/cpflow-review-app-help.yml`
- Create: `.github/workflows/cpflow-help-command.yml`
- Create: `.github/workflows/cpflow-deploy-review-app.yml`
- Create: `.github/workflows/cpflow-delete-review-app.yml`
- Create: `.github/workflows/cpflow-cleanup-stale-review-apps.yml`
- Create: `.github/workflows/cpflow-deploy-staging.yml`
- Create: `.github/workflows/cpflow-promote-staging-to-production.yml`
- Create: `bin/pin-cpflow-github-ref`
- Create: `bin/test-cpflow-github-flow`

- [ ] **Step 1: Generate wrappers**

Run: `ruby -S cpflow generate-github-actions`

Expected: generated files are created and wrapper `uses:` refs point at `v5.0.4`.

- [ ] **Step 2: Run generated validation**

Run: `bin/test-cpflow-github-flow ruby -S cpflow`

Expected: readiness and generated workflow validation pass.

### Task 3: Document Review App Operations

**Files:**
- Modify: `.controlplane/README.md`

- [ ] **Step 1: Add review-app section**

Document `+review-app-deploy`, push redeploy behavior, `+review-app-delete`, stale cleanup, `CPLN_TOKEN_STAGING`, optional `DOCKER_BUILD_SSH_KEY`, and `DOCKER_BUILD_EXTRA_ARGS`.

- [ ] **Step 2: Confirm docs mention private dependencies**

Run: `rg -n "review-app|CPLN_TOKEN_STAGING|DOCKER_BUILD_SSH_KEY|REACT_ON_RAILS_PRO_LICENSE" .controlplane/README.md`

Expected: all terms are present in the deployment guide.

### Task 4: Final Verification

**Files:**
- Review all changed files.

- [ ] **Step 1: Run YAML validation**

Run: `ruby -e 'require "yaml"; Dir[".github/workflows/cpflow-*.yml", ".controlplane/controlplane.yml"].each { |path| YAML.load_file(path, aliases: true) }; puts "ok"'`

Expected: `ok`.

- [ ] **Step 2: Run repo diff review**

Run: `git diff --check && git diff --stat`

Expected: no whitespace errors and a focused set of Control Plane/GitHub workflow/doc changes.
