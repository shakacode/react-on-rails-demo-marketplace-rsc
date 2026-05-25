#!/bin/bash
# Measures actual JS/CSS downloaded per page by parsing the HTML for script/link tags
# and summing the file sizes from public/packs.
# Usage: ./scripts/measure-page-assets.sh <label>

LABEL="${1:-unknown}"
BASE="http://localhost:3000"
PACKS_DIR="/mnt/ssd/shakacode-related/localhub-demo/public"

declare -a PAGES=(
  "Product RSC|/product/rsc"
  "Product SSR|/product/ssr"
  "Product Client|/product/client"
  "Product Search RSC|/product-search/rsc"
  "Product Search SSR|/product-search/ssr"
  "Product Search Client|/product-search/client"
  "Blog RSC|/blog/rsc"
  "Blog SSR|/blog/ssr"
  "Blog Client|/blog/client"
  "Blog RSC Simple|/blog/rsc-simple"
  "Restaurant RSC|/restaurant/1/rsc"
  "Restaurant SSR|/restaurant/1/ssr"
  "Restaurant Client|/restaurant/1/client"
)

OUTFILE=".lh-results/page-assets-${LABEL}.txt"
mkdir -p .lh-results

echo "Bundle size measurement: ${LABEL}" > "$OUTFILE"
echo "Date: $(date -Iseconds)" >> "$OUTFILE"
echo "" >> "$OUTFILE"
printf "%-25s %10s %8s %10s %8s %10s\n" "Page" "JS (KB)" "JS Files" "CSS (KB)" "CSS Files" "Total (KB)" >> "$OUTFILE"
printf "%-25s %10s %8s %10s %8s %10s\n" "----" "-------" "--------" "--------" "---------" "----------" >> "$OUTFILE"

for entry in "${PAGES[@]}"; do
  IFS="|" read -r name path <<< "$entry"

  # Fetch the page HTML
  html=$(curl -s "${BASE}${path}")

  # Extract JS files from script tags pointing to /packs/
  js_files=$(echo "$html" | grep -oP 'src="/packs/[^"]+\.js"' | grep -oP '/packs/[^"]+' | sort -u)

  # Extract CSS files from link tags pointing to /packs/
  css_files=$(echo "$html" | grep -oP 'href="/packs/[^"]+\.css"' | grep -oP '/packs/[^"]+' | sort -u)

  js_total=0
  js_count=0
  for f in $js_files; do
    fpath="${PACKS_DIR}${f}"
    if [ -f "$fpath" ]; then
      size=$(wc -c < "$fpath")
      js_total=$((js_total + size))
      js_count=$((js_count + 1))
    fi
  done

  css_total=0
  css_count=0
  for f in $css_files; do
    fpath="${PACKS_DIR}${f}"
    if [ -f "$fpath" ]; then
      size=$(wc -c < "$fpath")
      css_total=$((css_total + size))
      css_count=$((css_count + 1))
    fi
  done

  total=$((js_total + css_total))
  js_kb=$(echo "scale=1; $js_total / 1024" | bc)
  css_kb=$(echo "scale=1; $css_total / 1024" | bc)
  total_kb=$(echo "scale=1; $total / 1024" | bc)

  printf "%-25s %10s %8d %10s %8d %10s\n" "$name" "${js_kb}" "$js_count" "${css_kb}" "$css_count" "${total_kb}" >> "$OUTFILE"
  echo "  ${name}: JS=${js_kb}KB (${js_count} files), CSS=${css_kb}KB, Total=${total_kb}KB"
done

echo "" >> "$OUTFILE"
echo "Results saved to ${OUTFILE}"
