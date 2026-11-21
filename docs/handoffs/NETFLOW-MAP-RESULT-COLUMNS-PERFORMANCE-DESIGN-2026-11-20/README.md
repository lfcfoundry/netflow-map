Copyright (c) 2026 LFC Foundry. MIT License.

# Netflow Map large-layout handoff performance design

**Purpose:** give Claude an evidence-led plan to investigate and reduce the main-thread work required to receive a large layout and show its first usable picture. These files are design documents only. They make no new performance claim and change no application code.

## Source baseline

This plan is based on GitHub `main` at `b1281df` (`Vendor netflow-circular 1.5.0, netflow-plot 2.18.0, netflow-scene 1.14.1 (new options off) (#223)`, 2026-11-20). Recheck `main`, the applicable source, and its call sites before coding.

The current handoff already packs large layout rows into columns in `src/pack.js`. The page then rebuilds ordinary row objects in `unpackRows`; `Client.onMsg` calls `unpackResult` synchronously as the worker reply arrives (`src/engine-client.js`). The CSP-safe path uses a per-row object and per-field assignment because the app does not allow `unsafe-eval`. Existing comments report that this path is substantially slower in Firefox than the generated-literal path, but the current end-to-end cost must be measured again.

The benchmark notes identify page-side object rebuilding as 221 ms of a 345 ms handoff at 100,000 items in an older Chromium run (`docs/BENCHMARKS.md`, section 6). Treat that as a lead, not a current measurement: packing, scene construction, renderers, browsers, and the app have changed since then. The source still contains synchronous unpacking, so the opportunity remains plausible.

## Ranked work

| ID | Recommendation | Why it is worth checking | Status |
|---|---|---|---|
| RC-00 | Measure the worker-to-first-picture timeline by phase. | Establish whether row reconstruction is still a large cost and separate it from engine work, message delivery, scene building, and drawing. | Required first step; no optimization assumed. |
| RC-01 | Prototype a column-backed input for the first Network scene. | Could avoid eagerly rebuilding a second full set of layout objects on the critical path and may reduce peak live objects. The scene and app currently expect mutable row objects in many places, so scope this to an isolated Network-view prototype. | Hypothesis; broad compatibility and actual gain are unproven. |
| RC-02 | Prototype time-sliced object reconstruction only if responsiveness remains poor. | Could cap a long main-thread task while preserving the existing object API. It may delay the first picture, so it is a fallback to evaluate against user-visible latency, not an assumed win. | Hypothesis; use only if RC-00 shows long tasks and RC-01 is not a practical fit. |

Do not combine RC-01 and RC-02 in the first comparison. First measure the current path; then make one isolated prototype at a time. If the existing current build no longer reproduces a meaningful cost, record that and stop.

## Existing work to preserve

- Large results already use `NFMPack.packResult` and transferable typed-array buffers.
- Large-map previews, saved layouts, prepared-array reuse, and lazy/async link handling already address other parts of the first-picture and memory paths.
- Network scene construction has important behaviors around saved positions, pinning, picking, selection, drag, exports, and switching views.
- Three draw backends are expected to remain visually identical. Never relax the CSP or add `unsafe-eval` to make row reconstruction faster; repository policy permits only the existing WebAssembly CSP allowance.

## Documents

- [Test matrix](TEST-MATRIX.md) — result-shape boundaries, exactness checks, and user-facing permutations.
- [Benchmark protocol](BENCHMARK-PROTOCOL.md) — phase timing, paired comparisons, responsiveness, memory, and stop rules.
- [Results template](RESULTS-TEMPLATE.md) — evidence to preserve for each prototype.
- [Claude handoff](CLAUDE-HANDOFF.md) — ordered investigation and delivery requirements.

## Scope

Keep this work limited to the large layout result handoff and first Network picture. Do not change layout algorithms, file formats, saved-layout keys, renderer selection, import limits, or vendor modules as part of the initial experiment. Treat improvements to other views as separate proposals after the Network prototype has independent results.
