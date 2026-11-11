Copyright (c) 2026 LFC Foundry. MIT License.

# Claude results (2026-11-11)

Corrective commits on top of the preserved Codex handoff (`64cd702`, `dd4111a`): `d61910c` (vendor netflow-plot 2.17.0, new test, rebuilt pages) and `43b1e16` (test harness). Source of the plot change: JS-modules handoff branch commit `217b9ae`; `vendor/netflow-plot.js` is byte-identical to it.

| Item | Status |
|---|---|
| Real "Other" vs overflow | **FIXED AND TESTED**: distinct internal identity for the rest; literal labels kept; rows and values conserved |
| Tiny wedges | **FIXED AND TESTED** after SVG rounding (areas read from the written SVG); pixel visibility **NOT RUN** (no browser raster) |
| SVG XML escaping | **READY FOR INTEGRATION REVIEW**, unchanged |
| Full-suite stall | **PARTIAL**: not reproducible here; harness hardened so a hang becomes a named failure |

Details of both chart fixes, the minimum-size wedge policy and its distortion bound: JS-modules `docs/codex-handoffs/claude-2026-11-11/CLAUDE-RESULTS.md`.

## Tests run (Node 22.23.4, Linux x86_64, 4 CPUs)

| Command | Result |
|---|---|
| `node test/plot-rest-wedges.test.js` (new, 186 checks on the vendor copy) | pass |
| `node test/plot.test.js` | 319/319 |
| `node docs/codex-handoffs/claude-2026-11-11/evidence/netflow-adversarial.cjs` | exit 0; candidate rows now cover 7/7 in the count case; tiny-wedge rounded area 43.13 px² for every ratio from 1e3 to 1e20 (was 0) |
| `python3 -c "...E.fromstring(gzip.open('.../svg-candidate.svg.gz').read())"` | parses |
| `node tools/build.mjs` | built (readable fallback: esbuild not installed, as before); `index.html` and `docs/play/index.html` identical |
| `node test/all.js` (full Node suite, before harness change) | **49/49 pass, 44.0 s, 4 lanes** |
| same with `os.cpus()` forced to `[]` (the Android condition, 1 lane) | **49/49 pass, 138.9 s** |
| `node test/all.js` after the harness change | 49/49 pass, 51.6 s |

Browser tests (`test/browser.test.js`), the Linux approved-browser picture gate and Pixel QA were **NOT RUN**.

## Full-suite stall: what is known

- The suite completes here both in parallel and in one lane, so serial execution alone does not cause it.
- `test/video.test.js` is synchronous and ends with `process.exit`; it starts no worker, timer, child or browser. A child parked in a futex wait therefore points at the Node runtime on that device (Node 26.13.0 on Android arm64 with `os.cpus().length === 0`), for example at exit or in thread start-up, rather than at the test. This is an inference; the cause is **unresolved** without a run on that device.
- The harness waited for `close` only, with no time limit and no `error` handler, so any hang stalled the whole run silently. Now: per-file limit `NFM_TEST_TIMEOUT_S` (default 900 s), SIGKILL plus `FAIL ... (timed out after N s, pid P, still running | exited ... but its output pipes stayed open)` with the last output, an `error` handler, and lanes from `os.availableParallelism()` when `os.cpus()` is empty. Checked with `NFM_TEST_TIMEOUT_S=1 node test/all.js --only='video|stress-wasm'` (stress-wasm reported as timed out, as intended). No test was skipped or changed.
- Next step on the device: run `node test/all.js` there; the new FAIL line will say whether the child was still running or exited with its pipes held.

## Integration

Re-vendor from JS-modules once netflow-plot 2.17.0 is released; rebuild with `node tools/build.mjs` and keep page parity. The rest is now a `String` object: app code that compares series names with `===` against `'Other'` would no longer match the rest (none found in `src/`).
