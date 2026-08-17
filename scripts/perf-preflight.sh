#!/usr/bin/env bash
# perf-preflight.sh — Verify every required tool before a ShakaPerf run.
# Exit 0 if all tools are present; non-zero with a message naming the missing
# tool and an install hint. Exit code 1 = missing prerequisite (not a test
# verdict per R7).
set -euo pipefail

missing=0

check() {
  local cmd="$1" hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    echo "MISSING: $cmd — $hint" >&2
    missing=1
  fi
}

# Core tools
check node    "Install Node.js >= 20.6 (mise, nvm, or https://nodejs.org)"
check pnpm    "Install pnpm (corepack enable && corepack prepare pnpm@latest --activate)"
check ruby    "Install Ruby 3.4+ (mise install ruby)"
check bundle  "Install Bundler (gem install bundler)"
check git     "Install git"

# ShakaPerf-specific
if ! pnpm exec shaka-perf --version &>/dev/null; then
  echo "MISSING: shaka-perf — run: pnpm install" >&2
  missing=1
fi

# Playwright Chromium browser — check if the binary is installed by listing
# browsers and looking for chromium in Playwright's registry.
if ! pnpm exec playwright install --dry-run 2>&1 | grep -qi "chromium" 2>/dev/null; then
  # Fallback: try to detect installed browsers directory
  chromium_dir=$(find "$(pnpm exec node -e 'console.log(require("playwright-core").chromium.executablePath())' 2>/dev/null | xargs dirname 2>/dev/null)" -maxdepth 0 -type d 2>/dev/null || true)
  if [[ -z "$chromium_dir" ]]; then
    echo "MISSING: Playwright Chromium browser — run: pnpm exec playwright install chromium" >&2
    missing=1
  fi
fi

# Database
check psql "Install PostgreSQL (brew install postgresql or your OS package manager)"

# Platform check
case "$(uname -s)" in
  MINGW*|CYGWIN*|MSYS*)
    echo "WARNING: ShakaPerf requires macOS or Linux (native addon via node-gyp). Windows is not supported." >&2
    missing=1
    ;;
esac

if [[ $missing -ne 0 ]]; then
  echo "" >&2
  echo "Install the missing tools above, then re-run this preflight." >&2
  exit 1
fi

echo "✓ All ShakaPerf prerequisites satisfied."
