# Which memory-compression methods does Netflow Map really use?

Copyright (c) 2026 LFC Foundry. MIT License. Made 2026-10-18 for the owner. Build under test: memory-compression 2.0.2 as in Netflow Map 2026.10.18.1101.

## What this is and how it was done

A test of which parts of memory-compression get used when Netflow Map stores about 100,000 items, to see whether rarely used parts could be dropped to shrink the module's standing memory. Five data sets of about 100,000 items were packed in Firefox 158.0 (the app's own call, mode "fast", and also mode "balanced" for comparison) with a counter added to a copy of the module that records, for every packed piece, which number way, which column kind and which byte coder was chosen. Every result was unpacked and compared. The memory cost of the module was measured separately in Chromium 155.0.8059.39, where the heap and the resident memory of the page can be read exactly. Node was used for nothing here except building the page.

## Why it was done

The owner asked whether low-use parts could be deprecated to cut the module's standing overhead (about 8 MB when used in the full application).

## Answer in plain words

1. **Taking out rarely used methods will not shrink the standing memory.** Loading a script of a quarter, a half or the full size of the module all cost the same memory (4.0 to 4.4 MB over a blank page), and a minified copy (159 KB instead of 281 KB) cost the same as the original (13.4 against 13.5 MB). The memory is not proportional to the code size.
2. **Where the standing memory really goes** (Chromium 155, lower is better, change from a blank page, 5 fresh browsers each, medians):

| Part | Resident memory | How found |
|---|---|---|
| Any script at all (fixed cost of running one) | about 4.0 MB | script of the same size doing nothing |
| The module's own JavaScript setup | about 4.2 MB | module without both wasm helpers 8.2 MB, minus 4.0 |
| The LZ4 WebAssembly helper, compiled when the module loads | about 5.3 MB | shipped 13.5 MB, minus 8.2 |
| The text and columns helper (loads only on first use) | 0 MB at load | removing it changes nothing at load |
| Total on load | about 13.5 MB (JS heap only +0.7 MB) | module as shipped |
| After the first real pack (250,000 links, slices of 25,000) | another 4.0 MB wasm memory for LZ4 and 1.1 MB for the helper, buffer pool 0.4 MB | stage table below |

Stage by stage after use (Chromium 155, one run, lower is better): JS heap 0.62 MB without the module, 1.37 loaded, 1.71 after packing 250,000 links; LZ4 wasm memory 0 then 4.00 MB; helper wasm memory 0 then 1.13 MB; buffer pool 0.38 MB, 0.00 after `freeBuffers()`; resident change from the blank page +12.9 MB loaded, +21.5 MB after packing, +19.8 MB after dropping the packed copy and +19.0 MB after letting go of both wasm instances.

3. **What would cut it** (not done, for the module thread to decide): start the LZ4 wasm only when the first pack needs it (saves about 5.3 MB on every map that never packs, which is every map under the idle-pack size), and cap the wasm memory (4.0 MB today, set by the 1 MB chunk). Letting go of both wasm instances after packing gave back only 0.8 MB of resident memory, so that does not help.
4. **What the data says about use.** In the app's mode ("fast") every piece of every data set was stored by one coder: LZ4 in WebAssembly (100% of packed bytes). Deflate and the plain-JavaScript LZ4 never ran.

## What was used (Firefox 158.0, five data sets, all exact on unpack)

Fast mode (what the app does today), by shuffle form of the byte coder: shuffle 4 with delta 32 chunks, shuffle 4 30, shuffle 8 15, no shuffle 53, shuffle 8 with delta 2, shuffle 2 with delta 2, shuffle 2 1, stored plain 2 (random bytes, as it should).

Column kinds seen (count of columns): CONST 49, TEMPLATE 23 (text patterns), RECORDS 20, F32 8, ARRAYS 8, INT 7, STRD 4, TUPLE 4, STRR 3, TIMES 2, F64 2. **Never seen:** FSST, FRONT, PCO, REFS, REFRECS, BOOL, NULLABLE, ANY, DEC. FSST, front coding and Pcodec are opt-in, and the app does not switch them on, so this test did not exercise them on purpose.

Balanced mode (number picker on), blocks chosen: DELTA 657, ENT 252, FOR 128, PFOR 70, CONST 3. **Never chosen:** RLE, DICT, DIV, RAW, ALP, RD, FDICT, PLANES. Layout links shrink a further 27% to 29% in balanced mode (community 813 to 574 KB, random 914 to 670 KB, hub 856 to 624 KB, rich 756 to 540 KB, 100,000 items each) at about the same pack time.

Sizes of the main pieces in fast mode (packed against raw, lower is better): graph links 1.7% (community), 2.0% (random), 1.8% (hub), 5.5% (rich, with labels, weights and dates); layout links 1.0%, 1.2%, 1.1%, 1.0%; scene positions about 87%; link ends 47% to 62%. Plain text: words 497 KB, sorted words 190 KB, log lines 170 KB. Numbers: counting 0.4%, timestamps 27%, two decimals 62%, random fractions 71%. Random bytes 100%.

## Source size by part (for a page-weight decision, not a memory one)

Number picker 36.7 KB, column writer 37.1 KB, FSST 31.7 KB, reader 33.0 KB, WebAssembly LZ4 helper 34.8 KB (32 KB of it is the wasm text), keeper 14.4 KB, deflate encoder 15.8 KB and decoder 10.6 KB, the rest under 12 KB each. Deflate (26.4 KB, used only by the "small" mode that the app never calls) and FSST (31.7 KB, opt-in) are the largest parts the app does not use. Removing them would cut the file size and download, not the memory.

## Follow-up: the recommended changes, measured (2026-10-18)

- **Start the LZ4 wasm on first use:** pages that never pack save 5.8 MB on load (14.96 to 9.12 MB in Chromium 155, lower is better, medians of 5 fresh browsers); pages that pack end the same (22.63 against 22.98 MB after 250,000 links); the first pack of 25,000 links takes about 3 ms longer (24 to 28 ms Chromium, 18 to 21 ms Firefox 158.0); output unchanged. Written up as memory-compression 2.0.3 for JS-modules: project files: js-modules-research/memory-compression/2.0.3/BRIEF-apply.md.
- **Smaller starting wasm memory (4 MB to 1 MB):** built (the rebuild is byte-identical to the published file with the original flag) and measured: no change in resident memory (22.63 MB both), so it is not recommended after all. The 4.00 MB figure above is reserved size, not resident size.

## Limits

- The data sets are made-up maps. "Item 123" style labels pack far better than real names (the community items came to 4 KB). Real data will use the text ways more. Judge unused number ways from the balanced-mode list with care: this test covers six number shapes and four map shapes only.
- "Never seen" means never chosen on these data sets. A way that is rare here may matter for another kind of data, which is why removal needs the owner's decision on a card.
- Resident memory is the page's renderer process as seen by the operating system; it includes memory the browser has not given back. Differences of under 0.5 MB are noise. The heap number is exact.
- One Chromium build only for memory. Firefox cannot give an exact heap number from outside, so it was used for what gets chosen and how fast, not memory.
- Time to pack and unpack per piece is in DATA.md; timings are single runs per piece.

## Files

- Raw tables: `DATA.md` and the JSON files next to this report.
- Scripts (in the netflow-map repository): `bench/compression-methods/make.mjs` (builds the page), `run.js` (the five data sets in one browser), `footprint.js` (stage-by-stage memory), `load-cost.js` (load cost by part).

## Credits

memory-compression is LFC Foundry's own (LZ4-class and deflate coders, FSST and PPMd credits are in its README). Test browsers: Firefox 158.0 and ungoogled-chromium 155.0.8059.39-1, from the "browsers" branch of lfcfoundry/knowledge-base.
