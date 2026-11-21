Copyright (c) 2026 LFC Foundry. MIT License.

# Large-layout handoff correctness and permutation matrix

Correctness and timing are separate gates. For each candidate, compare its result with both the current implementation and an independent small-case oracle. Do not accept a faster path that changes layout fields, pictures, selection behavior, or saved output.

## Shared invariants

For every applicable case, verify:

- The result has the same own properties, property order where observable, values, array lengths, and array order as the current implementation. Cover `NaN`, infinities, `-0`, booleans, empty strings, non-ASCII and astral text, and list-valued fields.
- `L.pos[id]` refers to the corresponding object in `L.nodes` when the ordinary object form is requested. Preserve missing IDs, duplicate-key behavior, and the current safe handling of `__proto__`, `constructor`, and `toString`.
- Repeated reads, pin edits, drag edits, and a later layout do not mutate the source graph or reuse stale data from a superseded build.
- Unsupported result shapes and all current pack fallbacks still return the current result unchanged.
- The rendered result matches the baseline in Canvas 2D, WebGL 2, and WebGPU where available, using the repository's existing pixel parity rule. A supported backend being unavailable is a recorded skip, not a pass.
- The actual production CSP remains in place. Do not add `unsafe-eval` or use an eval-based shortcut.

## Baseline and packing boundaries

Exercise the current packer before any prototype so each branch is known:

| Dimension | Required cases |
|---|---|
| Row count | 0, 1, 1,999, 2,000, and 2,001 rows, plus larger Network results. The current pack threshold is per row list; test `nodes` and `edges` independently. |
| Row shape | Same keys and order; a missing key; an extra key; mixed primitive types; `null`; nested object; array of numbers; array with a non-number; empty list; a long text column near the packer limit. |
| `pos` map | Keys in node order; different key order; absent position; an unknown object reference; prototype-sensitive keys. Confirm that aliases point to the same node in object mode. |
| Transfer | Transferred buffers, structured-clone without transfer, empty buffers, and the uncompressed object fallback. Check that a detached buffer is never read again by the worker. |
| CSP | Production page policy, Node test context, and any worker context used by the harness. Record which decoder path each context actually takes. |

## RC-01 — column-backed Network-scene prototype

This candidate should initially avoid producing ordinary layout row objects only for the first Network scene. Keep an explicit adapter boundary; do not rely on Proxy behavior unless a measured prototype shows it is beneficial in every target engine.

| Dimension | Required cases |
|---|---|
| Network arrangement | Stress 2D; Force 3D where the card or processor produced the result; saved-layout hit; rough preview followed by final layout. |
| Size | 5,000; 25,000; 50,000; 100,000; and the largest safe supported case. Include the 1,500-item control below the large-result path. |
| Link shape | Sparse (about 1 link/item), moderate (about 3), dense (about 4); self-links, parallel links, missing endpoints, and a high-degree hub. |
| Row-column representation | All numeric fields; text labels; booleans; optional/missing fields; list-valued fields; any mixed column that forces the current `any` representation. Include a result that cannot be packed. |
| View transition | Network to Flow or Sankey; Network to a nested view; back to Network; palette-only change; layout-affecting setting change. Ensure a fallback or conversion happens once and does not leave stale columns. |
| User action | Pick, hover, rectangle/lasso select, pin, drag one node, save layout, export SVG/PNG, and rebuild after a data edit. Include a second map arriving while the first result is pending. |

### RC-01 object-boundary assertions

- Identify which consumers can read packed columns directly and which require regular node or edge objects. List them by call site before implementation.
- Verify the scene contains the same IDs, positions, dimensions, labels, styles, link endpoints, hit-test results, and draw order as the baseline.
- When a consumer requires object rows, materialize them once, keep identity stable for that layout, and verify no second conversion occurs on a look-only change or view re-entry.
- Preserve the ordinary `L.nodes` / `L.edges` contract for any API path not explicitly moved behind the adapter. Keep the candidate behind a local test switch until equivalence is established.
- Confirm memory accounting includes both the packed columns and any objects that remain live; a transferred buffer is not itself proof of lower peak memory.

## RC-02 — time-sliced reconstruction prototype

Run this only if RC-00 confirms a long main-thread task and RC-01 is rejected or out of scope. The decode should preserve the exact object API while yielding between bounded chunks. A newer build must cancel stale work without publishing a partial result as complete.

Required cases:

- Chunk sizes of 256, 1,024, and 4,096 rows, plus current synchronous decode. Tune from measurements rather than selecting a winner in advance.
- Nodes only, edges only, both lists, text/list columns, and non-packable fallback rows.
- A new build, data replacement, tab switch, and page close during decode. A canceled decode must release references and never call the completion handler.
- A responsive control input and animation heartbeat during decode. Confirm the first completed picture and total completion time separately; a lower maximum task with a much later picture is not automatically an improvement.

## Coverage strategy

Do not run every cross product. Run the explicit boundaries above, then a pairwise set across size, density, row shape, arrangement, and user action. Add a small seeded differential run; retain each failure as a deterministic case. Run each draw backend in a fresh, known state so prior capability probes do not select a different backend accidentally.

Existing starting points include `test/pack.test.js`, `test/layout-saved.test.js`, `test/lazy-links.test.js`, and the `browser.test.js` Network, saved-layout, backend-parity, selection, and drag checks. These tests do not currently prove that a column-backed first scene is equivalent or that a time-sliced decode cancels safely.
