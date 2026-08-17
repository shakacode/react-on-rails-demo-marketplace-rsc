#!/usr/bin/env bash
# perf-compare-commits.sh — Compare two git refs under paired sampling.
#
# Provisions two bare-metal production-local servers (one per ref) on different
# ports, then runs ShakaPerf compare against them. Both servers are co-located
# on one host for valid paired statistics (F4).
#
# Usage:
#   scripts/perf-compare-commits.sh <control-ref> <experiment-ref>
#   scripts/perf-compare-commits.sh main feature-branch
#   scripts/perf-compare-commits.sh abc123 def456
#
# Prerequisites:
#   - PostgreSQL running with a seeded database
#   - All dependencies installed (pnpm install, bundle install)
#   - Ports 4020, 4030 (or SHAKAPERF_CONTROL/EXPERIMENT_PORT) available
#
# Exit codes (R7):
#   0  — clean (no regressions)
#   1  — pipeline completed with failures
#   75 — transient state, retry
#   2  — usage/setup error
#   *  — harness/config problem
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <control-ref> <experiment-ref>" >&2
  echo "  e.g. $0 main feature-branch" >&2
  echo "  e.g. $0 abc1234 def5678" >&2
  exit 2
fi

CONTROL_REF="$1"
EXPERIMENT_REF="$2"
shift 2

# Run preflight
"$SCRIPT_DIR/perf-preflight.sh"

# Port configuration — use env vars or config defaults
CONTROL_PORT="${SHAKAPERF_CONTROL_PORT:-4020}"
EXPERIMENT_PORT="${SHAKAPERF_EXPERIMENT_PORT:-4030}"
CONTROL_RENDERER_PORT="${SHAKAPERF_CONTROL_RENDERER_PORT:-4820}"
EXPERIMENT_RENDERER_PORT="${SHAKAPERF_EXPERIMENT_RENDERER_PORT:-4830}"

echo "==> Comparing $CONTROL_REF vs $EXPERIMENT_REF"
echo "    Control:    port $CONTROL_PORT (renderer $CONTROL_RENDERER_PORT)"
echo "    Experiment: port $EXPERIMENT_PORT (renderer $EXPERIMENT_RENDERER_PORT)"
echo ""

# Resolve refs to full SHAs for determinism
cd "$PROJECT_ROOT"
git fetch origin --quiet
CONTROL_SHA=$(git rev-parse "$CONTROL_REF")
EXPERIMENT_SHA=$(git rev-parse "$EXPERIMENT_REF")
echo "    Control SHA:    $CONTROL_SHA"
echo "    Experiment SHA: $EXPERIMENT_SHA"
echo ""

# Set up worktrees for both refs
WORKTREE_BASE="$PROJECT_ROOT/.perf-worktrees"
CONTROL_DIR="$WORKTREE_BASE/control-${CONTROL_SHA:0:8}"
EXPERIMENT_DIR="$WORKTREE_BASE/experiment-${EXPERIMENT_SHA:0:8}"

cleanup() {
  echo "==> Cleaning up..."
  # Kill backgrounded servers
  kill $CONTROL_PID $CONTROL_RENDERER_PID $EXPERIMENT_PID $EXPERIMENT_RENDERER_PID 2>/dev/null || true
  wait $CONTROL_PID $CONTROL_RENDERER_PID $EXPERIMENT_PID $EXPERIMENT_RENDERER_PID 2>/dev/null || true
  # Remove worktrees
  git worktree remove --force "$CONTROL_DIR" 2>/dev/null || true
  git worktree remove --force "$EXPERIMENT_DIR" 2>/dev/null || true
  rmdir "$WORKTREE_BASE" 2>/dev/null || true
}

CONTROL_PID=""
CONTROL_RENDERER_PID=""
EXPERIMENT_PID=""
EXPERIMENT_RENDERER_PID=""
trap cleanup EXIT

mkdir -p "$WORKTREE_BASE"

echo "==> Creating worktrees..."
git worktree add --detach "$CONTROL_DIR" "$CONTROL_SHA"
git worktree add --detach "$EXPERIMENT_DIR" "$EXPERIMENT_SHA"

# Build function — builds a production-local server in a worktree
build_side() {
  local dir="$1" label="$2"
  echo "==> Building $label at $dir..."
  cd "$dir"
  pnpm install --frozen-lockfile --ignore-scripts 2>&1 | tail -3
  # Run the repo's production build
  NODE_ENV=production bin/shakapacker --mode production 2>&1 | tail -3
  echo "    $label build complete."
}

# Start function — starts Rails + node renderer
start_side() {
  local dir="$1" port="$2" renderer_port="$3" label="$4"
  cd "$dir"

  echo "==> Starting $label renderer on port $renderer_port..."
  NODE_ENV=production RENDERER_PORT="$renderer_port" node node-renderer.js &
  local renderer_pid=$!

  echo "==> Starting $label Rails on port $port..."
  RAILS_ENV=production \
    RAILS_SERVE_STATIC_FILES=true \
    SECRET_KEY_BASE=dummy_secret_key_base_for_perf_testing_1234567890abcdef \
    PORT="$port" \
    RENDERER_PORT="$renderer_port" \
    RENDERER_URL="http://localhost:$renderer_port" \
    bundle exec rails server -p "$port" -b 0.0.0.0 &
  local rails_pid=$!

  echo "$renderer_pid $rails_pid"
}

# Build both sides
build_side "$CONTROL_DIR" "control"
build_side "$EXPERIMENT_DIR" "experiment"

# Start both sides
read CONTROL_RENDERER_PID CONTROL_PID <<< "$(start_side "$CONTROL_DIR" "$CONTROL_PORT" "$CONTROL_RENDERER_PORT" "control")"
read EXPERIMENT_RENDERER_PID EXPERIMENT_PID <<< "$(start_side "$EXPERIMENT_DIR" "$EXPERIMENT_PORT" "$EXPERIMENT_RENDERER_PORT" "experiment")"

# Wait for servers to be ready
echo "==> Waiting for servers..."
for port in "$CONTROL_PORT" "$EXPERIMENT_PORT"; do
  for i in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$port/up" 2>/dev/null; then
      echo "    Port $port ready."
      break
    fi
    if [[ $i -eq 60 ]]; then
      echo "ERROR: Server on port $port did not start within 60 seconds." >&2
      exit 2
    fi
    sleep 1
  done
done

echo ""
echo "==> Both servers running. Starting comparison..."
cd "$PROJECT_ROOT"

# Run compare with explicit URLs
pnpm exec shaka-perf compare \
  --controlURL "http://localhost:$CONTROL_PORT" \
  --experimentURL "http://localhost:$EXPERIMENT_PORT" \
  "$@"
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
  echo ""
  echo "✓ Compare complete — no regressions between $CONTROL_REF and $EXPERIMENT_REF."
  echo "  Report: compare-results/self-contained-performance-report.html"
  echo "  JSON:   compare-results/report.json"
elif [[ $exit_code -eq 1 ]]; then
  echo "" >&2
  echo "FAILED: Regressions detected between $CONTROL_REF and $EXPERIMENT_REF." >&2
  echo "  Report: compare-results/self-contained-performance-report.html" >&2
fi

exit $exit_code
