#!/usr/bin/env bash
# perf-audit.sh — Run a single-target performance/accessibility/visual audit.
#
# Points ShakaPerf at one running server to produce a combined report without
# needing a second version (R4).
#
# Usage:
#   scripts/perf-audit.sh                        # Uses default http://localhost:3000
#   scripts/perf-audit.sh --url http://localhost:3001
#
# Exit codes (R7):
#   0  — clean
#   1  — audit completed with failures
#   *  — harness/config problem
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Run preflight
"$SCRIPT_DIR/perf-preflight.sh"

cd "$PROJECT_ROOT"

echo "==> Running ShakaPerf audit..."
echo "    Results will be written to audit-results/"
echo ""

pnpm exec shaka-perf audit "$@"
exit_code=$?

if [[ $exit_code -eq 0 ]]; then
  echo ""
  echo "✓ Audit complete — no issues found."
  echo "  Results: audit-results/"
elif [[ $exit_code -eq 1 ]]; then
  echo "" >&2
  echo "FAILED: Issues detected. See audit-results/ for details." >&2
fi

exit $exit_code
