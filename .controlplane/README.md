# Deployment Guide

## Run Locally with Docker

**Build:**
```bash
DOCKER_BUILDKIT=1 docker build -f .controlplane/Dockerfile -t react-server-components-demo .
```
The React on Rails packages are installed from published npm releases and
public GitHub sources, so Docker builds do not need SSH forwarding.

**Migrate & seed:**
```bash
docker run --rm --env-file .env -e SECRET_KEY_BASE=test123 react-server-components-demo bundle exec rails db:migrate
docker run --rm --env-file .env -e SECRET_KEY_BASE=test123 react-server-components-demo bundle exec rails db:seed
```

**Run:**
```bash
# With local Postgres (host network)
docker run --rm --network host \
  -e DATABASE_URL="postgres://USER@localhost:5432/DB_NAME" \
  -e SECRET_KEY_BASE=test123 \
  -e RENDERER_PASSWORD=development_password \
  react-server-components-demo

# With external Postgres (e.g., Neon)
docker run --rm -p 3000:3000 --env-file .env \
  -e SECRET_KEY_BASE=test123 \
  -e RENDERER_PASSWORD=development_password \
  react-server-components-demo
```

The `.env` file should contain `DATABASE_URL=postgres://...` and is already gitignored.

Open http://localhost:3000.

## Deploy to Control Plane

### Prerequisites
```bash
npm i -g @controlplane/cli
gem install cpflow
cpln login
```

### First-time setup

1. **Create the secret:**
```bash
cpln secret create-dictionary \
  --name react-server-components-demo-secrets \
  --org shakacode-open-source-examples-staging \
  --entry DATABASE_URL=your_neon_url \
  --entry SECRET_KEY_BASE=$(rails secret) \
  --entry RENDERER_PASSWORD=pick_a_password \
  --entry REACT_ON_RAILS_PRO_LICENSE=your_license
```

2. **Provision the app:**
```bash
cpflow setup-app -a react-server-components-demo
```

3. **Build, deploy, and seed:**
```bash
cpflow build-image -a react-server-components-demo
cpflow deploy-image -a react-server-components-demo --run-release-phase
cpflow run 'rails db:seed' -a react-server-components-demo
```

### Review apps

This repo uses the generated Control Plane Flow GitHub Actions wrappers pinned
to `shakacode/control-plane-flow@v5.0.4`.

Review app names are built from the prefix
`react-server-components-demo-review`, so pull request 123 deploys as:

```text
react-server-components-demo-review-123
```

Comment on a pull request with exactly one command:

```text
+review-app-deploy
+review-app-delete
+review-app-help
```

`+review-app-deploy` creates the review app if needed, builds and deploys the
PR image, runs the `rails db:migrate` release phase, and comments with the
review URL. After the first deploy request, later pushes to the same PR
automatically redeploy the review app. `+review-app-delete` deletes the review
app, and deletion also runs when the PR closes. Stale review apps are cleaned up
nightly by `.github/workflows/cpflow-cleanup-stale-review-apps.yml`.

In public repositories, automatic pull request review-app deploys skip fork PR
heads because Docker builds use repository secrets. Manual comment or dispatch
deploys from trusted maintainers can still run PR code, so do not deploy a fork
PR unless the reviewed change has first been moved to a trusted branch in this
repository or the wrapper has an explicit fork guard. Review apps still run pull
request code, so same-repository PRs can read any secret mounted into the
workload.

Configure these GitHub repository secrets before enabling review app deploys:

| Name | Required | Notes |
| --- | --- | --- |
| `CPLN_TOKEN_STAGING` | Yes | Staging/review Control Plane service-account token for `shakacode-open-source-examples-staging`; it must not access production resources. |
| `DOCKER_BUILD_SSH_KEY` | Optional | Only needed if future Docker builds add private GitHub dependencies; if used, make it read-only and revocable. Do not use a personal SSH key. |
| `DOCKER_BUILD_EXTRA_ARGS` | Optional | Newline-delimited extra Docker build tokens if the build needs additional `--build-arg` or `--secret` values. |

No review-app repository variables are required while
`.controlplane/controlplane.yml` has exactly one review app entry with
`match_if_app_name_starts_with: true`; cpflow infers the app prefix and staging
org from that config. Optional overrides are `CPLN_ORG_STAGING`,
`REVIEW_APP_PREFIX`, and `PRIMARY_WORKLOAD`.

The review apps reuse the Control Plane secret dictionary named
`react-server-components-demo-secrets`. Both app entries set `secrets_name` to
this dictionary so `cpflow setup-app` binds each workload identity to the
matching secret policy, and the app template references it through
`{{APP_SECRETS}}`. Confirm the dictionary has values for:

```text
DATABASE_URL
SECRET_KEY_BASE
RENDERER_PASSWORD
REACT_ON_RAILS_PRO_LICENSE
```

Because these values are mounted into workloads that run pull request code, keep
this dictionary review-safe: use a disposable database, review-only renderer
credentials, and a Pro license value that is acceptable for review-app exposure.
Do not point review apps at production or long-lived staging secret
dictionaries. `cpln://secret/...` protects the value in Control Plane
configuration, but the value is readable by app code after it is mounted.
If you change the secret dictionary name, update `secrets_name` in
`.controlplane/controlplane.yml` rather than hardcoding a different dictionary
in the template; otherwise Control Plane will leave unresolved `cpln://secret`
URIs in the container environment.

Because `DATABASE_URL` points at an external database secret, review app deletion
does not run `rails db:drop`. Add a per-review-app database template before
introducing destructive database cleanup hooks.

### Generated staging and production workflows

`cpflow generate-github-actions` also creates staging and production wrappers.
The staging wrapper runs on pushes to `main` and `master`, so configure these
repository settings before merging the workflow, or edit the branch filter for
your rollout branch:

| Name | Type | Value for this repo |
| --- | --- | --- |
| `CPLN_TOKEN_STAGING` | Repository secret | Token for `shakacode-open-source-examples-staging`. |
| `STAGING_APP_NAME` | Repository variable | `react-server-components-demo` |
| `CPLN_ORG_STAGING` | Repository variable | `shakacode-open-source-examples-staging` |
| `DOCKER_BUILD_SSH_KEY` | Repository secret | Optional read-only SSH key for private build dependencies. |

The generated production promotion workflow is manual. Before using it, create
a protected GitHub Environment named `production`, require reviewers, enable
prevent self-review, and store `CPLN_TOKEN_PRODUCTION` as an environment secret
rather than a repository secret.

> **These repository variables must actually be created, not just documented.**
> The staging wrapper's `validate-branch` preflight exits early when
> `CPLN_ORG_STAGING` or `STAGING_APP_NAME` is missing, so the deploy never runs
> and staging silently keeps serving the previously deployed image. A merge to
> `main` looks fine in the PR, but staging stays stale. This was the root cause
> of #88 (the variables were documented here but never set in repo settings).
>
> Verify the variables exist with:
>
> ```bash
> gh variable list
> # expected:
> # CPLN_ORG_STAGING   shakacode-open-source-examples-staging
> # STAGING_APP_NAME   react-server-components-demo
> ```

#### Confirming which commit staging is running

The most reliable source is the GitHub Actions history: the newest **successful**
"Deploy Staging to Control Plane" run deployed the commit it ran on.

```bash
gh run list --workflow=cpflow-deploy-staging.yml --status success \
  --limit 1 --json headSha,createdAt,displayTitle
```

If that SHA lags `origin/main`, staging is behind: check the most recent run for
a failed `validate-branch` (missing variables) or a failed build/deploy. An
in-app footer SHA (tracked separately) makes the running commit visible at a
glance without leaving the site.

Validate generated wrapper changes locally with:

```bash
bin/test-cpflow-github-flow ruby -S cpflow
```

### Subsequent deploys
```bash
cpflow build-image -a react-server-components-demo
cpflow deploy-image -a react-server-components-demo --run-release-phase
```

### Useful commands
```bash
cpflow logs -a react-server-components-demo          # tail logs
cpflow run 'rails console' -a react-server-components-demo  # Rails console
cpflow delete -a react-server-components-demo        # tear down
```
