#!/bin/sh
# Copyright (c) 2026 LFC Foundry. MIT License. Netflow Map's standard fuzz-kit round: random pans, zooms, setting changes, tab changes, item moves, example loads and good, damaged and junk files, one browser at a time.
#   sh tools/fuzz-kit/run-netflow.sh [chrome|firefox|webkitgtk|epiphany|all] [seeds=1-12] [ops=250]
# Needs puppeteer-core on NODE_PATH, a built index.html, and the browser paths in CHROME / FIREFOX (the "browsers" branch of the knowledge base). Prints one line per seed; non-zero when a seed has findings.
cd "$(dirname "$0")/../.." || exit 2
WHICH=${1:-all}; SEEDS=${2:-1-12}; OPS=${3:-250}; BAD=0
run() { echo "== $1"; node tools/fuzz-kit/runner/fuzz_puppeteer.mjs "file://$PWD/index.html" test/fuzz-kit/netflow-adapter.js --browser "$1" --seeds "$SEEDS" --ops "$OPS" --shrink --bundle "${FUZZ_OUT:-/tmp/nfm-fuzz}/$1" || BAD=1; [ "$1" = webkitgtk ] && sleep 30; }
if [ "$WHICH" = all ]; then for b in chrome firefox webkitgtk epiphany; do run $b; done; else run "$WHICH"; fi
exit $BAD
