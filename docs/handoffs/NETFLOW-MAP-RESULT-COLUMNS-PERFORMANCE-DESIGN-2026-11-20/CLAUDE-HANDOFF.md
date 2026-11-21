Copyright (c) 2026 LFC Foundry. MIT License.

# Claude assignment: investigate the large layout-result handoff

Read `README.md`, `TEST-MATRIX.md`, `BENCHMARK-PROTOCOL.md`, and `RESULTS-TEMPLATE.md` before changing code. This plan starts at Netflow Map `main` commit `b1281df`; check the active base and re-read the current source and call sites before coding.

## Goal

Determine whether synchronous layout-result reconstruction still causes a material main-thread pause or delays the first Network picture. If so, prototype one bounded approach at a time and keep or reject it from measured evidence. Do not assume the old 221 ms measurement still holds.

## Sequence

1. **Audit the current path.** Read `src/pack.js`, `src/engine-client.js`, `src/app/30-map.js`, the current scene adapter/vendor call sites, `test/pack.test.js`, `test/browser.test.js`, and the relevant benchmark scripts. Confirm which result shapes are packed, how `pos` aliases nodes, which fields are mutated, and what still forces materialization. Update this handoff if `main` has already changed the path.
2. **RC-00, no optimization.** Add temporary or isolated benchmark instrumentation for worker build, pack, message delivery, unpack, scene creation, first stable draw, long tasks, and memory. Run the production CSP path. If unpacking is not a meaningful cost in current engines, report the result and stop.
3. **RC-01, one Network prototype.** Try a column-backed input at the Network-scene boundary only. Preserve the normal object API for unconverted consumers and define a safe fallback for unsupported shapes. Keep it behind a test switch until differential and visual checks pass. Do not add Proxy-based access unless a cross-browser experiment supports it.
4. **RC-02 only if needed.** If RC-01 is not viable and decode is still a long task, prototype chunked object reconstruction as a separate diff. Add cancellation for superseded builds and measure both responsiveness and the delay to the first complete picture.
5. **Decide separately for each candidate.** Fill a results report and preserve raw data. A noisy or neutral result is a no-go, not a reason to stack candidates or change the threshold.

## Required checks for code changes

- Add focused tests from the matrix, then run the applicable Node tests (`node test/all.js --changed` or the focused test files) and the required browser blocks. Use `node test/need-browser.js` to see whether the changed files require browser coverage.
- Re-read the current approved browser list immediately before the run. Run approved browsers one at a time and print the exact browser version on the first output line. Do not run GNOME Web or Safari/iOS.
- Exercise the real production CSP. Do not loosen it or add `unsafe-eval`.
- Check Canvas 2D, WebGL 2, and WebGPU parity where available. Keep a skip distinct from a pass.
- Do not put timing thresholds in correctness tests. Do not change the layout algorithms, import/export formats, saved-layout key, import limits, vendor modules, or unrelated performance paths in this experiment.

## Delivery

Work on an isolated Codex candidate branch/worktree. Do not modify `main` or force-push. Keep RC-01 and RC-02 in separate commits. Return the exact base and candidate commits, source and test changes, commands and outcomes, raw evidence paths, browser/device coverage, adoption decision, and known limits. Update these design docs if measurements invalidate their source assumptions.
