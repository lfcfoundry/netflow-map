#!/bin/sh
# Phase timings of the GIF encoder in one browser: makes an instrumented copy of src/gif.js, swaps it in, runs the gifprof plan, puts the real file back.
# usage: sh bench/gif-profile.sh <firefox|chromium> <out.jsonl>     (summarize with a few lines of node; see BENCHMARKS.md section 14)
here=$(cd "$(dirname "$0")" && pwd); cp "$here/../src/gif.js" /tmp/gif.keep.js; trap 'cp /tmp/gif.keep.js "$here/../src/gif.js"' EXIT
node "$here/gif-instrument.mjs" /tmp/gif.prof.js && cp /tmp/gif.prof.js "$here/../src/gif.js" && node "$here/run.js" "$1" gifprof --out="$2"
