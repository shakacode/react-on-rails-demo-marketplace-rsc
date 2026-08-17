#!/usr/bin/env bash
# perf-compare.sh — Compare two running servers under paired sampling.
#
# Usage:
#   scripts/perf-compare.sh                          # Uses controlURL/experimentURL from abtests.config.ts
#   scripts/perf-compare.sh --control-url URL --experiment-url URL
#
# Exit codes (R7):
#   0  — clean (no regressions)
#   1  — pipeline completed with failures (regression/broken/accessibility error)
#   75 — transient proxied-menu state, retry
#   *  — harness/config problem, not a test verdict
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run preflight
"$SCRIPT_DIR/perf-preflight.sh"

cd "$PROJECT_ROOT"

echo "==> Running ShakaPerf compare..."
echo "    Results will be written to compare-results/"
echo ""

# Pass through any extra arguments (--control-url, --experiment-url, etc.)
pnpm exec shaka-perf compare "$@"
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
  echo ""
  echo "✓ Compare complete — no regressions detected."
  echo "  Report: compare-results/self-contained-performance-report.html"
  echo "  JSON:   compare-results/report.json"
elif [[ $exit_code -eq 1 ]]; then
  echo "" >&2
  echo "FAILED: Regressions detected. See compare-results/report.json for details." >&2
  echo "  Report: compare-results/self-contained-performance-report.html" >&2
fi

exit $exit_code
