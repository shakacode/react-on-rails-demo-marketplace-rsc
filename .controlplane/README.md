# Deployment Guide

## Run Locally with Docker

**Build:**
```bash
DOCKER_BUILDKIT=1 docker build --ssh default -f .controlplane/Dockerfile -t react-server-components-demo .
```
`--ssh default` forwards your SSH agent (needed for private `react-on-rails-builds` repo).

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
