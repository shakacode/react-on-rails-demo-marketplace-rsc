#!/bin/bash
# Measures per-page JS download including gzip compression.
# Usage: ./scripts/measure-gzip-assets.sh <label>

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
printf "%-25s %10s %10s %8s %10s\n" "Page" "Raw JS" "Gzip JS" "Files" "Raw CSS" >> "$OUTFILE"
printf "%-25s %10s %10s %8s %10s\n" "----" "------" "-------" "-----" "-------" >> "$OUTFILE"

for entry in "${PAGES[@]}"; do
  IFS="|" read -r name path <<< "$entry"

  html=$(curl -s "${BASE}${path}")
  status=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${path}")

  if [ "$status" != "200" ]; then
    printf "%-25s %10s %10s %8s %10s\n" "$name" "ERR($status)" "-" "-" "-" >> "$OUTFILE"
    echo "  ${name}: ERROR ${status}"
    continue
  fi

  js_files=$(echo "$html" | grep -oP 'src="/packs/[^"]+\.js"' | grep -oP '/packs/[^"]+' | sort -u)
  css_files=$(echo "$html" | grep -oP 'href="/packs/[^"]+\.css"' | grep -oP '/packs/[^"]+' | sort -u)

  js_raw=0
  js_gz=0
  js_count=0
  for f in $js_files; do
    fpath="${PACKS_DIR}${f}"
    if [ -f "$fpath" ]; then
      raw=$(wc -c < "$fpath")
      gz=$(gzip -c "$fpath" | wc -c)
      js_raw=$((js_raw + raw))
      js_gz=$((js_gz + gz))
      js_count=$((js_count + 1))
    fi
  done

  css_raw=0
  for f in $css_files; do
    fpath="${PACKS_DIR}${f}"
    if [ -f "$fpath" ]; then
      raw=$(wc -c < "$fpath")
      css_raw=$((css_raw + raw))
    fi
  done

  js_raw_kb=$(echo "scale=1; $js_raw / 1024" | bc)
  js_gz_kb=$(echo "scale=1; $js_gz / 1024" | bc)
  css_raw_kb=$(echo "scale=1; $css_raw / 1024" | bc)

  printf "%-25s %10s %10s %8d %10s\n" "$name" "${js_raw_kb}" "${js_gz_kb}" "$js_count" "${css_raw_kb}" >> "$OUTFILE"
  echo "  ${name}: Raw=${js_raw_kb}KB, Gzip=${js_gz_kb}KB (${js_count} files), CSS=${css_raw_kb}KB"
done

echo "" >> "$OUTFILE"
echo "Results saved to ${OUTFILE}"
