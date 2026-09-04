#!/usr/bin/env bash
# PPR Spike — Benchmark comparison script (T5)
#
# Compares Product page across all rendering modes:
#   SSR → SSR cached → RSC → RSC cached → PPR
#
# Usage:
#   ./scripts/measure-ppr-comparison.sh [--url http://localhost:3000] [--iterations 10]
#
# Prerequisites:
#   - App running in production mode (bin/rails s -e production)
#   - puppeteer installed (npx puppeteer browsers install chrome)
#   - Seed data loaded (bin/rails db:seed)

set -euo pipefail

URL="${1:-http://localhost:3000}"
ITERATIONS="${2:-10}"
TIMESTAMP="$(date +'%Y%m%d-%H%M%S')"
OUTPUT_DIR="tmp/ppr-benchmarks/${TIMESTAMP}"

mkdir -p "$OUTPUT_DIR"

echo "PPR Spike — Performance Comparison"
echo "==================================="
echo "URL:        $URL"
echo "Iterations: $ITERATIONS"
echo "Output:     $OUTPUT_DIR"
echo ""

# First pass: cold cache (no warmup)
echo "--- Cold cache pass (first request, no warmup) ---"
node scripts/measure-vitals.mjs \
  --url "$URL" \
  --pages product-ssr,product-rsc,product-ppr \
  -n 1 -w 0 \
  --label "cold" \
  -o "$OUTPUT_DIR/cold.json" \
  2>&1 | tee "$OUTPUT_DIR/cold.log"

# Second pass: warm cache (with warmup)
echo ""
echo "--- Warm cache pass ($ITERATIONS iterations, 2 warmup) ---"
node scripts/measure-vitals.mjs \
  --url "$URL" \
  --pages product-ssr,product-ssr-cached,product-rsc,product-rsc-cached,product-ppr \
  -n "$ITERATIONS" -w 2 \
  --label "warm" \
  -o "$OUTPUT_DIR/warm.json" \
  2>&1 | tee "$OUTPUT_DIR/warm.log"

# Third pass: throttled (simulate slow network)
echo ""
echo "--- Throttled pass (slow 3G, $ITERATIONS iterations) ---"
node scripts/measure-vitals.mjs \
  --url "$URL" \
  --pages product-ssr,product-rsc,product-ppr \
  -n "$ITERATIONS" -w 2 \
  --throttle \
  --label "throttled" \
  -o "$OUTPUT_DIR/throttled.json" \
  2>&1 | tee "$OUTPUT_DIR/throttled.log"

echo ""
echo "Done. Results in $OUTPUT_DIR/"
echo ""
echo "To compare results:"
echo "  node scripts/compare-vitals.mjs $OUTPUT_DIR/warm.json"
