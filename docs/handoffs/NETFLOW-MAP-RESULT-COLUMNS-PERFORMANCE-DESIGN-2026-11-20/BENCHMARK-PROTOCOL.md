Copyright (c) 2026 LFC Foundry. MIT License.

# Large-layout handoff benchmark protocol

## Phase timing before optimization

Measure the current build first. Use the same deterministic graph and layout options for every comparison, and report the following phases separately where instrumentation allows:

1. Engine build time inside the layout worker.
2. `NFMPack.packResult` time and logical packed bytes.
3. Worker message delivery and transferred byte count.
4. `NFMPack.unpackResult` time on the page, including text/list column expansion and row-object creation.
5. Page work between receiving `L` and `NFMScene.make` completion.
6. Time to the first completed draw and to the first stable frame.
7. Total operation time, maximum main-thread task, count and total duration of tasks over 50 ms, and longest animation-frame gap.
8. Peak and retained memory, with the measurement source and whether it includes workers and graphics memory.

Keep phase probes out of the final timed run when they materially change the hot path. Do not add timer assertions to correctness tests.

## Workloads

| Set | Data and permutations | Purpose |
|---|---|---|
| Small control | 1,500 items, below the current packing threshold; 5,000-item Network map. | Check that large-result handling does not tax ordinary maps. |
| Network scale | 25k, 50k, 100k items, then the largest safe supported case; sparse, moderate, and dense links. | Test whether page-side reconstruction remains material as the result grows. |
| Result shapes | Packed rows, text/list columns, mixed or nested values, and non-packable fallback. | Separate gains on the common fast path from fallback regressions. |
| User-visible path | Fresh layout, rough preview plus final layout, saved-layout restore, palette-only rebuild, one pin/drag, and view switch. | Measure first picture and post-picture costs, not an isolated decoder only. |
| Renderers | Canvas 2D, WebGL 2, WebGPU where supported; use the same positions and options. | Detect whether reduced handoff cost is hidden by or shifts work into drawing. |

Use deterministic synthetic maps. Generate fixtures before timing; exclude file import, fixture construction, browser startup, and screenshots from the layout/handoff timer. Keep instrumented phase measurements separate from end-to-end trials.

## Runtime and repetitions

- Re-read the `browsers` branch of `lfcfoundry/knowledge-base` immediately before browser runs and list the current approved browser versions. The repository rule is to test Firefox, ungoogled Chromium, and WebKitGTK one at a time, with the real version printed on the first line. Also qualify the target Chrome midrange Android device when available.
- Record OS/device, CPU class, hardware concurrency, memory where available, viewport, device pixel ratio, power mode, renderer, and whether the worker or card path was used. Do not combine unlike devices or browser engines into one statistic.
- For each cell, use at least five unmeasured warm-ups, then at least 20 paired baseline/candidate trials for common sizes and 10 for the largest safe size. Balance baseline/candidate and candidate/baseline order in the same session. Repeat a near-threshold result in a second session.
- Preserve raw trials. Report p50, p90, p95, maximum, paired effect interval, and number of long tasks. Mark unavailable GPU backends and unsafe sizes explicitly.
- Use the repository's existing noise guard or paired browser runner where it fits. Do not replace fresh-page and steady-machine checks with best-of timing.

## Decision gates

Correctness, saved-layout, and visual parity are mandatory. Any mismatch rejects the candidate until explained and fixed.

**RC-00 stop rule:** if current production-browser results do not show a repeatable main-thread or first-picture cost attributable to unpacking/materialization, document the result and stop this proposal.

**RC-01 adoption rule:** adopt only if the Network target at 25,000 items or more shows at least a 10% improvement in p50 time to first usable picture or a clearly measured reduction in peak memory, in at least two approved desktop engines. Require no more than 5% p50 or p90 regression in the 1,500-item and 5,000-item controls, saved-layout restore, or renderer parity path. Confirm any near-threshold win in a second session and on Android before enabling it by default.

**RC-02 adoption rule:** the maximum decode task must fall below 50 ms in the target large-map cells, while p50 first-picture time and total completion time each regress no more than 5%. If it only reduces task size but delays the picture beyond this gate, report it as a responsiveness trade-off and leave it off by default pending an explicit product decision.

If confidence intervals straddle a gate, call the result inconclusive. Do not tune the threshold after seeing the result. A memory reduction must identify whether it is peak page heap, retained page heap, worker memory, or total process memory.

## Evidence

Use [RESULTS-TEMPLATE.md](RESULTS-TEMPLATE.md). Store deterministic fixture parameters, seeds, commands, exact source revision, and raw trial data beside the candidate. Keep performance numbers out of correctness assertions and do not claim browser memory bounds from typed-array byte counts alone.
