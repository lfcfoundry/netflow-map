Copyright (c) 2026 LFC Foundry. MIT License.

# Independent findings, one issue at a time

## NUL grouped keys — already fixed

Two distinct grouped keys containing NUL remained separate in both the parent and candidate. No duplicate correction is required.

## BLOCKER: real `Other` and synthetic overflow

The candidate renames real `Other` to `Other (category)` before adding an overflow bucket. A top-2 fixture with `Other:100`, `A:90`, `B:80`, `C:70` then keeps all rows; the parent had folded real `Other` into overflow. However, a real `Others` category in count mode collides with the later display name of synthetic overflow. With seven rows, the candidate emits two `Others:2` marks for overflow rows and loses the real `Others` rows: only five distinct rows remain covered. The visible rename also changes literal label semantics. Independent probes covered real-only, overflow-only, both, blank/missing, top 1/2/3/4, grouped and ungrouped examples. Preserve stable ordering and row coverage; use distinct **internal** category identity rather than a user-visible string as the overflow key. Also test a real `Others, average` label.

## SVG XML scalar escaping — ready for integration consideration

The candidate serializes XML-invalid scalar controls, lone UTF-16 surrogates and U+FFFE/U+FFFF as visible escape text. It preserves tested valid tab/LF/CR, BMP boundaries and supplementary Unicode. The parent fixture failed XML parsing; the candidate fixture parsed. Very large-label allocation/time is unmeasured. Keep ordinary XML metacharacter escaping and Unicode intact while correcting the other chart issues.

## BLOCKER: tiny donut visibility

The candidate reduces angular padding and emits a polygon for a tiny positive share, but at 1,000,000:1 the two-decimal SVG coordinates collapse to a line with zero rounded area. The same happened at 10^9, 10^12 and 10^16 ratios; at 10^20 a positive angle was not representable. Zero values appropriately did not create a wedge. Many-category examples also produced marked `0.0%` shares without useful visible geometry. A mathematically positive wedge angle is not a pixel-visible mark. Specify a truthful minimum visibility or alternative legend/marker policy without changing underlying values; verify actual pixels in the approved browser environment.

## MEDIUM: full-suite stall

The isolated `video.test.js` passed; the full suite remained incomplete. The test path uses synchronous synthetic video/frame writing and did not need a worker, timer, browser or external video resource. No candidate file changes video source/tests. The harness waits for child `close` without a per-test timeout or child `error` handler. The earlier video child was observed in a futex wait; the exact cause remains unknown. Do not skip or weaken the test. See [TEST-EVIDENCE.md](TEST-EVIDENCE.md).
