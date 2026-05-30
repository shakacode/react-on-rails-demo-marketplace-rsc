#!/usr/bin/env bash
#
# RSC + Rspack end-to-end verification gate.
#
# Proves that an Rspack *production* build of this app renders AND hydrates
# every RSC route at runtime. This is the only check that actually validates
# Rspack + RSC: a successful build and matching manifest parity are NOT
# sufficient — the generated manifest can be structurally valid yet point at
# chunks that fail to resolve in the browser. See
#   - react-on-rails-demo-marketplace-rsc#72  (controlled A/B that found this)
#   - shakacode/react_on_rails#3488            (path to production-ready Rspack RSC)
#
# Pipeline (mirrors the manually-verified recipe in #72):
#   1. db:prepare
#   2. generate RSC packs
#   3. production Rspack build (client + server + RSC bundles)
#   4. check-rsc-chunks.mjs (manifest/chunk sanity)
#   5. boot Pro Node Renderer + Rails, run .verify-routes.js (Puppeteer)
#
# Assumes deps are installed (bundle install, pnpm install) and the
# react-on-rails-rsc / Pro packages are linked. Runs locally and in CI
# (.github/workflows/rsc-rspack-e2e.yml). The exit code is the route checker's:
# non-zero if any RSC route fails to render or hydrate cleanly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p tmp

RAILS_PORT="${RAILS_PORT:-3010}"
RENDERER_PORT="${RENDERER_PORT:-3800}"

export SHAKAPACKER_ASSETS_BUNDLER=rspack
export RENDERER_URL="http://localhost:${RENDERER_PORT}"
export BASE_URL="http://localhost:${RAILS_PORT}"

renderer_pid=""
rails_pid=""
cleanup() {
  [ -n "$rails_pid" ] && kill "$rails_pid" 2>/dev/null || true
  [ -n "$renderer_pid" ] && kill "$renderer_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for a TCP port to accept connections, using bash's /dev/tcp (no nc/curl
# dependency). Returns non-zero if it never comes up within the budget.
wait_for_port() {
  local port="$1" name="$2" remaining="${3:-150}"
  echo "-> waiting for ${name} on :${port} (up to ${remaining}s)..."
  while ! (exec 3<>"/dev/tcp/127.0.0.1/${port}") 2>/dev/null; do
    remaining=$((remaining - 2))
    if [ "$remaining" -le 0 ]; then
      echo "x ${name} never came up on :${port}" >&2
      return 1
    fi
    sleep 2
  done
  exec 3>&- 2>/dev/null || true
  echo "ok ${name} is up on :${port}"
}

echo "== [1/5] Prepare database =="
bundle exec rake db:prepare

echo "== [2/5] Generate RSC packs =="
bundle exec rake react_on_rails:generate_packs

echo "== [3/5] Production Rspack build (client + server + RSC bundles) =="
NODE_ENV=production pnpm exec rspack build --config config/rspack/rspack.config.js

echo "== [4/5] Verify RSC manifests / chunks =="
node scripts/check-rsc-chunks.mjs

echo "== [5/5] Boot renderer + Rails, run route-hydration checks =="
RENDERER_WORKERS_COUNT=1 node node-renderer.js > tmp/renderer.log 2>&1 &
renderer_pid=$!
wait_for_port "$RENDERER_PORT" "Node Renderer"

bundle exec rails server -p "$RAILS_PORT" > tmp/rails.log 2>&1 &
rails_pid=$!
wait_for_port "$RAILS_PORT" "Rails"

# .verify-routes.js opens each route, waits for the hydration window, captures
# console/page errors and classified React hydration codes, and exits non-zero
# if any route fails to render or hydrate cleanly.
node .verify-routes.js

echo "ok RSC + Rspack route-hydration gate PASSED"
