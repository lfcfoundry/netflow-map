# Netflow Map vs. open-source code: what to keep, what to swap, what to improve

Copyright (c) 2026 LFC Foundry. MIT License.
Written October 15, 2026 for JNFoo. Plain words on purpose: this file is meant to be handed to a future session as a starting point.

## 1. Bottom line

- **No swaps are needed.** For every module I could test head to head, our code is either faster, much smaller, or has features the open-source option does not have. Nothing I found would let us delete a module and come out ahead.
- **Three places where ours is measurably behind** (these are the work items):
  1. **Flow layout quality at 400+ items**: we are 7 to 225 times faster than dagre (and about 29x faster than ELK at 400 items), but our drawings have about 76% (vs. dagre) to 103% (vs. ELK) more line crossings at 400 items.
  2. **Found groups (label propagation)** often merges two real groups into one. Louvain gets the right number of groups on the same test. Writing our own Louvain (about 100 lines) beats both our current code and adding a library.
  3. **Large-network layout quality**: at 3,000 items our Network layouts are 3x faster than d3-force or ForceAtlas2 but their pictures are 24% to 60% truer to the real link distances (ours scores 0.22 to 0.29 where they score 0.17 to 0.18; lower is better).
- **One memory/space item**: the engine's own graph is tiny (1.2 MB for 31,000 links), but a finished layout result is 17.8 MB for the same graph. Result objects are the place to save space.
- **Quick win on size**: the app file is 685,701 bytes (201 KB gzip) and is not minified. Our own modules shrink about 40% raw and about 20% gzip when minified, so expect roughly 400 KB raw / 160 KB gzip (an estimate from the module-by-module test, not a measured full build).
- **UI**: the adaptive-layout notes from the Story Editor apply well. The audit found nine fixable gaps; the worst are no safe-area padding (the tab bar can sit under the iPhone home bar), the legend and timeline covering the map on a phone, and buttons under 36 px.

## 2. How I tested

- Everything was run on one CPU core in Node 22 (no GPU, no browser except for the screenshots). Medians of 3 runs, except where noted.
- Libraries were installed from npm and measured as they are published: elkjs 0.12.0, @dagrejs/dagre 3.1.1, d3-force 3.0.0, graphology 0.26.0 (+ louvain 2.0.2, forceatlas2 0.10.1), cytoscape 3.34.3 (+ fcose 2.2.0), sigma 4.0.2, d3-sankey 0.12.3, papaparse 5.7.0, d3-dsv 3.0.1, d3-random 3.0.1, expr-eval 2.0.2, jstat 1.9.6, gifenc 1.0.3, omggif 1.0.10.
- Sizes are minified with esbuild, then gzip level 9. Ours are our `src/*.js` files minified the same way.
- **Things to keep in mind when reading the numbers**
  - Layout tests use random acyclic graphs and one made-up 6-cluster network. Real data may differ.
  - Our timing for flow layout includes extra work (choke points, scores) that dagre and ELK do not do.
  - "Crossings" are counted as straight lines between item centers. This is a fair yardstick across tools but not exactly what a ribbon drawing looks like.
  - Rendering (canvas, WebGL, WebGPU) was **not** measured. It needs a real browser run, and I only compare it by design below.
  - The GIF test re-encodes frames that came from our own earlier GIF (already 255 colors), which is friendlier to our encoder than a fresh photo-like source.

## 3. Module by module

| Module (ours) | Closest open-source | Result | Verdict |
|---|---|---|---|
| Flow / layered layout (`engine.js`) | ELK, dagre, d3-sankey | Much faster and smaller; more crossings | **Keep, improve crossings** |
| Network layouts: stress, force (`engine.js`) | d3-force, ForceAtlas2, fcose | Faster at 3,000; less true at 3,000 | **Keep, tune** |
| Found groups (`engine.js`) | Louvain (graphology) | Faster, but merges groups | **Replace with our own Louvain** |
| Choke points, exact odds | none found | no equivalent | Keep |
| Monte Carlo (`sim.js`) | d3-random, jstat | Equal or faster; same averages | **Keep** |
| Formulas (`columns.js`) | expr-eval | 7.7x faster | **Keep** |
| CSV reading (`importers.js`) | PapaParse, d3-dsv | 1.6x slower, still fast | **Keep** |
| Whole-file import (all formats) | none found that does all | 30,000 links in 110 to 160 ms | Keep |
| Checker (`check.js`) | none found like-for-like | 155 ms at 31,000 links | Keep |
| GIF writer (`gif.js`) | gifenc, omggif | 18 to 25x faster, 200x smaller file | **Keep** |
| Drawing + 3 backends (`scene.js`, `render.js`) | Sigma, Cytoscape, Pixi | not measured | Keep; measure in browser later |

### 3.1 Flow layout (layered)

Random acyclic graphs, time for the whole build and crossings counted on the result:

| Items / links | Ours | dagre | ELK |
|---|---|---|---|
| 100 / 180 | 18 ms, 566 crossings | 126 ms, 527 | 525 ms, 429 |
| 400 / 800 | 81 ms, 13,873 | 2,353 ms, 7,862 | 2,078 ms, 6,842 |
| 1,500 / 3,200 | 348 to 393 ms | 88,507 ms | did not finish in the time limit |
| 4,000 / 9,000 | 593 ms | not run | not run |

- Size: ELK is 1.46 MB minified (441 KB gzip). dagre is 48 KB (17 KB gzip). Our whole engine, with every view, is 49 KB (20 KB gzip).
- **ELK's license is EPL-2.0 or GPL-3.0.** That is not clean to ship inside an MIT project (AGENTS.md rule), so ELK is out even if it were better. dagre is MIT but stalls beyond a few hundred items.
- d3-sankey is tiny (2.9 KB gzip) but only handles acyclic data, has no state animation, and gives no choke points or odds.
- **What it takes to be superior:** the gap is crossing reduction, not speed. Add the standard "sweep" passes (barycenter or median ordering, then swap neighbors that cross) inside a time budget. We are far faster than dagre at every size, so a budget of 50 to 300 ms of extra sweeps is affordable. Target: within 15% of dagre's crossings at 400 items while staying under 200 ms.

### 3.2 Network layouts (force and stress)

Six-cluster made-up network, 7 links per item, "stress" = how badly picture distances disagree with real link distances (lower is better):

| Items | Ours: Stress | Ours: Force | d3-force | ForceAtlas2 |
|---|---|---|---|---|
| 600 | 1,053 ms, 0.111 | 375 ms, 0.141 | 814 ms, 0.184 | 649 ms, 0.169 |
| 3,000 | 1,842 ms, 0.286 | 1,585 ms, 0.222 | 5,720 ms, 0.179 | 4,813 ms, 0.174 |

- At 600 items our Force arrangement is faster and truer than both libraries, and our Stress arrangement is the truest but slower than both. At 3,000 we are 2.6x to 3.1x faster but less true; our work budget shrinks as the network grows.
- Cluster separation (how far apart groups sit compared to how tight they are) is 1.0 to 1.8 for ours and 4.7 to 5.7 for the libraries. That is by design for Stress (it follows link distances, and this test network has many random cross-links), but a user who wants visible clusters should pick the Groups arrangement.
- **What it takes to be superior:** spend more of the time we saved. We are at 1.6 to 1.8 s where d3-force takes 5.7 s; raising the large-network iteration cap, or adding a coarse-to-fine pass, should close most of the gap for free.

### 3.3 Found groups

| Network | Ours: time, groups found, match* | Louvain: time, groups found, match* |
|---|---|---|
| 600 items, 6 real groups | 2.1 ms, 4, 0.82 | 6.6 ms, 6, 0.96 |
| 3,000 items, 6 real | 22.5 ms, 5, 0.78 | 41.8 ms, 6, 0.92 |
| 3,000 items, 30 real | 10.4 ms, 37, 0.97 | 19.7 ms, 30, 0.98 |

\*Match = normalized mutual information with the groups that were planted (1.0 is perfect).

- Ours is 2x faster but merged two real groups (the 600-item map has a 300-item blob; the 3,000-item map has a 1,201-item blob).
- Adding the Louvain package costs 20 KB gzip once graphology's core is included (6 KB + 13.5 KB), for one feature. Not worth it.
- **Recommendation:** write Louvain ourselves (local moving + merge passes, deterministic order). About 100 lines, roughly 1.5 KB gzip. Keep the current label propagation as the fast fallback for 50,000+ items.

### 3.4 Monte Carlo and random numbers

2 million draws each, same average and spread checked (all agree to 3 digits):

| Distribution | Ours | d3-random | jstat |
|---|---|---|---|
| Normal | 85 ms | 123 | 146 |
| Lognormal | 219 | 195 | n/a |
| Poisson | 251 | 580 | 286 |
| Binomial | 456 | 994 | n/a |
| Exponential | 72 | 73 | n/a |

- Ours is equal or faster everywhere except lognormal (12% slower, a tie in practice).
- Ours also gives the same numbers on every run and in every worker (counter-based generator), has 16 distributions, an exact comparison, and the what-if sweep. d3-random has 8 distributions and no such controls.
- jstat's published license field is empty (the project says MIT); I would not add it without checking.

### 3.5 Formulas

300,000 rows of `if(a > 40, a * 1.5 + sqrt(b), a / b) - round(b * 2)`: ours 35 ms, expr-eval 269 ms (7.7x). Ours is also the smaller of the two (6.2 KB gzip for all of `columns.js` vs. 7.9 KB for expr-eval alone) and gives plain-words errors. **Keep.**

### 3.6 Data ingestion (CSV, JSON, arrows)

- Parsing a 2.5 MB, 50,000-row CSV with quoted fields: ours 100 ms, PapaParse 64 ms, d3-dsv 63 ms. We are 1.6x slower for the raw parse but ours also handles any one-character separator and line breaks inside quotes.
- Whole import including column guessing, cleaning and building the graph: 50,000 rows in 425 ms. A 31,000-link network imports in 156 ms from JSON (2.8 MB), 115 ms from CSV (416 KB), 111 ms from "A -> B" lines.
- No open-source tool I found reads tables, JSON, outlines, arrows and a folder of notes into one graph with a plain-words report.
- **Improvement idea (low priority):** a fast path for lines with no quote mark would close most of the 1.6x gap.

### 3.7 The checker

- Time: 19 ms at 600 items, 65 ms at 3,000, 155 ms at 10,000 items / 30,928 links. That is close to linear, so the Check tab can run live on any size we draw.
- Size: 14 KB gzip for the full rule set (flow leaks, similar names, orphan items, and so on).
- I did not find an open-source tool that checks flow balance or flags "these two names look alike". The nearest relatives (JSON-schema validators, CSV linters) check the shape of the data, not whether the flows add up. So there is nothing to swap in; it is a feature advantage.

### 3.8 GIF export

31 frames at 960 x 540:

| | Time | File size |
|---|---|---|
| Ours (one shared palette, only changed pixels stored) | 421 ms | 96 KB |
| gifenc, new palette per frame | 10,724 ms | 19.5 MB |
| gifenc, one shared palette | 7,585 ms | 19.5 MB |

- gifenc has no "store only what changed" feature, which is most of the size gap. The module is 4.2 KB gzip vs. our 1.8 KB.
- omggif (2.9 KB gzip) writes frames but does not choose colors, so it still needs a quantizer. **Keep ours.**

### 3.9 Drawing (not measured)

- Sigma is 102 KB gzip and Cytoscape is 142 KB gzip. Our scene builder plus all three drawing backends (canvas, WebGL2, WebGPU) is 26.5 KB gzip, and the whole app is 201 KB.
- Sigma is designed for very large networks on WebGL; Cytoscape is the best-known all-rounder with canvas. Neither draws width-proportional ribbons, states or animated flow dots, so swapping would mean rebuilding those on top.
- I have not benchmarked our frame rate against them. The honest next step is the one-button diagnostic page in a real browser, then comparing against Sigma on the same 10,000-item network.

### 3.10 Memory and space

For a 10,000-item, 30,928-link network:

| What | Memory |
|---|---|
| Our engine's graph (typed arrays) | 1.2 MB |
| graphology (same graph) | 13.6 MB |
| Cytoscape (headless, same graph) | 95.9 MB |
| Our finished layout result (Network, Force) | 17.8 MB |
| The same data as JSON text | 2.8 MB |

- Our core graph uses 11x less than graphology and 80x less than Cytoscape.
- The finished layout is 14x bigger than the engine's graph, because every drawn item carries its own object with scores, names and shape data. **Space improvement:** keep positions and per-item numbers in typed arrays and build the small label/detail objects only for what is on screen.
- The flow layout refuses a 10,000-item network with a clear message ("use the Network view or filter first") rather than running out of memory. That is the right behavior.
- File size: see the bottom line. Minifying is the cheapest saving.

## 4. What it would take to be clearly superior (work list)

1. **Louvain** replaces label propagation (about 100 lines).
2. **Crossing reduction** sweeps in `layered`, time-budgeted.
3. **Large-network force/stress**: use the time we have left over.
4. **Result objects as typed arrays** to cut the 17.8 MB layout result.
5. **Minified build** (about 40% smaller raw).
6. **Browser benchmark page** for drawing speed at 1,000, 10,000 and 50,000 items; compare with Sigma.
7. Optional: a no-quote fast path in the CSV reader.

## 5. Adaptive layout: what the Story Editor lessons say about Netflow Map

I measured the current app in Chromium at 390 x 844 (touch), 700 x 800, 1,000 and 1,440 with the supply-chain example loaded.

### 5.1 What we already do right

- The viewport meta has `viewport-fit=cover`.
- Tabs move to a bottom bar at 760 px and under; the six tab names fit at 390 px.
- No sideways page scroll at any size.
- Press-and-hold (560 ms) opens the same menu as right-click on touch.
- Dark theme with an explicit light/dark switch, reduced motion handled for the fade and for map animation.
- Details and rail open as bottom sheets on phones.

### 5.2 Gaps found, with what the notes recommend

| # | Gap (measured) | Story Editor lesson | Priority |
|---|---|---|---|
| 1 | **No safe-area padding anywhere** (`env(safe-area-inset-*)` is not used), so the bottom tab bar can sit under an iPhone's home bar. | Rule 3 in the recipe. | High |
| 2 | **Legend ("Key") starts open and covers about a third of the phone map** (167 x 264 px at 390 wide). | Map key starts closed at 700 and under. | High |
| 3 | **The state timeline floats in the middle of the phone screen** (y = 251, 102 px tall) over the map, its state names overlap ("Year 1 / Year 2 / End state"), and the state buttons are 16 px tall. | One thin pinned bar; secondary controls fold into one line. | High |
| 4 | **About a dozen buttons are shorter than 36 px** on touch: Ask, Look, Filter, Find, Style, Views at 34; the hand, box and lasso icons at 30; Fit and Key at 28. | Targets 36 to 40 px on touch (padding, not only the visible shape). | Medium |
| 5 | **Two fields below 16 px on a phone** (found in the states card), which makes iOS zoom in on focus. There is no 16 px rule for touch. | All fields 16 px on touch. | Medium |
| 6 | **Wording says "Right-click" and "Ctrl+Z" on phones** (for example after a box selection, after grouping, in the Nodes note, and in the route help). | Two versions of every shortcut sentence, chosen by a touch check. | Medium |
| 7 | **No separate "touch" check.** Everything keys off `max-width:760px`, so we cannot give a narrow laptop window keyboard hints while giving a phone tap hints, and we have no way to force touch in Firefox tests. | `touchOnly()` vs `phoneLayout()`, body classes, and a test hook (`NFM.touch(true/false/null)`). | Medium |
| 8 | **Sideways-scrolling rail tab strip** (Ask, Look, Filter, Find, Style, Views and a ‹ arrow) and a text-only bottom tab bar that is allowed to scroll sideways. | "A strip that scrolls sideways hides tools"; use equal columns with icons, wrap toolbars into rows. | Medium |
| 9 | **The keyboard is not handled**: no `interactive-widget=resizes-content`, no `visualViewport` lift. Editing cells in the Nodes tab or pasting in the Data tab can leave the field under the keyboard on iOS. | Typing mode, with the `--kb` variable. | Medium |
| 10 | The empty Map is a **black rectangle** in the light theme on first open. | (Own finding.) | Low |
| 11 | The rail sheet is **58% of the screen** (427 of 844 px) when open, hiding most of the map. | Keep one thin bar; fold the rest. | Medium |

Not in the list because the app already does them or they do not apply: touch drag has a menu equivalent (selection bar and context menu); long-press exists.

### 5.3 What to adopt, adapt, skip

**Adopt directly**
- Safe-area padding on the tab bar, bars and sheets.
- 16 px fields and 36 to 40 px targets on touch.
- `touchOnly()` / `phoneLayout()` split, body classes (`touch`), and a test hook to force touch.
- Two-version wording for every shortcut sentence.
- Key starts closed at 700 and under.
- Icon plus tiny label bottom tab bar in equal columns (never scrolls).
- Screenshots at 390, 700, 1,000 and 1,440 in the test run.

**Adapt**
- The "one thin pinned bar" idea: on the phone, dock the state timeline as a slim row (play, scrubber, state name) directly above the tab bar, and fold "Normal" mode and the other options into a small menu.
- The "⋯ menu" idea: collapse the Map's secondary buttons (Fit, Key, mode) into one menu on phones.
- Typing mode: do not fold the whole screen. Instead hide the bottom tab bar while a field has the keyboard and lift the field with `--kb`.
- Swipe: allow it on the timeline bar only (swiping the map itself already pans).
- The rail: keep it as a bottom sheet but start it as a one-row "peek" (about 15% of the screen) and let the person pull it up; today it opens at 58%.

**Skip**
- Page drawers, page picker, the story counters line, the logo move to the bottom bar (`brandlow`), and the exported-game rules. They are specific to the story editor.

### 5.4 One decision for later

The notes use **820 px** as the phone breakpoint, so portrait tablets (768 to 834 px) get the phone layout. We use 760 px, so a portrait tablet currently gets the desktop layout with a 312 px side panel, which squeezes the map. Moving to 820 would match the notes.

## 6. Sources

- Packages measured (npm, as installed): elkjs, @dagrejs/dagre, d3-force, d3-sankey, d3-dsv, d3-random, graphology, graphology-communities-louvain, graphology-layout-forceatlas2, cytoscape, cytoscape-fcose, sigma, papaparse, expr-eval, jstat, gifenc, omggif.
- Their source repositories: https://github.com/kieler/elkjs, https://github.com/dagrejs/dagre, https://github.com/d3/d3-force, https://github.com/d3/d3-sankey, https://github.com/d3/d3-dsv, https://github.com/d3/d3-random, https://github.com/graphology/graphology, https://github.com/jacomyal/sigma.js, https://github.com/cytoscape/cytoscape.js, https://github.com/mholt/PapaParse, https://github.com/silentmatt/expr-eval, https://github.com/jstat/jstat, https://github.com/mattdesl/gifenc, https://github.com/deanm/omggif
- Story Editor adaptive-layout notes (the attached `story-editor-UI-ADAPTIVE-LAYOUT.md`).
- Our own benchmark scripts were kept outside the repo; every number above came from running them on this machine on October 14 to 15, 2026.

## 7. What was done after this report (October 15, 2026)

You picked four engine/build items and four layout groups. Results, measured the same way as above:

**Big-network layouts** (six-cluster test network, one core, median of 3):

| Items | Before: Stress | After: Stress | Before: Force | After: Force | d3-force | ForceAtlas2 |
|---|---|---|---|---|---|---|
| 600 | 1,053 ms, 0.111 | 1,057 ms, 0.111 | 375 ms, 0.141 | 369 ms, 0.141 | 814 ms, 0.184 | 649 ms, 0.169 |
| 3,000 | 1,842 ms, 0.286 | 1,650 ms, 0.224 | 1,585 ms, 0.222 | 2,602 ms, 0.154 | 5,720 ms, 0.179 | 4,813 ms, 0.174 |
| 10,000 | about 15,600 ms | 3,556 ms, 0.244 | not measured | 6,136 ms, 0.278 | not run | not run |

- The biggest cost at 10,000 items was not the layout math but the step that pushes overlapping items apart (9.9 of 12 seconds). It now uses number keys and linked lists instead of text keys. That alone is about 4x faster at 10,000 items.
- Stress now also anchors linked pairs directly, which is where the quality gain at 3,000 came from. Force uses 240 rounds up to 5,000 items (was 120), which beats d3-force's truthfulness at 3,000 (0.154 vs 0.179) in about half its time.
- Stress at 3,000 (0.224) is still behind d3-force (0.179). More rounds did not help; the limit is the pivot method. A multilevel approach would be the next step.

**Build size** (`node tools/build.mjs` now minifies by default; `--dev` keeps it readable; `--pack` also writes `index.packed.html`, a self-extracting copy made with our own lzma-pack module, for downloads outside git):

| | Before | After |
|---|---|---|
| index.html | 692,648 B | 478,901 B (31% smaller) |
| gzip | 202,813 B | 170,389 B |
| lzma-pack self-extracting page (`--pack`) | – | 156,001 B (the plain .xz was dropped; lzma-pack is our own module) |

**Layout result memory** at 10,000 items / 30,928 links: 17.8 MB to 16.3 MB (about 9%). The rest is one object per item and per link; going lower means storing positions and numbers in typed arrays, which is a bigger change deferred for now.

**Phone and PC layout** (all in the app now): breakpoint 820 px; safe-area padding; 16 px fields and 36 to 40 px targets on touch; key closed on a fresh phone map; icon bottom tabs in six equal columns; one slim docked timeline row with a ⋯ for loop and speed; the controls sheet is 52% and can shrink to one row; the keyboard lifts the page and hides the tab bar; tap-vs-click wording; `NFM.touch(true/false/null)` test hook; the empty map is no longer black. The browser test gained 9 phone checks (Chromium and Firefox pass).

Not done (you did not pick them): your own Louvain groups and the flow-layout crossing reduction.

**After the browser benchmarks (2026-10-15):** the browser checks in this report ran in Playwright's Chromium 141, not ungoogled-chromium. Everything was measured again in ungoogled-chromium 154 and Firefox 158 and is in `BENCHMARKS.md`. That run changed several of the findings above: the CSV reader now matches Papa Parse and d3-dsv; Stress is now faster than d3-force at every size measured (and truer up to 3,000 items; 7 to 28% less true at 10,000), where this report had it behind at 3,000; the GIF encoder is 1.7 to 2.7 times slower than gifenc in both browsers (the Node result above used gifenc with a palette per frame); and normal / lognormal draws are up to 1.5 times slower than d3-random in Chromium.
