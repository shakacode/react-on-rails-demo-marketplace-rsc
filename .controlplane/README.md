# Deployment Guide

## Run Locally with Docker

**Build:**
```bash
DOCKER_BUILDKIT=1 docker build --ssh default -f .controlplane/Dockerfile -t react-server-components-marketplace-demo .
```

`--ssh default` is required because `pnpm install` clones the private repo [shakacode/react-on-rails-builds](https://github.com/shakacode/react-on-rails-builds) for `react-on-rails`, `react-on-rails-pro`, and `react-on-rails-pro-node-renderer`. Docker forwards your local SSH agent only for that build step, so the key is not stored in the image.

**Migrate & seed:**
```bash
docker run --rm --env-file .env -e SECRET_KEY_BASE=test123 react-server-components-marketplace-demo bundle exec rails db:migrate
docker run --rm --env-file .env -e SECRET_KEY_BASE=test123 react-server-components-marketplace-demo bundle exec rails db:seed
```

**Run:**
```bash
# With local Postgres (host network)
docker run --rm --network host \
  -e DATABASE_URL="postgres://USER@localhost:5432/DB_NAME" \
  -e SECRET_KEY_BASE=test123 \
  -e RENDERER_PASSWORD=development_password \
  react-server-components-marketplace-demo

# With external Postgres (for example Neon)
docker run --rm -p 3000:3000 --env-file .env \
  -e SECRET_KEY_BASE=test123 \
  -e RENDERER_PASSWORD=development_password \
  react-server-components-marketplace-demo
```

The `.env` file should contain `DATABASE_URL=postgres://...` and is already gitignored.

Open `http://localhost:3000`.

## GitHub Actions Flow

This repo now supports the shared `cpflow` GitHub Actions pipeline:

- comment `/deploy-review-app` on a PR to create or update a review app
- push to the staging branch to auto-deploy staging
- promote staging to production from the Actions tab

Because the Dockerfile installs private GitHub dependencies, the repo must set these GitHub settings before review apps or staging deploys will build successfully:

**Required secrets**

- `CPLN_TOKEN_STAGING`
- `CPLN_TOKEN_PRODUCTION`
- `DOCKER_BUILD_SSH_KEY`

**Required variables**

- `CPLN_ORG_STAGING`
- `CPLN_ORG_PRODUCTION`
- `STAGING_APP_NAME=react-server-components-marketplace-demo-staging`
- `PRODUCTION_APP_NAME=react-server-components-marketplace-demo-production`
- `REVIEW_APP_PREFIX=react-server-components-marketplace-demo-review`

**Optional variables**

- `STAGING_APP_BRANCH` to override the default staging branch (`main` or `master`)
- `PRIMARY_WORKLOAD=rails`
- `DOCKER_BUILD_EXTRA_ARGS` for extra `docker build` flags

## Deploy to Control Plane Manually

### Prerequisites
```bash
npm i -g @controlplane/cli
gem install cpflow
cpln login
```

### Secret dictionaries

Create one secret dictionary per environment. Review apps share the review secret dictionary because the config uses `match_if_app_name_starts_with: true`.

```bash
cpln secret create-dictionary \
  --name react-server-components-marketplace-demo-staging-secrets \
  --org my-org-staging \
  --entry DATABASE_URL=your_database_url \
  --entry SECRET_KEY_BASE=$(rails secret) \
  --entry RENDERER_PASSWORD=pick_a_password \
  --entry REACT_ON_RAILS_PRO_LICENSE=your_license

cpln secret create-dictionary \
  --name react-server-components-marketplace-demo-review-secrets \
  --org my-org-staging \
  --entry DATABASE_URL=your_database_url \
  --entry SECRET_KEY_BASE=$(rails secret) \
  --entry RENDERER_PASSWORD=pick_a_password \
  --entry REACT_ON_RAILS_PRO_LICENSE=your_license

cpln secret create-dictionary \
  --name react-server-components-marketplace-demo-production-secrets \
  --org my-org-production \
  --entry DATABASE_URL=your_database_url \
  --entry SECRET_KEY_BASE=$(rails secret) \
  --entry RENDERER_PASSWORD=pick_a_password \
  --entry REACT_ON_RAILS_PRO_LICENSE=your_license
```

### First-time setup

```bash
cpflow setup-app -a react-server-components-marketplace-demo-staging
cpflow setup-app -a react-server-components-marketplace-demo-production
```

### Manual staging deploy

```bash
cpflow build-image -a react-server-components-marketplace-demo-staging --ssh default
cpflow deploy-image -a react-server-components-marketplace-demo-staging --run-release-phase
cpflow run 'rails db:seed' -a react-server-components-marketplace-demo-staging
```

### Useful commands

```bash
cpflow logs -a react-server-components-marketplace-demo-staging
cpflow run 'rails console' -a react-server-components-marketplace-demo-staging
cpflow delete -a react-server-components-marketplace-demo-review-123
```
