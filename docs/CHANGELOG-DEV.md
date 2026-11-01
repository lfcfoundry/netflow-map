# Netflow Map developer changelog

Copyright (c) 2026 LFC Foundry. MIT License.

What changed in each build, newest first, for developers, in three depths: Quick (what changed and whether saved files, saved layouts or settings are affected), Details (where it lives, numbers with the browser named) and Deep (design reasons, tests, what was tried). People who use the app read CHANGELOG.md. Builds are stamped `year.month.day.HHMM` (US Eastern). Builds before 2026.10.26 are backfilled from the build log; their Details give the browsers each build was tested in, and docs/BENCHMARKS.md holds the measurements.

## 2026.11.01.1126 · 2026-11-01

### Quick
Vendored netflow-scene 1.3.4, netflow-hierarchy 1.0.1 and netflow-circular 1.0.1 (JS-modules main a5bd71b). src/charts.js drops its globalThis shim, since circular 1.0.1 finds hierarchy without it. Same pixels; nothing saved changes.

### Details
In-app scene build at 100,000 items after a palette change: Firefox 158 and WebKitGTK 2.52.6 about 0.4 to 0.5 of the old time; Chromium 155 treemap 782-842 to 698-734 ms, pack 942-1038 to 803-881, chord 633-695 to 624-678, tree 1274-1351 to 751-772. Suites: Chromium 232, WebKitGTK 220, Firefox 209, 0 fail.

### Deep
The scene module no longer builds full records for the hidden dots of the nested views. The remaining Chromium time is being traced in the JS-modules thread (records and timing scripts in the project files).

## 2026.11.01.1059 · 2026-11-01

### Quick
applyStyle(noDraw, noRestyle): the four places that build a scene and then call setScene (makeScene, scheduleScene, settleTurn, showLayout) pass noRestyle, so the renderer no longer runs restyle (a full tessellate and upload of the scene it still holds, the OLD one) right before setScene does the same for the new one. Same pixels; nothing saved changes.

### Details
Main-thread time of NFM.setV({palette}, 'look') at 100,000 items, Chromium 155, WebGL2 on SwiftShader, two runs each: treemap 4,014 / 3,887 ms to 1,202 / 1,385 ms; tree 4,152 / 4,436 to 3,277 / 3,393 ms. Canvas 2D has no restyle, so it is unchanged. Most of what remains is the scene build (netflow-scene make on 100,000 hidden dots; brief to the JS-modules thread: project files: netflow-map/d3-gap/BRIEF-instant-look-changes-2026.11.01.md) and, for tree, tessellating 100,000 curves.

### Deep
Found with a CDP profile of one palette change: bufferData was 2.7 s of 4.0 s, and the restyle and setScene timers showed two uploads per change. Node tests pass; suites Chromium 232, WebKitGTK 220, Firefox 209, 0 FAIL.

## 2026.11.01.1045 · 2026-11-01

### Quick
Pie removed from the Charts tab (owner's ask): vendor/netflow-plot.js is now JS-modules netflow-plot 2.0.0 (no pie; a pie request falls back to bars), and chartSpec turns a saved `type: 'pie'` into 'donut'. src/charts.js is now a small adapter over two vendored JS-modules copies, vendor/netflow-hierarchy.js (NetflowHierarchy: treemap, icicle, sunburst, pack, tree) and vendor/netflow-circular.js (NetflowCircular: chord, bundles), JS-modules PR 428. Same pictures; saved files load as before.

### Details
The adapter keeps the name NFMCharts and its API (VIEWS = circular then hierarchy, as before; layout and scene route by type). In Node it sets globalThis.NetflowHierarchy before loading the circular copy, so the vendored files stay byte-identical. Build lists (main page, draw worker) load both vendor files before src/charts.js. Same layouts and scenes as main 35db3f4 on 140 cases (7 views, nest auto and groups, 1 to 3,000 items, trees and graphs with loops).

### Deep
Node: charts 925, plot 314 (the pie case moved to donut), all others pass. Suites Chromium 232, WebKitGTK 220, Firefox 209, 0 FAIL (the browser chart check now draws a donut instead of a pie).

## 2026.11.01.1003 · 2026-11-01

### Quick
Same PR as 0254 (PR 137, not merged yet). New view setting `chordOrder` ('fast' default per the owner's card, 'fewest'; fixLook checks it, old saves get 'fast'). src/plot.js is replaced by vendor/netflow-plot.js (JS-modules netflow-plot 1.0.0, global `NetflowPlot`); vendor/netflow-scene.js moves to 1.3.3 (SVG export groups same-look dots, same pixels). Same pictures in every view; saved files and layouts load as before.

### Details
Nested views: hierarchy() is one pass over a single Int32Array (parent, item, depth) with lazy kid lists; mapGraph hands nested views link item numbers (`eA`/`eB`, opts.ix) so no id Map is built; Buchheim keeps flat thread/ancestor/number lists and no post-order array; tree skips sums; temporaries come from grow-only scratch lists (up to 20,000 items) because a new typed array costs 3.5 to 12 us in Chromium. gnode starts `w`/`h` at -0, not 0: Smi fields later written with doubles deprecated the map and made the next view 2.5x slower. Chord: the weighted crossing count buckets bands by near end (two counting sorts) and stops once past the best so far; cos/sin come from a table of K places; a round that repeats the order ends the search. From 121 bands (K up to 1,024) the count is an exact weighted 2D Fenwick count from the JS-modules thread: heaviest band first, each band adds its weight times the heavier bands it crosses; browser A/B 0.27 to 0.63 of the bucketed count's chord time at 60 and 200 items, same output on 600 random maps. Same arcs, bands and crossings as before on 600 random maps.
Browser race (clean page, early-stop A/B, project files: netflow-map/d3-gap/RACE-VS-D3-HIERARCHY-2026.11.01.md): against d3-hierarchy 3.1.2, ahead on 35 of 36 cases (0.29 to 0.98); WebKitGTK icicle at 1,000 items 1.03 (0.86 to 1.20, a tie). Against d3-chord 3.0.1 (d3 builds its matrix from the rows): Fastest 0.3 to 1.0 of d3's time, Fewest crossings 3.5 to 15x d3's time with 53%, 16% and 3% fewer crossings at 20, 60 and 200 items.

### Deep
The order search keeps 24 rounds: on 300 random maps the best order was still found in rounds 22 and 23 for 52 of them, so a shorter search would change pictures. An O(m log^2 K) count with a 2D Fenwick tree costs more than the bucketed count at the sizes chord uses (at most 3,000 bands); a branch-free inner loop gained under 5%. Node tests: charts 925 (new: Fewest never crosses more than Fastest, bucketed count equals a plain pair count on 40 maps), plot 328. Suites Chromium 232, WebKitGTK 220, Firefox 209, 0 FAIL.

## 2026.11.01.0254 · 2026-11-01

### Quick
New src/charts.js (NFMCharts): layouts for treemap (squarified), icicle and sunburst (partition), circle packing (front-chain packSiblings plus Welzl enclose), tidy tree (Buchheim, non-recursive), bundled links (Holten, beta 0.85, B-spline to Bezier) and chord (sparse flows, arc order by circular barycenter with weighted crossings up to 3,000 bands). src/engine.js adds them to VIEWS and builds them through `NFMCharts.layout`; src/scene-alias.js sends a layout with `L.chart` to `NFMCharts.scene`. New src/plot.js (NFMPlot, 23 chart types) and src/app/38-charts.js (the Charts tab, spec saved in `S.V.chart`). New view settings `chordBy`, `nest`, `treeShape` (defaults auto, auto, tidy; fixLook checks them). Saved files and layouts load as before; old saves get the defaults.

### Details
Hierarchy source: links when they form a forest (BFS from the start item), else groups when there are two or more, else a parent column imported as parent-to-child links. Chord uses groups above 60 items when Arcs for is Auto. Browser race against d3-hierarchy 3.1.2 (early-stop A/B, project files: netflow-map/d3-gap/RACE-VS-D3-HIERARCHY-2026.11.01.md): faster on all four at 100,000 items in Chromium 155, Firefox 158 and WebKitGTK 2.52.6 (ratios 0.38 to 0.87); Firefox faster at every size; in Chromium and WebKitGTK icicle and tree trail at 1,000 items (1.17 to 1.61) and are about level at 10,000. `hierarchy()` builds everything in one pass into typed lists (boxes numbered parents first, so `order` is 0..N-1), leaves share one frozen empty child list, two-child sorts are a swap, and temporary lists come from per-slot scratch buffers (`tmpI`/`tmpF`, up to 20,000 items, at most about 2 MB held): a new typed list costs 3 to 12 microseconds in Chromium and a layout made about 30. The Charts tab draws with the map renderer (WebGL2, Canvas2D fallback); the scene starts from `NetflowScene.make` on an empty network so the link store and pick grid exist. Label angles are kept in radians in both modules and turned into the renderer's degrees on the way in.

### Deep
test/charts.test.js (805 checks): treemap leaves never overlap, pack circles never overlap and sit inside their parent, partition children fit their parent, tidy-tree rows at least 26 px apart with parents centered, chord totals match, three equal circles enclose at 1 + 2/sqrt(3). test/plot.test.js (328 checks): every type at 0, 1, 7 and 2,000 rows and with missing columns draws only finite shapes and labels, the pointer finds bars and wedges, ticks, density and normal quantiles are right. It found that the big-scatter pointer lookup used `S.grid`, which the scene module uses for its pick grid; renamed `S.plotGrid`. A style rule `.charts canvas` from the Check tab hid the chart canvas behind an opaque one; the tab's grid class is `.cht`. Browser suites: Chromium 232 ok, WebKitGTK 220 ok, Firefox 209 ok, 0 FAIL (new: every view including the seven new ones draws, and six Charts tab types draw shapes in each renderer). The Charts tab picks link rows until Rows is set by hand when only the links have number columns (a flat table comes in as links). A renderer that cannot start falls back to Canvas2D.
## 2026.11.01.0219 · 2026-11-01

### Quick
Vendored netflow-layers 1.9.0 (JS-modules PR 423, 1fc6cad; file from 67147f4, byte-identical to JS-modules main). Same-picture speedups (no third layout for both row choices, stop-number link lists, single-key row sort without lanes, the wasm order search skips unchanged rows) and better: true deepens from both starts and keeps the fewer crossings. No saved file, layout or setting changes.

### Details
Picture check: Flow, top-down, spine and lanes on 48 story and DAG maps (20 to 1,200 items): node positions identical on all 192. Early-stop A/B, one page with both engines, Flow plus top-down builds of a 400 and a 1,200-item story: Chromium 155 0.961 (0.862-1.007) at 400, 0.853 and 0.810 at 1,200; Firefox 158 0.953 at 400, 0.861 at 1,200; WebKitGTK 2.52.6 1.000 (0.905-1.044) at 400, 0.923 and 0.947 at 1,200.

### Deep
First runs flagged WebKitGTK 1,200 as 1.26 slower and Chromium 1,200 as inconclusive (1.027); each was rerun with both load orders and came out level or faster, so the first runs read as noise. Node tests pass; browser suites Chromium 219 ok, WebKitGTK 207 ok, Firefox 196 ok, 0 FAIL.

## 2026.11.01.0154 · 2026-11-01

### Quick
src/app/00-core.js `applyTheme()` rebuilds the scene only when the Map tab shows; otherwise it sets `S.themeStale`. New `freshTheme()` rebuilds on `TAB_HOOKS.map` (30-map.js) and in `withMap()` before an export reads the scene (70-export.js). No saved files, layouts or settings change.

### Details
Round 39 (research thread, patch theme-hidden-map.patch). Time to two frames after the theme click on the Advanced tab, ratio new/old (early-stop A/B, 4 rounds): Chromium 155 0.107 at 5,000 items, 0.033 at 20,000; Firefox 158 0.031 at 5,000; WebKitGTK 2.52.6 0.684 at 5,000. Picture after Advanced > theme > Map: 99.92% of pixels equal in Chromium (the unchanged on-Map path gives 99.82% in the same test, so the gap is test noise).

### Deep
Browser suites in this build: Chromium 219 ok, WebKitGTK 207 ok, Firefox 196 ok, 0 FAIL. Not done: the theme click while the Map shows still runs a full makeScene (60-175 ms at 20,000 items); a recolor-only path is round 39 candidate 2.

## 2026.11.01.0017 · 2026-11-01

### Quick
src/engine.js `build()`: with Crossing search Auto, 'Untangle harder' off and fewer than `BOTH_UNTANGLE` (500) boxes, the layered views (Flow, top-down, spine, lanes, also each wrapped run) lay out twice through `lay()`: as set, and with `better: true` on shallow copies of the boxes and links; the fewer crossings wins, and when the harder run wins the map takes the copies (`G.nodes`/`G.edges`). `o.untangleBoth === false` turns it off (tests), as do Deeper or Lighter chosen by hand and `deep: false`. the owner's card 2026.11.01 12:08 AM ET, "Try both under 500 boxes". Pictures change on small maps (only ever fewer crossings). No saved file is affected.

### Details
Comparison data, Chromium, crossings as drawn: 400 items 5,351 to 4,663 (dagre 5,374, ELK 5,313), 200 items 1,303 to 969 (1,746, 1,338). 40 imported tables under 500 boxes: harder untangling alone drew fewer crossings on 19 and more on 15 (it is not never-worse together with the deep search; reported to the JS-modules thread); keeping the better of the two, 3.7% fewer crossings overall. Early-stop A/B, Flow (main vs this): 200 items Chromium 2.00 (20.5 to 39.2 ms), Firefox 1.84 (20.3 to 38.3), WebKitGTK 2.00 (22 to 43.3); 400 items Chromium 2.71 (31.1 to 82.5), Firefox 2.53 (37 to 91), WebKitGTK 2.35 (36.7 to 85.7). An earlier version ran the winning harder layout again on the map itself (up to 4 times as long); taking the copies avoids that.

### Deep
test/topdown.test.js: on 15 story drawings Auto's crossings equal the smaller of plain and harder; on 6 imported tables the drawing is exactly the winner's (boxes, labels, values, link points, size, crossings), with the harder run winning at least once; Deeper chosen by hand is unchanged.

## 2026.11.01.0011 · 2026-11-01

### Quick
Vendored netflow-layers 1.8.0 (JS-modules PR 411, ee09017, byte-identical to JS-modules main): the lighter search (deep left out) stops after 4 rounds with no gain instead of 2. the owner picked the tidier option on the JS-modules card. Auto keeps its 800-box switch. No saved file is affected. tools/build.mjs: the build stamp now writes month and day with two digits (2026.11.01.0011, not 2026.11.1.0011), as CHANGELOG.md and the commit hook (tools/hooks/commit-msg) already expect.

### Details
JS-modules: the lighter search now matches deep: true on all 55 layered() inputs captured from this engine (7 used to trail by 2-7%) and on the vs-libs 400 and 1,000 maps. Flow, comparison data, early-stop A/B (2026.10.31.2339 vs this): 400 items Chromium ok 0.96, Firefox ok 0.96, WebKitGTK 33.0 vs 33.7 ms (inconclusive); 1,000 items slower, Chromium 1.52 (74.7 to 116.8 ms), Firefox 1.52 (83.3 to 126), WebKitGTK 1.51 (83.3 to 125), the trade-off chosen on the card; that is level with the deep search before build 2026.10.31.2339 (115 / 122 / 123 ms). Same 21,812 crossings at 1,000 items.

### Deep
Auto could leave deep out at every size now (the lighter search gives the deep pictures and is quicker at 400 items in the JS-modules cloud runs, 34 vs 44 ms), but in these runs 400 items was level, so the switch stays at 800. Node tests and three-browser suites pass.

## 2026.10.31.2339 · 2026-10-31

### Quick
Vendored netflow-layers 1.7.2 (the 1.7.0 search from JS-modules PR 375, plus Uint8Array.fromBase64 at start and Latin-1 escapes; byte-identical to JS-modules main ae1b730). New view setting `search` ('auto' default, 'deep', 'lite'; src/app/00-core.js, 30-map.js, 35-rail.js "Crossing search", the owner 2026.10.31 11:17 PM ET: "the two types of searches should be options but default should be auto selected by the app"). src/engine.js: `deepOpt` is deep: true for 'deep' or under `SEARCH_AUTO_LITE` (800) boxes, left out (the module's lighter search) for 'lite' or from 800 boxes; `o.deep === false` still turns it off; with the lighter search `rows` is passed as 'route' when the user picked Shortest route (1.7.0 reads a left-out rows as 'best'). Arc, matrix and the plain Sankey layout pass `deep: false, rows: 'route'` to keep their pictures. Saved views without `search` use Auto. No saved file is affected.

### Details
Flow, comparison data, early-stop A/B (main vs this): 1,000 items Chromium faster 0.63 (114.8 to 73.5 ms), Firefox 0.72 (121.7 to 85.3), WebKitGTK 0.70 (123 to 86.3), same 21,812 crossings; 400 items Chromium ok 0.94, Firefox ok 1.01, WebKitGTK 35.3 vs 35.7 ms (inconclusive after 12 rounds), same picture. Deep vs lighter on 47 maps (40 imported tables, 60-600 rows, and 7 generated): lighter drew more crossings on 8 (0.1 to 7.1%), all at 700 boxes or fewer but one (dag 1,500, 0.1%); comparison data 1,500 items 298 to 182 ms, same crossings. Laptop round 3 item 6 compared the module's new default with its old one without any deep search (400 items 7.4 to 36.9 ms in Chromium); Netflow Map already ran the deep search, so it is not slowed.

### Deep
Test tables and script for the JS-modules thread: project files: netflow-map/lighter-search-tables/. test/topdown.test.js: Auto draws exactly the Deeper picture under 800 boxes and the Lighter one from 800 (2,408-box map), and Lighter keeps rows 'route'. All fingerprint tests unchanged.

## 2026.10.31.2310 · 2026-10-31

### Quick
src/engine.js: `mapGraph()` looks for runs (items in a single line) only when `opts.fold` is on (nothing reads `G.runs` otherwise: the Sankey, matrix, network and shape views, or folding off). `build()`: the group of each box and its depth total in one pass (no `Object.keys(cls)`, no Set), and `laneOfBox` only for the lanes and top-down views. Same output; nothing saved is affected.

### Details
Sankey build piece by piece at 1,500 items in WebKitGTK, per build (src/engine-t.js marks, not committed): SK.layout 7.4 ms, SK.apply 0.6; engine pieces prepare 0.6, importance 0.9, flow 0.95, mapGraph 1.2 to 0.7, node channels 0.7, lane groups 1.4 to 0.6, sankeyLite 0.3, kinds 0.4, rest 0.2. Early-stop A/B of the whole build (main vs this): 1,500 items, Chromium faster 0.90 (10.32 to 9.28 ms), Firefox faster 0.93 (11.0 to 10.2), WebKitGTK ok 0.99 (12.0 to 11.4); 400 items (25 builds a sample), Chromium ok 0.89, Firefox faster 0.91, WebKitGTK ok 0.87 (a 5-build run said slower 1.12 at 4.4 vs 4.8 ms, WebKitGTK's timer steps by 1 ms).

### Deep
Sent the breakdown to the JS-modules thread: about 6 of WebKitGTK's 13.7 ms Sankey build is outside netflow-sankey. Node tests (fingerprints, Sankey same bars and bands) and three-browser suites pass.

## 2026.10.31.2257 · 2026-10-31

### Quick
tools/build.mjs: esbuild runs with `charset: 'ascii'` (JS and CSS), and `hiEsc` writes what esbuild leaves above U+00FF (it keeps regular expressions as written) as `\uXXXX`, one per UTF-16 unit. The build fails when the finished index.html still holds any character above U+00FF (the readable build without esbuild only warns). Same program and look; nothing saved is affected.

### Details
From research round 33 (js-modules-research/breakthroughs-2026.10.31/round33-two-byte-source/ROUND33-2026.10.31.md): one character above U+00FF makes Chromium keep the whole page text, and each script in it, at 2 bytes a character. Netflow Map had 30, all in scripts (regular expressions in src/importers.js and the app: U+0300-036F, U+0400-04FF, U+4E00-9FFF, U+200B-200D, U+2060, U+FEFF, U+FFFD, U+202F, U+20AC, arrows and bullets; plus 6 in app.css). Chromium renderer memory 4 s after load 34.4 to 31.3 MB, load 160 to 133 ms, ready A/B 0.923; Firefox 0.97 and WebKitGTK 1.00 (research A/B). Escaping only the main script saved 0.86 MB and only the worker sources 0.56 MB; the whole file at once 3.32 MB.

### Deep
Built page: 0 characters above U+00FF (was 30). Escapes in regular expressions keep their meaning with or without the u flag (a surrogate pair as two escapes is one code point under u). The deflated LFC-pack source block is base64 and was already Latin-1.

## 2026.10.31.2253 · 2026-10-31

### Quick
src/undo.js `step()`: a change that leaves one list untouched (`held() === 0`) keeps a difference whatever its size, so the step holds only the changed list and Undo's 16 MB budget (`undoCap`, which counts a whole map at 150 bytes an item) is not spent on the untouched one. Nothing saved is affected. From the memory-compression brief (BRIEF-netflow-undo.md, the owner's card "Both: Netflow + Story"); the brief's packing part is on a card (trade-off below).

### Details
25 changes to every item, 3,000-row map, Chromium, forced GC: 9 steps in 2.1 MB to 25 steps in 4.0 MB. Page held per change, early-stop A/B, main vs this: 3,000 rows, Chromium faster 0.81, Firefox ok 0.82, WebKitGTK 30 vs 30 ms (solo rerun).

### Deep
Tried alone and stacked with packing whole-map steps from 2,000 items and links (was 20,000). Packing alone on item-only changes: Chromium and WebKitGTK the same, Firefox 18 vs 22 ms (maybe slower). Stacked, changes to every item and link: 9 steps in 8.8 MB to 25 steps in 3.6 MB, page held the same (Chromium 20 vs 20, Firefox 21 vs 21, WebKitGTK 35 vs 32 ms), but undoing such a change takes longer: Chromium 17/25/13 to 38/35/28 ms, Firefox 18/21/17 to 33/29/41, WebKitGTK 33/28/25 to 48/47/44 (with the reader warmed while idle; 61-85 ms for the first undo without that). The brief's shared pack for the save was measured and not used: JSON.stringify of a 3,000-row map is 3.2 / 3 / 2 ms (Chromium / Firefox / WebKitGTK), while handing it to a thread costs 4.1 / 5 / 16 ms (postMessage) and structuredClone 12 / 8 / 16 ms. The brief's baseline (a structuredClone per edit) is not what Netflow does: undo keeps only changed objects (src/undo.js step). test/undo.test.js: every-item and every-link changes keep only the changed list.

## 2026.10.31.2214 · 2026-10-31

### Quick
Vendored netflow-sankey 2.4.0 (JS-modules PR 374, commit 6ed23fd, byte-identical to JS-modules main; stand-in stops and per-bar numbers in typed arrays, same picture on 669 maps; new option `stopCap`/`stopCapFrom`, off in the module). src/engine.js passes `stopCap: 500` (or `o.skStopCap`) to the Sankey layout; the module applies it only to maps of 1,000+ items (`stopCapFrom`). the owner's card 2026.10.31 9:08 PM ET: "Cap at 500 stops". Pictures change for Sankeys of 1,000+ items only; nothing saved is affected.

### Details
Whole build at 1,500 items, cloud, median of 3 (no cap / cap 2,000 / cap 500 / d3-sankey): Chromium 26.6 / 14.5 / 11.8 / 27-43 ms, Firefox 23 / 15 / 12 / 23-27 ms, WebKitGTK 35 / 20 / 13 / 25-30 ms. 5,000 items: Chromium 81 / 54 / 53 / 102-114, Firefox 79 / 51 / 44 / 107-109, WebKitGTK 90 / 67 / 53 / 106-121. Band pieces passing over a bar they do not belong to, 1,500 items: 0 / 276 / 256 / 1,916; 5,000 items: 537 / 761 / 798 / 8,410.

### Deep
At 1,500 items the layout made about 9,000 stand-in stops and 10,600 bands; the order search (about 4 ms) and scale + relax (about 4 ms) are now its largest parts. New bench metric `overBars` (bench/vs-libs.js) and plan `cap` (bench/vs-libs-run.js; CAPN=n runs one size). Comparison pictures: project files: netflow-map/vs-libs-2026.10.31/sankey-long-links-2026.10.31.html. New test: the cap leaves maps under 1,000 items byte-identical.

## 2026.10.31.2205 · 2026-10-31

### Quick
src/columns.js: `profileUpdate` keeps a column's samples exact for a changed value anywhere (`sampIn`/`sampOut`: first three different values in item order, with where each first came), so a column with under three different values, or a change at or before its third sample, is no longer read again whole; only a value taken out where it first came still is. New `isStoryOf(g, prof)` reads the outcome-mark column's counts (unless it has 400+ different values). src/app/00-core.js: `indexGraph` keeps `IDX.ghosts` (placeholder count) for changed items; `renderReport` reads it. `profileUpdate.redone` counts columns read again (for tests). Nothing saved is affected.

### Details
Page held after one rename, 16 MB table (188,000 items), Data tab, early-stop A/B: Chromium 29 to 11 ms (faster 0.42, noisy), Firefox 29 to 5 ms (faster 0.22), WebKitGTK 27 to 14 ms (faster 0.51, noisy). 3,000 rows: Chromium faster 0.78, Firefox ok 0.87 (a parallel run said slower 1.87 at 3 vs 7 ms, noisy; the solo rerun is ok), WebKitGTK faster 0.54. Chromium profile of two renames: indexGraph 51 ms to under 2 (the generated table's labels all equal the ids, so the label column had no samples and was read again on every change, about 17 ms; isStory 8 ms); renderReport 23 to 10 ms (the placeholder filter was about 8 ms).

### Deep
test/profile-update.test.js: 600 edits among the first eight items (values moving into, within and out of the samples) all equal the full profile; renames in a map whose labels are all unused plus a two-value flag column read no column again; the story check from the profile agrees with a pass over the items through every random edit. Browser index block: placeholder and outcome-mark steps take the quick path, and `indexMatches()` also checks the placeholder count and the story flag. Still per change on that table: one list compare (about 5 ms, src/undo.js scan) and the save's size sampling (about 4 ms, debounced).

## 2026.10.31.2045 · 2026-10-31

### Quick
src/engine.js: `absorb()` sweeps in reverse topological order (`topoBack(P)`, Kahn) when the links hold no loop (no self-link either) and stops after that one exact sweep; with a loop it keeps the deepest-first order and sweeps until it settles. `endClasses()` hands its flow spread to `absorb()` (`o.spreadDone`, same cap) instead of `absorb()` running it again, and uses the same zero-weight guard as `absorb()`. Builds are byte-identical (JSON) on 10 test builds (loop-free and with loops, Sankey and odds coloring). bench/vs-libs.js times only `E.build` (the derived map is made once outside the timer; build does not change its input). test/browser.test.js: the dying-worker check waits up to 2 s for the engine to be free (failed twice in Firefox in parallel runs, never alone).

### Details
Sankey build at 1,500 items, warm, the flow step (endClasses + absorb): Chromium 2.65 to 0.89 ms, Firefox 2.43 to 0.82 ms, WebKitGTK 2.05 to 0.83 ms. The Sankey layout module (netflow-sankey) is about 75% of the build: 21-24 ms; its stand-in stops (about 9,000) and bands (10,600) set the floor (JS-modules is working on it).

### Deep
With 9 end classes (maps that are not stories, more than 8 ends) each sweep costs 9 multiply-adds per link; the deepest-first order is BFS depth, not a topological order, so it needed several sweeps plus a check sweep.

## 2026.10.31.2031 · 2026-10-31

### Quick
`edit(fn)` (src/app/00-core.js) copies `nodes` and `edges` only when fn first reads or sets them (getter/setter on the working object, then a plain object again before `setGraph`). An item-only change keeps the very same link list, so the per-change list compare skips it. `NFM.edit` is exposed for tests. Nothing saved is affected.

### Details
Page held after one rename, 16 MB table, Data tab, early-stop A/B: Chromium 36 to 28 ms, Firefox 35 to 23 ms (faster 0.66, noisy), WebKitGTK 27 to 14 ms (faster 0.50). 3,000-row map: Chromium faster 0.79, Firefox ok 0.77, WebKitGTK ok 0.83. Copying 563,000 links cost 1 ms in Chromium and 11 ms in WebKitGTK; comparing them 7 and 15 ms.

### Deep
Browser test (index block) checks items-only, links-only, set and undo through `NFM.edit`. Started by the previous Netflow owner thread (WIP 461e943), finished here.

## 2026.10.31.2021 · 2026-10-31

### Quick
Vendored netflow-layers 1.6.0 and netflow-sankey 2.3.3 (JS-modules PR 367, byte-identical to JS-modules main). src/engine.js: layered views pass `deep: true` unless `o.deep === false`, and `rows: 'best'` is accepted; the app's Rows setting gains Fewest crossings (`rows: 'best'`, new default in src/app/00-core.js; saved views keep their choice). The Sankey view with netflow-sankey (`o.sk`) no longer runs `layered()` first: `sankeyLite(G)` hands the graph straight over and `sankeyLiteKinds` sets link kinds and info counts from the Sankey's own columns (`o.skLite === false` brings back the old path, which now uses `orderRounds: 0`). Pictures change in Flow, top-down, spine and lanes (fewer crossings); the Sankey picture (bars, bands, loops, size) is the same. No saved file is affected. Also in this build (PR 123, the owner's card 'Link weights plus a note'): a Sankey whose start has no links out (no non-self flow over 1e-12, no amounts) uses edge weight / max weight as flow and max(in, out) / max as visits, sets `Lr.weightsFallback`, and src/app/35-rail.js shows a note in Why this view; test 'Sankey with a dead-end start draws the link weights instead of one empty column'.

### Details
vs-libs dag data, links crossing as drawn, same in all three browsers: 200 items 1,919 to 1,303; 400 items 7,956 to 5,351 (dagre 5,374, ELK 5,313); 1,000 items 31,870 to 21,812 (dagre 23,965, ELK 22,602); 1,500 items 67,493 to 45,648. Time with deep + best, Chromium / Firefox / WebKitGTK: 1,000 items 129 / 135 / 131 ms (was 22 / 23 / 21), 1,500 items 336 / 359 / 341 ms. Sankey 1,500 items, median of 5 (old path / orderRounds 0 / no layered): Chromium 33.9 / 36.5 / 31.6 ms, Firefox 36 / 34 / 29, WebKitGTK 39 / 40 / 28; d3-sankey 24-27 ms. Info counts in the Sankey now describe its drawn columns (1,500 items: 54 columns, 152 back links; the layered rows said 1 column, 645).

### Deep
Each tried alone and stacked (bench plans `deep` and `sk`, results in bench/results/vs-libs-*-deep.jsonl and -sk.jsonl). `rows: 'best'` alone changes nothing below about 1,000 items on this data; deep alone gets level with dagre and ELK; stacked beats both at 1,000 items. `rows: 'best'` runs layered() up to 3 times (route, story on copies, the winner again), which is most of its cost; reported to JS-modules. netflow-sankey reads only nodes, edges (from, to, flow, kind 'self') and pos, and does its own layering and order (found by the JS-modules thread). New tests in test/topdown.test.js: the deeper search never adds crossings (6 maps, 3 views), and the Sankey without layered() keeps the same bars, bands, loops and columns (4 maps). The fingerprint test now pins `deep: false`.

## 2026.10.31.1948 · 2026-10-31

### Quick
`parseDelimited` (src/importers.js) cuts a line with no quote by reading its characters (`charCodeAt` against the delimiter, `slice` per field) instead of `text.slice(line).split(d)`. Same rows, cell for cell; a delimiter longer than one character still uses `split`. No saved file, layout or setting is affected. New benchmark-only harness bench/vs-libs.js + bench/vs-libs-run.js (Netflow Map against d3-force, ForceAtlas2, Cytoscape.js, dagre, ELK, d3-sankey, Papa Parse, d3-dsv, graphology); bench/page.html loads pack, graph-walk, netflow-sankey and netflow-layers before the engine again.

### Details
16 MB table (`NFMGen.csv('moderate', 188000, 3)`), early-stop A/B rule, fresh page per sample: WebKitGTK 2.52.6 390 to 119 ms (faster 0.29), Chromium 155 229 to 167 ms (faster 0.73; first run 0.80 flagged noisy, rerun clean), Firefox 158 230 to 242 ms (ok 0.985, 0.956 to 1.03). Row hash identical. Variants tried in all three browsers (one page, 4 rotated turns): whole-text split, line slice + split, indexOf per field on the text, indexOf per field on the line slice, character scan; WebKitGTK's `String.prototype.split` was the cost (372 ms against 86 for the character scan).

### Deep
Found by the new library comparison (landing page): Netflow Map was 575 ms against Papa Parse 211 and d3-dsv 326 in WebKitGTK while fastest in Chromium and Firefox. Papa Parse also scans with indexOf/charCodeAt. The quoted-line path was already a character scan and is unchanged. Memory in the comparison is read over the DevTools protocol (`Runtime.getHeapUsage` after two `HeapProfiler.collectGarbage`): `performance.memory` gave negative or zero differences even with --enable-precise-memory-info.

## 2026.10.31.1830 · 2026-10-31

### Quick
Three per-change costs on big tables, all exact (no saved file, layout or setting is affected). src/undo.js `listDiff` keeps its last answers until the current script ends (a microtask clears them) and answers the same pair, or the same pair turned round, from them: one change asked for the same difference three times (`NFMUndo.step`, the item index's `changedSlots`, the engine hand-over's `graphDiff`). The link lists (src/app/00-core.js `makeLinkLists`) gain `none()`, the count of items with no link, read from the offsets; the Data tab report uses it instead of `has(id)` per item. `NFMColumns.pairsRepeat` is split out of `suggestStates` (which takes it as an optional third argument), and the States card keeps its answer per link list object in a WeakMap.

### Details
`listDiff` keeps up to 4 answers with both lists and their lengths; a turned-round answer has the same common start, end and changed slots, with the kept values read from the other list (`flip`). Nothing is kept past the script, so no old list is held. `none()` returns -1 when two items share an id (then the report counts with `has` as before). The repeated-pairs check reads only `from` and `to` of the first 50,000 links; the link lists are kept by the item index only when every link keeps its two ends, so a kept list object means the same answer. `indexMatches` (used by the index browser check) now also compares `none()` and the kept repeated-pairs answer with fresh ones. test/undo.test.js: kept and turned-round answers match fresh ones (scattered slots, half changed, an insert, a cut, both ways, values by reference), and are let go after the script.

### Deep
Chromium CPU profile, two renames on a 16 MB table (188,000 rows, Data tab), readable build: setGraph inclusive 340 to 95 ms; renderReport 110 to 18 (the `has` lookups were 86); renderStatesCard 78 to under 1 (suggestStates' 50,000 joined keys); listDiff 88 to 31 (6 scans to 2). Early-stop A/B rule, page held (heartbeat gaps over 50 ms plus the synchronous change) in the 2.5 s after one rename, 800 by 600 window: Chromium 138 to 42 ms (faster 0.32, 0.16 to 0.69; flagged noisy in both runs, the first 148 to 38, 0.24), Firefox 82 to 22 ms (faster 0.24, 0.21 to 0.28), WebKitGTK 131 to 37 ms (faster 0.25, 0.22 to 0.28). Small map (1,500 rows, 6,003 items and links, 20 changes, synchronous time): Chromium faster 0.69 (0.50 to 0.92), Firefox 0.37 (0.33 to 0.47), WebKitGTK 0.43 (0.16 to 0.58), all flagged noisy with every interval under 1. Left per change on the 16 MB table (Chromium profile): the column profile update about 15 ms, one list scan about 15 ms, isStory about 5 ms.

## 2026.10.31.1815 · 2026-10-31

### Quick
`NFMColumns.fmt`, `fmtFull` and the new `NFMColumns.nf` (used by `nfmt` in src/app/00-core.js), and `nf` in src/check.js, use kept `Intl.NumberFormat('en-US')` objects instead of `toLocaleString('en-US', …)` on every call. Same text (the language defines toLocaleString as `new Intl.NumberFormat(locale, options).format`). From Story Editor's finding (a kept Intl.Collator) and JS-modules netflow-engine 2.2.3. vendor/netflow-scene.js already calls `NFMColumns.fmt`, so its labels get it too. Test fix: "zoom eases toward its target" waits for 3 equal zoom samples in a row (it stopped mid-easing once in WebKitGTK in a three-at-once run).

### Details
Per call, bare page: `toLocaleString('en-US')` Chromium 13.9 µs, Firefox 0.45, WebKitGTK 36.2; kept formatter 0.6 / 0.35 / 0.5. With `maximumFractionDigits: 3`: 25.5 / 17.3 / 38.7 against 1.05 / 0.4 / 0.7. Text compared: 200,000 random numbers in Node and 10,000 per browser through the page, no difference.

### Deep
Early-stop A/B rule, 5,000 `fmt` plus 5,000 `fmtFull` calls on the page: Chromium 171.7 to 10.3 ms (faster 0.05), Firefox 78 to 4 ms (0.05), WebKitGTK 261 to 11 ms (0.05). Other `toLocaleString` uses left as they are: tune and probe messages (a few per run), the engine's chapter labels (one per chapter), and probe.js, which uses the default locale on purpose.

## Tests only · 2026-10-31 (no new build, after 2026.10.31.1750)

### Quick
bench/webkit-driver.js: when WebKitWebDriver does not start, the error now says whether it ended (and its exit code) and its last error lines, and `launch` tries once more on a new port, printing a `note:` line. Twice in Netflow's three-browsers-at-once trial (runs 5 and 7 of 8) the driver never answered while Chromium and Firefox were starting; WebKitGTK alone always started.

### Details
The driver's stderr is kept (last 600 characters; the harmless dbus "Failed to set fd limit" line is left out of the message). A launch with a fixed `port` is not retried. A bare start of the driver with the two other suites running took 0.16 to 0.18 s (idle: 0.16 s), so the failures are not from load. Trial log: project files: netflow-map/qa-parallel-log.md.

## 2026.10.31.1750 · 2026-10-31

### Quick
Saved map: `nfm-graph` is kept in IndexedDB only (`netflow-map-saves`, store `s`), with a marker `nfm-graph-at` (`{seq, size}`) in localStorage. View settings and preferences stay in localStorage plus the IndexedDB copy. A map saved as text in localStorage by an older build (or left there by a page that closed mid-save) is read as before and moved over at start. Without IndexedDB the map stays in localStorage, as before. From research round 22; stacked with round 19's fix 3 (the early stop for big maps, shipped in 2026.10.31.1410). Netflow's own start with a big saved map is about 20 ms later in Firefox and WebKitGTK (on a card).

### Details
src/app/00-core.js `SAFE`: `set` for a BIG key writes the marker, puts the text, and once the put completes removes any localStorage text with the same or an older save number; a refused put writes localStorage as before. While the page goes away (`flushSaves` sets `SAFE.going`), a map save, and any map save still on its way to IndexedDB, is also written to localStorage as text (an IndexedDB write may not finish then); the next start moves it over. `read`, `adopt`, `ready`, `going`, `has` are new; `repair` of the map writes only the marker. Under TWIN (a second tab) nothing is written, IndexedDB included (before, the IndexedDB copy was still written). src/index.template.html: a small script in the page head starts the IndexedDB read of the map before the app's scripts load (`NFM_EARLY`); src/app/99-boot.js waits for it (or reads it) and runs the rest of the start after; the "newer safe copy" check runs only for a map read from localStorage. Tests: the crash-safe check now checks that the map is in IndexedDB only with a matching marker, and runs the lost-save case on a view key.

### Deep
Lab, 800 by 600 window, early-stop A/B rule (after / before, 90% interval). Page held through 5 saves of a 1.79 M character map and their IndexedDB writes (heartbeat): Chromium 78 to 4 ms (faster 0.04, 0.01 to 0.07), Firefox 37 to 4 ms (faster 0.24, 0.17 to 0.57), WebKitGTK 524 to 519 ms (ok 1.00, 0.99 to 1.01; its IndexedDB write of the text costs about 100 ms in both). Netflow's own start with a 6,000-item map saved (1.74 M characters), time to the first screen: reading in the boot only, Chromium ok 0.96, Firefox slower 1.30 (1.14 to 1.40), WebKitGTK slower 1.16 (1.09 to 1.33); with the read started in the page head, Chromium faster 0.84 (0.81 to 0.90; 87 to 82 ms), Firefox slower 1.33 (1.10 to 1.82), WebKitGTK slower 1.21 (1.05 to 1.39; about 20 ms later in both). localStorage held by Netflow with that map saved: 1,737,755 to 1,348 characters. Round 22 measured the other side: Pineapple Defense's first storage touch in Chromium 18.5 ms with a 1.79 M character map in the shared space against 1.2 ms without. Leaving the page right after an edit (navigation 0 ms after the change, 3 of 3), reload, and an older build's save moving over: kept in all three browsers. Kill test (the whole browser killed 2 s and 10 s after an edit, same profile): kept in Chromium and Firefox. The 1.8 M autosave limit is unchanged; raising it now that localStorage no longer bounds it would be new behavior. Tried for the Firefox and WebKitGTK start and dropped: reading the map on a helper thread (the read is done before the page's first long script ends, but in Firefox the reply still lands about 20 ms after it, no gain; in WebKitGTK the helper sees an empty database on a page opened from a file, so the map would be lost); keeping the map packed (gzip or deflate, 1.74 M characters to 122 to 125 KB: the read gets 5 to 9 ms faster but unpacking costs 7 to 12 ms on the page) or as UTF-8 bytes (decoding adds 1 to 2 ms). The wait comes from the database's replies: they can only run on the page once its first long script has finished, so when the open is not done before that script starts (about half the Firefox starts), the read takes one more round trip after it.
## 2026.10.31.1730 · 2026-10-31

### Quick
`NFMColumns.profileUpdate(prev, a, b, dn, de)` (src/columns.js) works out the column profile of graph b from a's profile for the changed item and link slots only; `indexGraph` (src/app/00-core.js) uses it when the item index took its quick way and nothing is calculated (`derive(g) === g`). Same profile, field for field and in the same order, as `profile(b)`; checked on random edits in test/profile-update.test.js.

### Details
`profile()` now also keeps, per column, an update record (in a WeakMap keyed by the profile): the capped value counts finish() reads, where the column first appeared, where its 400th different value and its third sample appeared, whether any number has a fraction, and the raw min, max and sum. An update moves each changed value out of and into its column's record. A column whose record cannot be kept exact that way is read again alone, the way `profile()` reads it: a value changed at or before where its samples or its 400 values were collected, its lowest or highest number removed, a number with a fraction (a sum done in another order could differ in the last digit), the last copy of a capped value removed, or 400 different values reached. A whole new profile is made when a column appears, leaves, or would change its place in the order, or when items or links are added or removed. Tests: test/profile-update.test.js (720 random edits of every kind on 600 and 3,000 items, chained update on update; ordinary renames, groups, outcome marks and link kinds quick and identical 100 of 100).

### Deep
CPU profile of two renames on a 16 MB table (188,000 rows, Chromium, Data tab shown): `indexGraph` 304 to 73 ms in all, the column profile 248 ms to 32 ms (the label column, which holds few values in this table, is read again alone each time). Early-stop A/B rule, page held (heartbeat gaps over 50 ms plus the change itself) in the 2.5 s after one rename, 800 by 600 window: Chromium 262 to 138 ms (faster 0.53, 0.39 to 0.55), Firefox 292 to 91 ms (faster 0.29, 0.28 to 0.41), WebKitGTK 432 to 146 ms (faster 0.37, 0.35 to 0.38). 1,500-row map: 7 to 9 ms held before and after in all three; the page time of 20 renames there is faster too (Chromium 0.84, Firefox 0.53, WebKitGTK 0.63). Also: the browser check "Canvas 2D after a pan and a zoom" no longer lets the app draw while it runs (an app redraw cancelled the settle timer it waits for; QA saw it fail once in WebKitGTK alone), and it waits up to 2 s more for a late timer; 5 of 5 runs of that block alone pass in WebKitGTK. What is left per change there: the Data tab's report (about 54 ms, Chromium) and states suggestions (about 33 ms), and the undo and slot diffs (about 43 ms).

## 2026.10.31.1645 · 2026-10-31

### Quick
Map canvas pixel ratio capped at 2 (was 2.5) in `stageSize` (src/app/30-map.js), like Pineapple Defense and Fancy Banana. The minimap was already capped at 2. From research round 27 (costs that grow with screen sharpness). A look change, on a card.

### Details
`dpr = Math.min(devicePixelRatio, 2)`; the 9 M pixel guard that steps the ratio down by 0.25 is unchanged. Only screens with a ratio above 2 change. Ratio check (qa-guide/pixel-ratio/dpr-check.js, Chromium 155, 412 by 860, 1,600-item map): ratio 1 0.66 M pixels, ratio 2 2.52 M, ratio 3 3.92 to 2.52 M. Tested in: Chromium 155, Firefox 158, WebKitGTK 2.52.6 at ratio 1 (suites); Chromium 155 at ratios 1, 2 and 3 (ratio check).

### Deep
Lab, Chromium 155, 412 by 860 window at ratio 3, 1,600-item map, early-stop A/B rule (after / before, 90% interval): busy time on all the browser's threads while panning and zooming 0.86 (0.84 to 1.00); the page's own thread alone is too noisy to call (1.05, 0.89 to 1.16; its work does not grow with pixels, the drawing threads' does). At rest the map draws nothing, so nothing changes there. Screenshots at ratio 3 with the cap off and on: 10.6% of screen pixels differ, almost all by a few levels at line and circle edges (0.0006% by more than 32 levels).

## 2026.10.31.1603 · 2026-10-31

### Quick
Approved on a card ("Pack it off the page"): the app now sets `client.keeper`, so a parked layout worker's graph is packed off the page before the worker ends, and the restart takes it from there. Invisible, same maps, nothing saved changes; a restart after a rest takes about 0.5 to 1 s longer.

### Details
src/app/75-mapfile.js: `UNDOPACK_MAIN` (the LFC-pack worker of packed undo) takes two more kinds: `keep` (the layout worker's raw graph arrives on a MessageChannel port and goes back as `packTables` bytes, meta = every field but nodes and edges) and `give` (bytes in, `unpackTables`, the graph out on a port to the fresh layout worker). `keeperCall` / `LAYOUT_KEEPER` wrap them. src/app/99-boot.js sets `client.keeper` when Worker, DecompressionStream and MessageChannel exist. The client side (park handover, unpark from the kept bytes plus a diff, fallback to the whole graph) shipped in 2026.10.31.1410. The kept-graph browser check now runs instead of skipping. The page asks the layout worker for its graph only after the keeper's thread has its end of the channel (`keep(port, posted)`), and a keep that has not ended in 20 s is given up (the restart then sends the whole graph).

### Deep
16 MB moderate table (751,563 items and links), 800 by 600 window, 3 rounds each, park then restart. Page held at restart, before / after: Chromium 642 to 762 / 9 to 20 ms, Firefox 833 to 1,177 / 8 to 18 ms, WebKitGTK 1,569 to 1,813 / 12 to 32 ms. Restart until the worker has the graph: Chromium 1.66 to 1.77 / 1.80 to 2.03 s, Firefox 1.34 to 2.01 / 2.21 to 2.32 s, WebKitGTK 2.11 to 2.60 / 2.72 to 3.20 s. Parking now holds the page 8 to 15 ms (one WebKitGTK round 125 ms; was 0 to 1 ms: the port handover), and packing on the keeper thread takes 3.2 to 4.2 s, off the page. All 3 restarts in every browser came from the kept bytes. Found in the first three-browsers-at-once run: in Firefox the keep of a small map never ended, so the next restart waited for ever (8 checks failed or timed out). The worker's graph reached the page's end of the channel before that end had moved to the keeper's thread, and Firefox appears to drop messages queued on a port that then moves (Chromium and WebKitGTK deliver them; changing the order fixed it in all three). A big map took long enough to send that the port had moved first, which is why the timing runs never saw it. Fixed by the order above; the 20 s limit makes any keep that never ends cost a whole-graph restart instead of a stuck engine.
## Tests only · 2026-10-31 (no new build)

### Quick
The browser test can run single blocks (`NFM_ONLY=4,8,index`), prints the seconds and ok lines of every block at the end, and `node test/all.js --changed` names the blocks the changed files need. The baseline guard counts "not available here" drawing notes as skipped, which removes Firefox's false failure on machines without WebGL 2. The app is unchanged.

### Details
test/browser.test.js: each block is `if (want('name')) { blk('name'); ... }`; `want` reads NFM_ONLY (a part of a block runs its whole block). Moved to the start so blocks run alone: the in-page picture keeper (`window.__px`) and section 4's blob catcher and print stand-in. Section 4 finds its SVG files by type. A partial run first draws a 60-item map and sets the drawing manager's WebGL 2 and WebGPU canaries as the backends block does. The dying-worker check waits for an idle engine first. Section 8c waits for a still picture before its byte compare. The zoom-easing check waits for the easing to stop (up to 2.5 s more) instead of reading the zoom at a fixed 700 ms, which a loaded machine missed in the first three-browsers-at-once run. The Canvas 2D pan check waits for the finished 1,500-item picture (in WebKitGTK, run alone, a scene arriving mid-check dropped the kept picture). test/baseline.js: `verdict(..., {skipped, partial})`. New test/browser-blocks.js (changed file to blocks) and test/browser-blocks.test.js. docs/QA-SPEED-GUIDE.md section 16.

### Deep
Full runs before and after print the same ok lines (Chromium 218, WebKitGTK 206, Firefox 195). Each of the 28 blocks was run alone in Chromium (all pass), and moves, pan, report, 8 and safe alone in Firefox and WebKitGTK; before the fixes 5 failed alone (moves and pan: no `__px`; section 4: a worker's code file took slot 0 of the saved-file list; report: no map built yet; section 8: drawn with Canvas 2D, where two picture checks differ by up to 6 color levels in 19,615 of 2,939,200 bytes). That last difference is kept as a lead: the full run draws section 8 with WebGL 2 in Chromium, so it never showed there. The dying-worker check failed once in a Firefox full run ("first": "resolved"): the app's own map job from the check before was still running, the simulated crash canceled that one, and the test's job then ran on the page and succeeded.

## 2026.10.31.1440 · 2026-10-31

### Quick
Invisible, same maps, nothing saved changes. `indexGraph()` (src/app/00-core.js) rebuilt `S.byId`, both link lists and the link kinds from nothing on every change; now, when a change keeps every item's place and id and every link's two ends (a rename, a group, a label, a link kind), it updates only the changed slots and keeps the link lists. `NFMColumns.num()` (src/columns.js) returns NaN at once for text whose first character can't start a number. Stacked on 2026.10.31.1410 (PR 112).

### Details
`changedSlots(a, b)` turns `NFMUndo.listDiff` into a list of changed slots (same length, a quarter or fewer changed; for the `{p, s, mid}` form it walks the middle stretch, since a single change comes back in that form, not as `at`). `IDX = {g, pos}` keeps the graph the index was built from and the id-to-slot map. The quick path needs 2,000 items or more, the same id in every changed node slot, and `S.byId.get(old.id) === old`; links are kept when neither list has loose entries and every changed link keeps `from` and `to`; kinds are worked out again unless no link changed. Anything else builds the index whole, as before. `IDX.why` says which path ran ('quick+links', 'quick', 'full', 'first', 'same'). `derive`, `profile` and `isStory` still run every change. `num()`: after trim, the first character must be a digit, `+ - . , (` or `$ € £ ¥`; every value the rest of the function accepts starts with one of these. New browser check: the index matches one built from nothing after a rename, a group, a link label, a link kind, a moved link, an id change, an add, a remove and an undo of each, with the expected path for each (`NFM.indexMatches`, `NFM.idx`).

### Deep
16 MB moderate table (188,000 items, 563,563 links), 800 by 600 window, worker awake, one-item rename, median of 5, longest freeze / page held in 3 s, all runs in one session against the 2026.10.31.1410 build. Base: Chromium 854 / 1,699 ms, Firefox 834 / 1,657, WebKitGTK 1,129 / 2,249. Index alone: 547 / 1,081, 466 / 918, 582 / 1,145. Number reader alone: 755 / 1,502, 870 / 1,723, 851 / 1,687. Both: 268 / 526, 387 / 756, 462 / 913. Together they save more than the two savings added up (Chromium: 307 + 99 = 406 ms alone, 586 ms together); why was not measured. `num()` gave the same answer as before on 400,000 random strings (digits, signs, marks, currency, spaces, letters). Early-stop A/B rule on a small map (1,500 rows, 6,003 items, 20 changes a round, after / before, 90% interval): Chromium ok 0.88 (0.78 to 1.04, noisy), Firefox faster 0.70 (0.50 to 0.74), WebKitGTK faster 0.30 (0.22 to 0.75, noisy). Left per change: `NFMColumns.profile` and `derive` over every item, and the report and states cards.

## 2026.10.31.1410 · 2026-10-31

### Quick
Invisible, same maps, same saved text. Three hidden costs on the page's own thread: (1) every `client.setGraph` structured-cloned the whole graph to the layout worker; now a difference goes when the worker has the graph before (`graphDiff`). (2) The autosave ran `JSON.stringify` on the whole graph after every change and threw it away when over 1.8 MB; now maps of 20,000 items and links or more are checked from a sample and written item by item with an early stop (`textMayFit`, `graphText`). (3) `sniff()` parsed a JSON file only to learn it is JSON and `importJSON` parsed it again; now the first parse is used.

### Details
src/engine-client.js: `graphDiff(a, b)` uses `NFMUndo.listDiff(b, a)` on both lists; under a quarter of the items differ (and 2,000 items or more) it sends `{type:'graphDiff', meta, nodes, edges, base, ver}`, and the worker rebuilds the lists with `__back` (the same as `NFMUndo.listBack`) from `__st.R`, the raw graph it now keeps beside the derived one. A worker whose version is not `base` answers `"full"` and gets the whole graph. `this.sent` / `this.sentVer` track the graph the live worker has; parking, death and the page fallback clear it. Parking can also take a keeper (`client.keeper`: `keep(port)`, `give(bytes, port)`) that packs the parked worker's graph off the page; the app does not set one in this build. src/app/00-core.js: `textMayFit` (under 20,000 items: yes; else 200 items and 200 links sampled, 1.5 times over the limit still yes), `graphText(g, max)` gives exactly `JSON.stringify(g)` or null past max. src/importers.js: `PARSED` keeps the value `sniff` parsed for `importJSON` with the same text, once. Tests: 2 new browser checks (differences reach the worker and its pictures match the page engine's, with the whole-graph fallback; the parked keeper path, skipped while no keeper is set); the "too big to keep" check now makes one item's text long, since the save no longer stringifies the whole graph when it is big.

### Deep
16 MB moderate table (188,000 items, 563,563 links), 800 by 600 window, worker awake. `client.setGraph` after a one-item rename, page time (median of 6): Chromium 1,792 to 20 ms, Firefox 1,148 to 4 ms, WebKitGTK 2,532 to 29 ms; until the worker had it: 3,082 to 24, 2,532 to 12, 3,348 to 48 ms. A whole app change (median of 5, longest freeze / page held in 3 s): Chromium 1,520 / 3,449 to 942 / 1,931 ms, Firefox 1,844 / 4,061 to 961 / 1,908, WebKitGTK 2,631 / 5,613 to 1,479 / 2,945; each alone: the difference alone 887 / 2,077 (Chromium), 890 / 2,179 (Firefox), 1,070 / 2,523 (WebKitGTK); the autosave fix alone was within the noise of whole changes, so it was timed directly: `JSON.stringify` of the 61 MB graph 392 / 373 / 430 ms against the early stop 7 / 14 / 11 ms. Early-stop A/B rule (qa-guide/ab-sequential), the autosave text of a 2,000-item map (573 KB, 50 writes a round): Chromium ok 0.97 (0.82 to 1.02), Firefox ok 1.00 (0.88 to 1.00), WebKitGTK inconclusive and noisy 1.00 (0.89 to 1.18); an A/A run of the same page gave WebKitGTK 1.03 (1.00 to 1.09). A first version wrote every map item by item and the rule caught it 1.5 to 2.2 times slower on maps that fit; a 400-item sample on every map was still 6 to 13% slower, so maps under 20,000 items now keep the single write. Opening netflow-test-map-30000.json (7.2 MB) through `NFM.ingest`, page held time in 8 s, A/B: Chromium faster 0.86 (0.84 to 0.92), Firefox ok 0.91 (0.69 to 0.98), WebKitGTK faster 0.86 (0.73 to 0.95). What is left per change is the page's own index and column profile (`indexGraph`: about 1 s per change at this size in Chromium), next. Packing the parked worker's graph off the page (the keeper) removes the restart freeze (Chromium 0.8 to 1.1 s down to 9 to 22 ms) but the first layout after a rest starts about 1 s later, so it waits for a decision.

## 2026.10.31.1200 · 2026-10-31

### Quick
Two approved changes (both new behavior, so each was on a card). Crash-safe saves: every save of the map and of its view settings also goes to IndexedDB (`netflow-map-saves`, store `s`) with `durability: 'strict'`; at start a newer copy there is brought back with a toast. Packed undo: an undo step that keeps a whole map (a file was opened, or a change replaced most of the map) of 20,000 items or more is packed with LFC-pack on a worker while the page is idle; all of Undo is held to 16 MB.

### Details
`SAFE` (src/app/00-core.js): `set(k, text)` writes localStorage, a save number `nfm-seq:<k>` and the global `nfm-seq`, then puts `{seq, text}` in IndexedDB; `del`, `repair`, and `newer(k)`, which returns the IndexedDB copy only when its number is above localStorage's. Every save and delete of `nfm-graph` and `nfm-v:<name>` goes through it (saveGraph, saveView, map-file open, import, Reset every setting). Boot (src/app/99-boot.js) checks the graph and the view of the graph it will show, and brings them back only when nothing has changed since start. Packed undo (src/app/75-mapfile.js): `undoPackSoon` packs `{meta, nodes, links}` (meta = every other field of the graph) with `LfcPack.packTables` on a worker made from the page's LFC-pack text and ended 30 s after its last job; `undo()` unpacks it (`undoBusy` keeps a second press from running meanwhile); `undoCap` drops the oldest steps past 16 MB, counting a packed step by its bytes. Tests: 2 new browser checks (a packed step comes back exactly; a save lost from localStorage is found in the safe copy and put back).

### Deep
Chromium 155, the real app, 800 by 600 window, main-page heap after 3 full garbage collections, 16 MB table opened, 12 changes, a second 16 MB table, 12 changes, then 25 undos, each checked: simple table (188,000 items) 165.2 to 108.3 MB after the second table, 165.0 to 108.0 MB at the end; rich table (30,000 items) 56.8 to 43.4 and 57.7 to 44.4 MB (2 runs of the rich table, the same to 0.1 MB). 25 of 25 undos matched in every run. The undo of the packed step, including the map work after it: 2.8 s (simple) and 1.2 s (rich); the slowest plain undo was 1.9 to 2.2 s and 0.95 to 1.0 s. Change times stayed within run-to-run noise (rich: 8.9 / 8.6 s and 9.6 / 11.3 s for 12 changes in two pairs). Save cost (2,000-item map, 557 KB of text, median of 13): the page's own time 2.0 to 1.8 ms in Chromium and 2.0 to 3.0 ms in Firefox; IndexedDB reported it kept 14 ms (Chromium) and 11 ms (Firefox) after the call, off the page's work. Kill test (Puppeteer, same profile, SIGKILL to the whole browser): before, the change was lost when killed 2, 10 or 30 s after it in Chromium and 2 s in Firefox; now kept in 6 of 6 kills. WebKitGTK's test sessions can't keep a profile, so it was not kill-tested; its suite passes. Maps whose saved text is 1.8 MB or more are still not autosaved (unchanged).

## 2026.10.31.0958 · 2026-10-31

### Quick
No behavior change, nothing saved changes. Page memory with big data: undo steps keep differences (new src/undo.js), the import keeps the file text instead of the parsed cells, the graph before an import is kept only when merging, and repeated text in an imported graph is pointed at one copy in idle slices.

### Details
`NFMUndo.step(old, new)` compares the two lists by reference and keeps the changed slots (same length, at most a quarter changed) or the stretch between the common start and end; a step where most of the map differs keeps the old graph whole, as before. `NFMUndo.back` rebuilds the old lists from the current ones. `leanImport` (src/app/10-data.js) drops `res.rows` and keeps `res.rowsFrom` (the file text, already held in `S.imp.files`) when one table file was read; `importRows` parses it again with the same separator for the mapping box. `S.imp.base` is null unless the import mode is merge. `shareTextSoon` (src/app/00-core.js) runs `NFMUndo.textSharer` in `requestIdleCallback` slices of 4,000 items after an import. Chromium 155, real app, 800 by 600 window, 2 rounds, main-page heap after a full garbage collection: 16 MB moderate table (188,000 items) open 149.5 to 102.3 MB, after 12 changes 184.5 to 102.0, second table 252.3 to 165.4, 12 more changes 287.2 to 165.6; 16 MB complex table (30,000 items) 115.5 to 57.7 MB at the end. Opening, editing and undo times within noise (BENCHMARKS section 56).

### Deep
Measured in Node first (100,000 items, 300,000 links): the imported graph is 67 MB, the parsed cells kept for the mapping box 49 MB, each undo step after an edit about 3 MB of copied reference lists, and the graph before a second file 75 MB, kept twice (Undo and `S.imp.base`). Repeated text: one string per cell, so 300,000 links labeled "step 5" held 300,000 copies; sharing cut the graph 67 to 51 MB (moderate) and 177 to 64 MB (complex). The sharer always writes the shared copy back: equal strings are === in JavaScript, so a "changed?" test never fired, and V8 only saved memory then because looking a string up as a key turns it into a pointer to one copy, which Firefox and WebKitGTK do not do. Tested alone and stacked (diffs, lean cells, merge-only base): stacked 280 to 155 MB in the Node mix. Not done here, on a card: packing whole-map undo steps and a 16 MB cap. Seen for later: the engine worker's copy of the graph (structured clone) is about 25% bigger than the page's and shares no text; sharing there saves 10% for 0.4 s of worker time. New test/undo.test.js: every kind of change alone and 40 in a row come back with the same objects; text sharing leaves every value alone, including __proto__ and constructor.

## 2026.10.31.0925 · 2026-10-31

### Quick
Same pictures, no new settings, nothing saved changes. A Network map (Distances) with at least 2 separate pieces of 150 to 4,000 items, and enough work in total (the sum of each piece's items squared at least 1,000,000), lays its pieces out on up to 3 helper threads. The page makes the helpers when the engine worker asks and gives each one a message port to it: a worker started inside a worker fails in WebKitGTK, with or without the page policy.

### Details
src/engine.js: `pieceBody` is the comps loop body pulled out; `buildPieces(graph, o, run)` builds once with `PIECES.capturing`, which stops after the comps loop with the list of eligible pieces (their item numbers, links, sizes, root and the one random draw each takes), hands them to `run`, checks every answer's count and length, then builds again with the answers (`PIECES.give`). Any trouble, including a helper that stops or answers short, lays the pieces out in the worker: the same picture. `pieceJob` runs one piece in a helper with the worker's tuning. src/engine-client.js: `helperPool` in the engine worker asks the page (`needHelpers`), the page's `Client.makeHelpers` starts the helpers from the worker's own text and sends a port each (`helperPorts`); helpers end 30 s after their last piece (`helpersDone`) and whenever the worker ends. Page timing, 3 rounds alternating old and new pages, medians, same picture hash every time: 10 pieces of 3,000 items 12.2 to 5.6 s Chromium, 11.7 to 6.0 s Firefox, 12.2 to 6.3 s WebKitGTK; 3 of 3,000: 3.3 to 1.4, 3.8 to 1.5, 4.0 to 1.7 s; one piece of 30,000: no change (BENCHMARKS section 55).

### Deep
Distances lays a piece of 150 to 4,000 items out with exactly one random draw, so the pieces can run anywhere in any order and still give the plain build's picture: the draws are taken in piece order in the first pass and sent with each piece. The worker takes the smallest pieces itself, one at a time between helper answers, while the helpers take the biggest first. The start point was tested by laying the same maps out with helpers from 1 million and from 6 million: 3 pieces of 800 items went 0.30 to 0.21 s (Chromium) and 4 of 1,000 went 0.79 to 0.59 s, with nothing slower beyond noise, so it starts at 1 million; 2 pieces of 600 (0.7 million) stay in the worker. Tried first: helpers made by the engine worker from the text it was sent (works in Chromium and Firefox; in WebKitGTK every helper failed, so the pieces fell back to the worker and the run took about 10% longer). New test/pieces.test.js: the same picture through `pieceJob` for mixed maps, no pieces sent for other arrangements, one-piece maps, previews or best quality, every fallback, tuning carried to the helpers, and saved-picture records kept.

## 2026.10.31.0846 · 2026-10-31

### Quick
Fix for 2026.10.31.0826: the data part of the layout key was kept on the worker's state object, which stays when a new graph arrives, so a new graph got the old graph's key. With the same item count, the saved picture of the first map was put on the second. `LAYOUT_EPOCH` is now `nfm-layout-4`, so records saved by 0826 are never used.

### Details
`layoutKey` keeps `memo.layoutHashOf` (the graph object the hash was made from) and reuses the hash only for that object. New checks in layout-saved.test.js: the worker memo given a new graph of the same size, and an edited link with the same item count, both get their own key; they failed on 0826. Seen in Chromium through the page: a 3,000-item map opened after three 1,000-item pieces came back in 101 ms from the store with the wrong places.

### Deep
The 0826 test made a fresh memo per graph, which the worker never does: `__st` lives for the worker's life and only `__st.G` changes. Found while timing maps of many pieces of equal total size (30,000 items each), where every later case came back in under a second.

## 2026.10.31.0826 · 2026-10-31

### Quick
Same pictures, no new settings. The saved-picture key (`layoutKey`, now `nfm-layout-3`) leaves out options that never move a Network item, and the engine client keeps the last finished picture in memory, so a color, link color or link width change puts the places back instead of laying out again. Saved pictures from earlier builds, and map files saved before this, are laid out once more (new key). Map items and links are made with every field up front; the fingerprints in topdown.test.js now sort field names first (same pictures).

### Details
`LOOK_ONLY` in src/engine.js lists the left-out options (colorBy, edgeColorBy, widthBy, widthMax, labelCol, linkLabels, wantFlow, traffic and the other views' settings); `agg` counts only with `sizeBy`. `layoutKey(graph, o, memo)` keeps the data's hash on `memo` (the helper's `st`, made fresh for each graph) and hashes only the options after that (330 ms saved per build at 100,000 items, Node). `Client.build` (src/engine-client.js) looks in `lastPic` (dropped by `setGraph`) before the browser store, and asks for the record even with the store off. `packFast` (src/pack.js) fills all columns in one pass, using `Object.values` after checking each row's field order; no code is built from text, since the helper runs under the page policy, which refuses it in all three browsers. Page timing at 100,000 items, 4 rounds, medians: link color 6.3 to 2.5 s Chromium, 7.2 to 2.8 s Firefox, 6.9 to 2.2 s WebKitGTK; first layout within 2% in all three (BENCHMARKS section 54).

### Deep
Found while hunting garbage collection: the build's own clock (L.ms) never saw the key, the hand-off or a look-only rebuild. Garbage, sampled during one 100,000-item build in Node: 941 to 742 MB (-21%). `gnode` makes every map item with all 41 fields in one order (-14% alone), links get their later fields up front (-3%), link details use plain loops (-6%), `networkLayout` uses `locArr` and a stamp array instead of a Map and Set per piece (-2%), and `fitScale` uses `hyp2`, V8's own two-number hypot written out (-4%; V8 makes an argument list per Math.hypot call). `hyp2` is used only when `HYP_SAME` finds it equal to Math.hypot on 4,000 pairs: true in Chromium and Node, false in Firefox and WebKitGTK, whose pictures would otherwise move a hair. Tried and dropped: a generated one-pass packer (2.6x, but refused by the page policy inside the helper); filling unpacked objects from a cloned template (within noise). Full collections per build (4 to 6) and their pauses vary by more than these changes move them. WebAssembly memory: each engine step makes its own instance, so nothing stays; the layered module keeps 6.8 MB after 50,000 items.

## 2026.10.30.2347 · 2026-10-30

### Quick
Map files store the layout as `layout.x` and `layout.y` lists of whole numbers instead of `layout.xy` (base64 of Float64 x,y pairs). Files with `xy` still open, with their exact places. The browser's own layout store is unchanged (still exact). Matrix Fit takes the whole grid layout. README and landing screenshots changed; "What it is and how it works" and "Why it exists" rewritten with use cases (no Story Editor background).

### Details
`mapFileLayout` (src/app/75-mapfile.js) rounds each place with `Math.round`; `layoutXY` turns either kind of layout back into the Float64Array the store expects, and returns null (the picture is worked out again) when the lists are missing or of different lengths. 30,000-item map: 1,172,668 to 810,965 bytes (-31%), layout part 476 KB to 114 KB (-76%); save and open within noise in all three browsers (BENCHMARKS section 53). New browser check: a 1,600-item network saves whole numbers at most 0.5 off, reopens with exactly those, and a hand-made old-style file reopens with the exact places. `fitTarget` (src/app/30-map.js) on a Matrix with no selection takes 0,0 to `L.width + 150`, `L.height`, because the scene's box covers only the squares, so the names and the 300-unit note were cut off. The engine's `matrixLayout` width is unchanged, so the layout fingerprints in topdown.test.js still match.

### Deep
Retested from the dropped list under the stacking rule: plain numbers alone saved 2% and 4-byte rounding alone 21%; whole numbers as two separate lists save 31%, more than the sum (23%), most likely because LFC-pack can store a column of whole numbers as integers, which neither base64 text nor a list of fractions allows. Cost: a reopened item sits up to half a unit off. Items are 26 to 66 units wide and the push-apart keeps at least 6 units between them, so no two can start touching.

## 2026.10.30.2252 · 2026-10-30

### Quick
Three stacked layout changes (owner's pick after testing each alone and all together) and a JSON Lines fix. Pictures of every flat map move slightly (push-apart order), so saved layouts are laid out once more. `.jsonl` and `.ndjson` files now open as JSON records.

### Details
`mapGraph` merges links on a number key (`groupIx`) instead of a text key and makes each link with every later field up front; `separate` (wasm/stress.c and its JavaScript twin, 2D only) walks items in grid order (`sorted`), the same pairs. 100,000 items, lab, medians (stretch first, then all three): Chromium 155 3,769 to 3,788 ms (5 runs), Firefox 158 3,714 to 3,485 ms (5), WebKitGTK 2.52.6 3,720 to 3,553 ms (6). `sniff` in src/importers.js returns `json` for `.jsonl`/`.ndjson` (and for pasted text whose every line is a JSON object). New test/file-types.js and test/file-types.test.js; the browser test feeds all 23 extensions and a saved `.json.lfc` through `#in-files`.

### Deep
Alone, each of the three was inside the noise; the two same-picture ones together were 2% faster in Firefox and WebKitGTK but 5.3% slower in Chromium (3,970 ms), so they ship only with the grid-order walk, which brings Chromium back to flat. The positions of the pair alone hash identical to before. JSON Lines: `importJSON` already read one record a line, but `sniff` fell through to the table reader when the whole text did not parse, so items came out named `{"from":"A"`; found by the new every-file-type test. The test checks that its list matches `TEXT_EXT` and `ARCHIVE_EXT` in src/app/10-data.js. Screenshots in images/ retaken in the dark theme from this build. BENCHMARKS section 52.

## 2026.10.30.2233 · 2026-10-30

### Quick
Network pieces over 80,000 items stretch once before the first push-apart passes instead of after them (stretch first). Pictures of such maps change slightly; smaller maps are unchanged. Saved layouts of big maps are laid out once more.

### Details
`clearOverlaps` in `src/engine.js`: when `k >= STRESS.jumpFirstMin` (80,000, new, part of the saved-layout fingerprint) and `overlapsPerItem` is over 2, the existing stretch (`1 + jumpPer * overlaps`, at most `jumpMax`) runs first. 100,000 items, lab, 3 runs each, medians: Firefox 158 4,581 to 4,058 ms, WebKitGTK 4,170 to 3,826 ms, Chromium 5,116 to 5,012 ms (old runs 4,495 to 6,056, inside the noise). Push-apart alone in Node: about 1.0 to 0.70 s.

### Deep
At 100,000 items the first 10 passes cut touching pairs only from 4.68 to 4.44 per item and cost about 0.5 s because the middle is so crowded; stretching first leaves 1.40 per item after them. Same page size (48,069 x 48,813), 0 touching. Middle half: average edge-to-edge gap to the nearest item 56.6 to 46.3, spread of gaps (coefficient of variation) 0.41 to 0.30, so tighter but more even. Gentler first stretches were tested (0.75: 0.28 spread, 1% smaller page, unsteady time; 0.5: 0.33, 5% larger page); the owner chose the full stretch from a side-by-side page. At 60,000 items the full stretch grew the page about 9%, hence 80,000. Also tested alone and stacked, not shipped here: number keys when merging links, link objects made with every field up front, and a grid-order walk in the wasm push-apart (all inside Node noise alone; all four stacked gave WebKitGTK 3,507 ms against 3,826 ms for stretch first alone, being followed up). Tests: Node 40 files; Chromium 209, WebKitGTK 197, Firefox 186 (11 card checks skipped in the lab). BENCHMARKS section 51.

## 2026.10.30.2131 · 2026-10-30

### Quick
memory-compression 2.6.2 to 2.6.6 (PR 102). Same packed bytes; nothing to change for callers.

### Details
Vendored `vendor/memory-compression.js` 2.6.6; the build still prepends `self.MEMORY_COMPRESSION_NO_EVAL = true`. On 100,000 real links: fast pack 229 to 167 ms (Chromium), 228 to 144 ms (Firefox), 193 to 146 ms (WebKitGTK); sync wake 204 to 66 ms (Chromium), 522 to 277 ms (Firefox), flat in WebKitGTK.

### Deep
Measured by the JS-modules compression round 8. 2.6.3 to 2.6.6 add slice-wise number-column opening in unpackAsync, lazy nested values in column pages, a control-character key fix and 2 to 12% faster opening of balanced or small columns. Tests: Node 40 files; Chromium 209, WebKitGTK 197, Firefox 186 (11 card checks skipped in the lab).

## 2026.10.30.2122 · 2026-10-30

### Quick
Network maps over 50,000 items use 10 push-apart passes instead of 30 (PR 101). Pictures of such maps move very slightly; smaller maps are unchanged. Saved layouts of big maps are laid out once more.

### Details
`STRESS.sepPassesBig` (10) applies when a piece has more than `STRESS.sepBigMin` (50,000) items; both are in the saved-layout fingerprint. 100,000 items in lab Chromium: 5.3 to 5.6 s down to 3.9 to 4.2 s (about 26%).

### Deep
Truth 0.1785 against 0.1784, same page area at 30,000 and 100,000 in the browser, 0 touching (the settle step still guarantees it). Below 50,000 the area sometimes grew about 20% for about 5% less time, so the threshold is 50,000. Chosen by the owner after a side-by-side comparison. BENCHMARKS section 50.

## 2026.10.30.2018 · 2026-10-30

### Quick
Faster first layout of big network maps with identical pictures (PR 100).

### Details
`wasm/stress.c` `bfs` switches to bottom-up once a level holds more than 1/20 of the items (same hop counts); `networkLayout` keeps `sizeAt[i]`. 100,000 items: Chromium 7,232 to 5,535 ms, Firefox 158 10.3 to 9.1 s; 30,000 items WebKitGTK 1,813 to 1,260 ms. Rebuild wasm with `sh wasm/build.sh && python3 wasm/embed.py` (the toolchain reproduces the old bytes from the old source).

### Deep
The multilevel start's coarsest copy is dense (1,816 items, 337,892 neighbor entries at 100,000) and uses every pair, so 1,816 top-down walks cost 1.0 s; bottom-up stops at the first frontier neighbor: 0.25 s. Positions of all items hash identical before and after in every browser. The `separate` square-root skip is exact but gave no measurable gain. Profile after: push-apart about 2.9 s, Stress about 1.2 s, setup about 2.5 s. BENCHMARKS section 49.

## 2026.10.30.1817 · 2026-10-30

### Quick
Far-out dotted links draw as one thin solid line in WebGL 2 (PR 99). Canvas and WebGPU drawing are unchanged.

### Details
`tessellate(S, opts)` takes `opts.k`; a `dash === 1` link whose dot spacing times k is under 2 px is drawn solid at alpha times on/(on + off); `draw()` re-cuts the dots when `view.k >= T.solidDotK`. 2,000 items, 1,467 dotted links: 283 ms to 3.1 ms a picture (lab Chromium).

### Deep
Before, about 250,000 dot pieces (about 60 MB of mesh) were built and uploaded per picture: bufferData 998 ms, garbage collection 206 ms, tessellation 360 ms over 8 pictures. Picture match: 103 of 921,600 pixels differ by more than 24 levels at fit zoom; identical at 8x. Chosen by the owner by card.

## 2026.10.29.1352 · 2026-10-29

### Quick
Nothing you can see changes: the shared layered-drawing module is now version 1.5.1 from JS-modules (it now refuses a bad size limit instead of guessing; this app's limit was already a valid number).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.27.1309 · 2026-10-27

### Quick
Big maps with plain links are a little faster to turn into a picture (scene module 1.3.1 from JS-modules: links with the same group pair and width share one look; laptop, Firefox, 30,000 items, building the scene: plain links 61 to 57 ms, bent links 65 to 56 ms; lower is better). The pictures are the same.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.27.1301 · 2026-10-27

### Quick
Nothing you can see changes: the map's breadth-first distance walk and the walk that drops looping links now come from the shared JS-modules graph-walk helper instead of two copies inside Netflow Map.

### Details
Not recorded beyond the line above.

### Deep
Nothing you can see changes: the map's breadth-first distance walk and the walk that drops looping links now come from the shared JS-modules graph-walk helper instead of two copies inside Netflow Map. Same maps, link for link, in Chromium and Firefox; build times at 8,000 and 30,000 items are within the usual noise (Chromium 1.2 s at 30,000 items either way). It uses graph-walk 0.1.0 from JS-modules.

## 2026.10.27.1006 · 2026-10-27

### Quick
New example to try the filters on: "A company's software systems" (about 290 services and databases of six teams, 712 links with a kind, a criticality column and calls per day).

### Details
Not recorded beyond the line above.

### Deep
New example to try the filters on: "A company's software systems" (about 290 services and databases of six teams, 712 links with a kind, a criticality column and calls per day). After loading, the notes list six steps in the Filter tab, including "Narrow the links by" (tick values to keep only those links; two columns must both match) and how "Kinds of link" differs. No change to anything else.

## 2026.10.27.0551 · 2026-10-27

### Quick
Faster to open a big saved map: a saved picture now also keeps which item the map starts from and the importance of every item, so opening it again skips those two steps (lab, rebuild at 100,000 items: Chromium 1.2 to 0.8 s, Firefox 2.4 to 1.2 s).

### Details
Not recorded beyond the line above.

### Deep
Faster to open a big saved map: a saved picture now also keeps which item the map starts from and the importance of every item, so opening it again skips those two steps (lab, rebuild at 100,000 items: Chromium 1.2 to 0.8 s, Firefox 2.4 to 1.2 s). The map looks exactly the same. Maps saved before this are laid out once more and then saved the new way.

## 2026.10.26.2330 · 2026-10-26

### Quick
Faster in Firefox: WebM video now encodes in the browser's realtime mode at twice the bit rate, about 5 times faster (the file is larger, and as close to the original picture as before). Other browsers are unchanged. On the graphics card path, up to 8 pictures are sent up in one call.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.26.1627 · 2026-10-26

### Quick
New: a grouped SVG for big maps. The Export tab now has "SVG (grouped, small)" and "SVG (every item its own element)".

### Details
Not recorded beyond the line above.

### Deep
New: a grouped SVG for big maps. The Export tab now has "SVG (grouped, small)" and "SVG (every item its own element)". The grouped one puts links, items and labels with the same look into one group: the 30,000-item map with 94,597 links goes from 17.5 MB and about 127,000 elements to 7.0 MB and about 30,000 elements (links become 69 paths), keeps the 150 best connected items on maps over 5,000 items and sets their names large enough to read with the whole map on screen (no overlapping ones; the full export keeps 2,500 specks), has no background (it goes onto any page; text color follows the app theme) and has no fixed size so a browser fits the whole map to the window. Stacking of links among links may differ slightly from the full one. Also: a map file now shows how long it took to open (Data tab) and to save (Export tab).

## 2026.10.26.1346 · 2026-10-26

### Quick
Map file (.json.lfc). `src/app/75-mapfile.js` (new) packs `{ format 'netflow-map', version 1, name, start, flavor, calc, roles, states, nodes, links, view, layout?.

### Details
For users: New: save a map as one small file and open it again. On the Export tab, Data card, "Map file (.json.lfc)" saves the items, links, states, view settings and, when the browser kept it, the finished picture (LFC-pack, the new file format). Drop the file on the Data tab to open it: nothing is laid out again when the picture is inside. The 30,000-item map with 90,029 links is 1.09 MB as a map file against 8.9 MB of data as text; saving took about 0.5 s (Chromium 155) and opening to a shown map took 2.9 s against 4.8 s the first time (WebKitGTK 2.52.6: 10.6 s against 12.5 s). Start-up is not slowed by more than about 4%, because the file module (about 160 KB packed, 666 KB unpacked) is only unpacked the first time a map file is saved or opened. File format may still change before the first release. Tested in: Chromium 155, Firefox 158, WebKitGTK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Map file (.json.lfc).** `src/app/75-mapfile.js` (new) packs `{ format 'netflow-map', version 1, name, start, flavor, calc, roles, states, nodes, links, view, layout? }` with `LfcPack.packTables` (vendor/lfc-pack.js 0.1.0 from JS-modules PR 186) and opens it with `unpackTables`; `layout` is the saved picture of the browser's layout store (key, xy as base64 of the Float64Array, width, height), put back into the store on open so the existing saved-layout path skips the layout (`fromSaved` true). Save: Export tab, Data card; open: any dropped or chosen `.lfc` file (`MAPFILE.queue`, handled first in `ingest`). The module is kept in the page as deflate+base64 text (`nfm-lfc-src`) and started on first use through DecompressionStream, so start-up (DOMContentLoaded, median of 15, lower is better) is Chromium 117 to 117-127, Firefox 182 to 187, WebKitGTK 86 to 89 ms (about +4%); page file 1,350,356 to 1,634,733 bytes. 30,000 items, 90,029 links: file 1,094,759 bytes (data as JSON text 8,852,268); save 548 ms (Chromium), 1,094 ms (WebKitGTK); open call 604 / 831 ms; map shown after open 2,880 ms against 4,811 ms first time in Chromium, 10,566 against 12,516 ms in WebKitGTK. One new browser check (round trip equal for items, links, states, view); Chromium 207, Firefox 184 (11 card checks skipped as on main), WebKitGTK 195. Also: main's index.html had been committed as the readable (unminified) build since PR 76 (2.1 MB); this PR rebuilds it minified.

## 2026.10.26.1320 · 2026-10-26

### Quick
Timeline steps reuse their layout copies.

### Details
For users: Dragging along the timeline (or playing it) on a big map is 2 to 6 times faster per step. Each step used to build a copy of every item and link; now the copies are made once and only the numbers that differ between two states are updated. On the 30,000-item map (90,029 links) one step took 328, 220 and 177 ms before and takes 101, 37 and 40 ms in Chromium 155, Firefox 158 and WebKitGTK 2.52.6 (lower is better). The pictures are identical (12 steps compared exactly). The GIF and video maker still builds each picture the old way. Tested in: Chromium 155, Firefox 158, WebKitGTK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Timeline steps reuse their layout copies.** `blendInto` in `src/app/40-states.js` writes the blend of two states into the objects of the last call for the same pair (two sets take turns), and only for the number fields that differ between the two states (`variesKeys`); the first call for a pair, a changed shape, the GIF/video maker and the pictures at the ends still use `blend`. 30,000 items, 90,029 links, one step at u 0.3 to 0.46, median of 9 (lab pass, lower is better): Chromium 328 to 101 ms, Firefox 220 to 37, WebKitGTK 177 to 40; first-use noise 328 to 433 in Chromium blend. Output identical to `blend` for 12 steps (JSON compare of nodes, edges, size, ch). Checks: Chromium 206, WebKitGTK 194 ok; Firefox 183 ok with the same 11 card checks skipped as on main. Postgres-ideas R2a (interval store) does not apply: states are a handful of columns, alive-at-state is already an array lookup; the cost was copying layouts.

## 2026.10.26.0030 · 2026-10-26

### Quick
Selecting a lot of items with the box or lasso no longer freezes the page.

### Details
Not recorded beyond the line above.

### Deep
Selecting a lot of items with the box or lasso no longer freezes the page. Before, the page searched the whole map once for every selected item, so a box over all 30,000 items of a big map took 12.8 seconds in Chromium 155; now it takes 6 milliseconds and picks exactly the same items. Maps of a few hundred items were already instant and look the same.

## 2026.10.26.0028 · 2026-10-26

### Quick
Box and lasso select no longer scan the whole map per selected item.

### Details
Tested in: Chromium 155, Firefox 158, WebKitGTK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Box and lasso select no longer scan the whole map per selected item.** `src/app/32-interact.js` looked up each selected item with `nodes.filter(...)[0]` (one pass over all items per selected item); now one key map is built once. Box over all 30,000 items of the big Network map, Chromium 155: 12,807 ms before, 5.7 ms after (lower is better), same items picked. One new browser check (box dragged over the map selects its items). Checks: Chromium 205, Firefox 193 and WebKitGTK 193 ok lines (baseline +1); Firefox skips 11 checks in this run, same as on main. Page size change: about 100 bytes.

## 2026.10.26.0001 · 2026-10-26

### Quick
**Drawing pictures in workers.** GIF/video pictures of a 3D turn (5,000+ items, 20+ pictures, 4+ cores) are drawn in 2 to 4 background workers (`src/draw-worker.js`, built into a second worker source in the page; `makeHost` takes an off-screen host; the key and caption are drawn on the page by...

### Details
For users: The GIF and video maker now draws the pictures of a 3D turn of a big map (5,000 items or more, 20 pictures or more, 4 or more processor cores) in 2 to 4 background workers, instead of one picture at a time on the page. The files come out byte for byte the same. On the 30,000-item test map, 60 pictures at 960 wide, on a 4-core test machine (lower is better): Chromium 64.1 s down to 30 to 33 s; Firefox 56 s down to 50 s (more cores help more, and your laptop test page measured 3.9 ms a picture in 4 workers against 9.9 ms on the page). The key and caption are still drawn on the page, because text drawn in a worker differed slightly in Firefox. New tests: four byte-for-byte GIF checks and one check that a picture drawn with no page matches the page's. Tested in: CH, FF, WK in container (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Drawing pictures in workers.** GIF/video pictures of a 3D turn (5,000+ items, 20+ pictures, 4+ cores) are drawn in 2 to 4 background workers (`src/draw-worker.js`, built into a second worker source in the page; `makeHost` takes an off-screen host; the key and caption are drawn on the page by `src/gifkey.js` because text drawn in a Firefox worker differed by up to 44/255 on about 250 pixels). The GIF is byte for byte the page-drawn GIF in 5 settings in all three browsers. 30,000 items, 60 pictures at 960 wide, 4-core test machine, noise guard passed (lower is better): Chromium page 64.1 s, 2 workers 42.5 s, 4 workers 30.4 to 33.4 s; Firefox page 56.4 s, 1 worker 64.6 s, 2 workers 50.0 to 56.5 s, 4 workers 52.4 s (each worker took 1.0 s a picture alone and 1.6 to 2.8 s with 2 to 4 running, so this machine runs out of cores; page-side key and composite 4 ms a picture). Laptop test page: page 9.9 ms a picture, 4 workers 3.9 ms. Browser checks: Chromium 204, Firefox 192 on a full run (181 here), WebKitGTK 192.

## 2026.10.25.2230 · 2026-10-25

### Quick
Big maps use less memory: the lists of links going in and out of each item are now two number lists instead of one list of objects per item (30,000 items, 94,597 links: whole page memory 18.4 to 12.5 MB in Chromium).

### Details
Not recorded beyond the line above.

### Deep
Big maps use less memory: the lists of links going in and out of each item are now two number lists instead of one list of objects per item (30,000 items, 94,597 links: whole page memory 18.4 to 12.5 MB in Chromium). Finding the neighbors of an item and the routes through it is faster too (routes from 5 items 320 to 93 ms in Chromium). New tests: the same links in the same order as before, and the same neighbors and routes.

## 2026.10.25.2125 · 2026-10-25

### Quick
Fixed two video file bugs: some browsers (Firefox) refused the MP4 because three header flags were written in the wrong place, and the seek points in longer WebM videos were a few bytes off. New test for both.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.2110 · 2026-10-25

### Quick
Fixed the map going black after a change on a big 3D map (for example Look, Arrangement, Distances 3D (stress) on 30,000 items): the graphics card's pre-load drew into the picture the browser was showing and left it empty until you pressed Fit. The pre-load now draws into a picture of its own.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.1326 · 2026-10-25

### Quick
The GIF maker can now save a video instead: new "File type" choice (GIF, or Video, which is MP4 where your browser can make it and WebM otherwise; if it can make neither you get a GIF and are told).

### Details
Not recorded beyond the line above.

### Deep
The GIF maker can now save a video instead: new "File type" choice (GIF, or Video, which is MP4 where your browser can make it and WebM otherwise; if it can make neither you get a GIF and are told). On a busy 30,000-item map a video came out at about 0.6 MB per 100 pictures against about 5 MB for the GIF (lower is better). A new line under the choices says how many pictures and about how big the file will be before you start. The legend has a new "Legend" choice: Short (the default: the first six groups, then "+ N more", with the size, line width and marker lines in a smaller block), Full (every group) or Off, and the old "Include the key" box is gone (an old Off setting carries over). The video plays in the page (it shows its first picture until you press play), and you can save it. The page's security rules gained one line for this, `media-src blob:`: only files made in the page itself.

## 2026.10.25.1245 · 2026-10-25

### Quick
The key (legend) on big maps is tidier: when it has many rows it uses up to three columns and ends with a "+ N more" line instead of one very tall column. New "Where the key goes" choice for GIFs (bottom left, bottom right, top left, top right). Keys with few rows look the same as before.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.1237 · 2026-10-25

### Quick
New "File size" choice for GIFs (Best picture, Smaller file, Smallest file; Smaller is the new default).

### Details
Not recorded beyond the line above.

### Deep
New "File size" choice for GIFs (Best picture, Smaller file, Smallest file; Smaller is the new default). On a busy 30,000-item map the file went from 6.9 MB to about 5.3 MB (lower is better) with Smaller and about 4 MB with Smallest. Turning the other way after each pause now also turns the other way at the pause where the GIF starts over (an odd number of turns is rounded up to even).

## 2026.10.25.1218 · 2026-10-25

### Quick
The GIF maker draws its pictures on a canvas kept in memory instead of one held on the graphics card. On one laptop drawing a picture took 21 ms instead of 103 ms (lower is better), so GIFs finish much sooner. The map on screen is not changed.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.1212 · 2026-10-25

### Quick
Making a GIF waits less between pictures, so a GIF without a look finishes about 10 to 20 percent sooner (Chromium 19.4 to 17.4 ms a picture, Firefox 18.3 to 14.8; lower is better). Pictures are identical.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.1200 · 2026-10-25

### Quick
The GIF looks (glow, blur, sharpen, colors) are now done by your graphics card when there is one, with the processor as the backup, so a GIF with a look finishes much faster (on one laptop the looks took 13 ms a picture instead of 38 ms; lower is better).

### Details
Not recorded beyond the line above.

### Deep
The GIF looks (glow, blur, sharpen, colors) are now done by your graphics card when there is one, with the processor as the backup, so a GIF with a look finishes much faster (on one laptop the looks took 13 ms a picture instead of 38 ms; lower is better). There is a new "Graphics card" choice in the Look section, set to automatic. The card does the same arithmetic as the processor, so a picture may differ by a color shade or two between computers.

## 2026.10.25.1124 · 2026-10-25

### Quick
GIF picture looks (glow, blur, sharpen, color) now run in WebAssembly, so a GIF with a look finishes about twice as fast on one worker (WebKitGTK 9.7 to 3.9 s, Firefox 5.7 to 2.9 s, Chromium 5.4 to 3.2 s; lower is better). Pictures are byte for byte the same as before; where WebAssembly is missing, the old code runs.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.25.1051 · 2026-10-25

### Quick
The GIF maker is much more flexible: a very smooth 25 FPS (every picture shown for exactly 0.04 seconds), turns that can pause between each other and turn the other way after each pause, a short swing instead of a full turn, six kinds of easing, names that show always, never, only when the map...

### Details
Not recorded beyond the line above.

### Deep
The GIF maker is much more flexible: a very smooth 25 FPS (every picture shown for exactly 0.04 seconds), turns that can pause between each other and turn the other way after each pause, a short swing instead of a full turn, six kinds of easing, names that show always, never, only when the map holds still, or when it slows down, and a look for the whole animation (brightness, contrast, color strength, warm or cool, tones such as old photo or black and white, soften, sharpen, glow, darker corners, nine ready-made looks) with a button to try it on one picture first. The work now runs in background workers, so the page stays free.

## 2026.10.25.1018 · 2026-10-25

### Quick
New Colors tab on the Map: pick a ready-made look (12, including Blueprint, Paper, Colorblind-safe, High contrast and Print gray) or change the color of every part yourself (background, boxes, text, links, highlights, good and bad, bands, twelve group colors, the number scale), the type family, and...

### Details
Not recorded beyond the line above.

### Deep
New Colors tab on the Map: pick a ready-made look (12, including Blueprint, Paper, Colorblind-safe, High contrast and Print gray) or change the color of every part yourself (background, boxes, text, links, highlights, good and bad, bands, twelve group colors, the number scale), the type family, and the size of items, names and lines. Looks are saved with the map, kept in My looks in this browser, and can be saved to a file and opened on another computer. The animated GIF follows your colors. Maps with no look chosen are drawn exactly as before (30,000-item rebuild 248 to 241 ms in WebKitGTK, lower is better).

## 2026.10.24.2045 · 2026-10-24

### Quick
Big maps with link rules, dashes, arrowheads or bent links are now kept in the compact flat lists too, so they rebuild faster after moving items (30,000 items, rebuild 143 to 128 ms in Chromium, 158 to 137 in Firefox, 228 to 212 in WebKitGTK; lower is better). Pictures are identical.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.24.1903 · 2026-10-24

### Quick
No change you will notice: the picture-building code now comes from the shared netflow-scene module (JS-modules) instead of a private copy, so Netflow Map and other projects stay in step.

### Details
Not recorded beyond the line above.

### Deep
No change you will notice: the picture-building code now comes from the shared netflow-scene module (JS-modules) instead of a private copy, so Netflow Map and other projects stay in step. Same pictures; rebuilding a 30,000-item picture is the same speed (Chromium 103 to 101 ms, Firefox 114 to 107, WebKitGTK 164 to 159; lower is better).

## 2026.10.24.1412 · 2026-10-24

### Quick
Moving items and changing label sizes on a big flat map rebuild the picture 1.2 to 1.4 times as fast again, with a shorter freeze: links are built straight into flat number lists instead of one object each (30,000 items, rebuild 113 to 91 ms in Chromium, 330 to 234 in Firefox, 192 to 161 in...

### Details
Not recorded beyond the line above.

### Deep
Moving items and changing label sizes on a big flat map rebuild the picture 1.2 to 1.4 times as fast again, with a shorter freeze: links are built straight into flat number lists instead of one object each (30,000 items, rebuild 113 to 91 ms in Chromium, 330 to 234 in Firefox, 192 to 161 in WebKitGTK; longest freeze 152 to 120, 387 to 306, 416 to 342; lower is better). Pictures are identical. Maps with link rules, arrows, 3D or fewer than 2,000 links build as before.

## 2026.10.24.1331 · 2026-10-24

### Quick
A second copy of Netflow Map opened in the same browser (another tab, or an old and a new build) no longer overwrites the saved map of the first.

### Details
Not recorded beyond the line above.

### Deep
A second copy of Netflow Map opened in the same browser (another tab, or an old and a new build) no longer overwrites the saved map of the first. The second copy shows "Open in another tab", saves nothing, and offers "Use this tab" to take over (the other copy then gets the card). Start-up is unchanged (Chromium 96 to 95 ms, Firefox 135 to 137, WebKitGTK 89 to 89, median of 11 fresh pages). Uses tab-guard 1.1.0 from JS-modules, which needs the Web Locks API; without it nothing changes.

## 2026.10.24.1303 · 2026-10-24

### Quick
Moving an item and changing label sizes rebuild the picture of a flat map 1.1 to 1.2 times as fast: each link's look (width, color, dash, arrow) is kept from the last picture instead of worked out again (30,000 items, rebuild 111 to 90 ms in Chromium, 127 to 105 in Firefox, 146 to 132 in WebKitGTK;...

### Details
Not recorded beyond the line above.

### Deep
Moving an item and changing label sizes rebuild the picture of a flat map 1.1 to 1.2 times as fast: each link's look (width, color, dash, arrow) is kept from the last picture instead of worked out again (30,000 items, rebuild 111 to 90 ms in Chromium, 127 to 105 in Firefox, 146 to 132 in WebKitGTK; lower is better; the longest freeze ties). Any other change to the look (line width, curves, rules, key edits, theme, states) still starts over, and pictures are identical.

## 2026.10.24.0913 · 2026-10-24

### Quick
Flow, Down, Spine and Lanes layouts are 1.0 to 1.9 times as fast (netflow-layers 1.5.0: the row-order search and row placement now run in WebAssembly, with plain JavaScript as the fallback; the page rule already allowed it).

### Details
Not recorded beyond the line above.

### Deep
Flow, Down, Spine and Lanes layouts are 1.0 to 1.9 times as fast (netflow-layers 1.5.0: the row-order search and row placement now run in WebAssembly, with plain JavaScript as the fallback; the page rule already allowed it). A 5,000-page map lays out in 510 to 297 ms in Chromium, 567 to 328 ms in Firefox and 390 to 275 ms in WebKitGTK (lower is better; first layout of a fresh page); a 300-page map gains little (13 to 8, 20 to 18, 10 to 10 ms). The pictures are exactly the same (576 layouts compared, 0 different).

## 2026.10.23.2351 · 2026-10-23

### Quick
Parking the links of a big map is faster with memory-compression 2.6.2 (was 2.4.9): packing 100,000 items takes 200-210 to 147-152 ms in Chromium, 286-306 to 257-275 in Firefox and 203-214 to 178-193 in WebKitGTK (lower is better); waking the links ties (30,000 items over 40 rounds: Chromium 32-34...

### Details
Not recorded beyond the line above.

### Deep
Parking the links of a big map is faster with memory-compression 2.6.2 (was 2.4.9): packing 100,000 items takes 200-210 to 147-152 ms in Chromium, 286-306 to 257-275 in Firefox and 203-214 to 178-193 in WebKitGTK (lower is better); waking the links ties (30,000 items over 40 rounds: Chromium 32-34 ms before and 32-33 after, Firefox 36-38 and 35). The page is 17.7 KB larger. Nothing drawn changes.

## 2026.10.23.2338 · 2026-10-23

### Quick
A packed link list could be left unreadable if it was parked by hand while the idle background pack was part way through (the next link read failed with "reading 'edges:0'"): the background pack now gives way when anything else took over.

### Details
Not recorded beyond the line above.

### Deep
A packed link list could be left unreadable if it was parked by hand while the idle background pack was part way through (the next link read failed with "reading 'edges:0'"): the background pack now gives way when anything else took over. Found by a 100,000-item timing run; the 2,000-item run never starts that pack. New test fails before and passes after; all 33 Node tests and the browser test pass in Chromium (186 checks), Firefox (174) and WebKitGTK (174). Nothing drawn changes.

## 2026.10.23.2131 · 2026-10-23

### Quick
Basic (Canvas 2D) drawing is faster for straight links: they are drawn as lines instead of curves that happen to be straight.

### Details
Not recorded beyond the line above.

### Deep
Basic (Canvas 2D) drawing is faster for straight links: they are drawn as lines instead of curves that happen to be straight. At 93,232 links one draw takes 757 to 629 ms in Chromium, 462 to 385 ms in Firefox and 7,258 to 934 ms in WebKitGTK (lower is better). Edge pixels differ slightly: 99.84% or more of color values within 5 of 255 in all three. Big maps on the graphics card are not affected.

## 2026.10.23.1716 · 2026-10-23

### Quick
A big map left alone for a few seconds comes back without holding the page: waking the parked links at 100,000 items holds the page 222 to 34 ms in Chromium, 273 to 14 ms in Firefox, 207 to 19 ms in WebKitGTK and 190 to 23 ms in GNOME Web (lower is better); it also uses memory-compression 2.4.9...

### Details
Not recorded beyond the line above.

### Deep
A big map left alone for a few seconds comes back without holding the page: waking the parked links at 100,000 items holds the page 222 to 34 ms in Chromium, 273 to 14 ms in Firefox, 207 to 19 ms in WebKitGTK and 190 to 23 ms in GNOME Web (lower is better); it also uses memory-compression 2.4.9 (waking all at once alone is 125 / 101 / 101 / 125 ms). The page is 30 KB larger. Nothing drawn changes.

## 2026.10.23.1631 · 2026-10-23

### Quick
Less memory churn when the picture of a big map is rebuilt with basic (Canvas 2D) drawing: at 100,000 items a rebuild makes 64 MB of short-lived data instead of 171 MB, and the page holds 305 MB once idle instead of 408 MB (lower is better); the picture is identical byte for byte.

### Details
Not recorded beyond the line above.

### Deep
Less memory churn when the picture of a big map is rebuilt with basic (Canvas 2D) drawing: at 100,000 items a rebuild makes 64 MB of short-lived data instead of 171 MB, and the page holds 305 MB once idle instead of 408 MB (lower is better); the picture is identical byte for byte. Drawing with the graphics card (WebGL 2) changes by about 4 MB only.

## 2026.10.23.1021 · 2026-10-23

### Quick
The Force arrangement of a map with 20,000 or more items can now be done on the graphics card, but only on a device where a quick timing says it is faster.

### Details
Not recorded beyond the line above.

### Deep
The Force arrangement of a map with 20,000 or more items can now be done on the graphics card, but only on a device where a quick timing says it is faster. At 100,000 items the whole layout took 26.2 s on the processor and 5.6 s on the card on a laptop with integrated graphics (4.7 times faster, 200,000 items 2.0 times; lower time is better), and the layout is as true (truth score 0.210 for both; lower is truer). A midrange phone (Android, Chrome) was slower on the card at 100,000 items (42.4 s against 24.2 s), so there it keeps using the processor; its timing check costs about two card rounds. Check this device now lists what to expect on each kind of device.

## 2026.10.23.0802 · 2026-10-23

### Quick
Plain straight links can now go to the graphics card as 9 numbers each instead of 60, the card building each link's quad itself (WebGL 2 only; arrows, curves, dashes and ribbons keep the old way).

### Details
Not recorded beyond the line above.

### Deep
Plain straight links can now go to the graphics card as 9 numbers each instead of 60, the card building each link's quad itself (WebGL 2 only; arrows, curves, dashes and ribbons keep the old way). Putting 100,000 straight links on the card takes 3.0 to 4.0 times less processor time (lower is better): Chromium 23.8 to 7.9 ms, Firefox 26 to 8, WebKitGTK 12 to 3, GNOME Web 11 to 3; the data sent shrinks from 22.9 MB to 3.4 MB, and the pictures are exactly the same (0 of 255 mean difference). The app measures once, on your own card, whether this is faster to draw and keeps the old way when it is not: on the test machine's software drawing it kept the old way in all four browsers, so nothing changes there. Real-card speeds come from the Netflow Map Tester's new "Straight links on the card" step. Tests: 185 / 173 / 173 / 173.

## 2026.10.23.0007 · 2026-10-23

### Quick
Flow, Down, Spine and Lanes layouts are 4 to 24% faster again (netflow-layers 1.4.0; the pictures are exactly the same in 576 of 576 comparisons).

### Details
Not recorded beyond the line above.

### Deep
Flow, Down, Spine and Lanes layouts are 4 to 24% faster again (netflow-layers 1.4.0; the pictures are exactly the same in 576 of 576 comparisons). First layout of a 3,000-page map (lower is better): Chromium 237 to 216 ms, Firefox 272 to 244, WebKitGTK 218 to 188, GNOME Web 213 to 194. Fixed: clicking an item on the old picture while new data was still being laid out could show "cannot read properties of undefined" in the details panel. A new random-use test (12,000 random pans, zooms, setting changes, item moves and file loads in the four browsers) found it and now finds nothing.

## 2026.10.22.2121 · 2026-10-22

### Quick
Panning and zooming a big map with the basic (Canvas 2D) drawing is much smoother.

### Details
Not recorded beyond the line above.

### Deep
Panning and zooming a big map with the basic (Canvas 2D) drawing is much smoother. While the camera moves, the last picture is slid and scaled instead of drawn again, and the sharp picture is drawn again a moment after you stop; at rest it is exactly the same as before. On a 1,500-item Sankey map, panning goes from 14 to 60 frames a second in Chromium, 23 to 60 in Firefox, and 2 to 28 and 2 to 22 in the two WebKit browsers; Flow and Network maps gain as much. Also new: hidden Save speed report and Save error log buttons (five quick taps in the top-left corner open them; nothing is sent anywhere), and the memory-compression piece is now version 2.3.4. The page opens in the same time as before.

## 2026.10.22.1947 · 2026-10-22

### Quick
Big Flow, Down, Spine and Lanes maps now draw.

### Details
Not recorded beyond the line above.

### Deep
Big Flow, Down, Spine and Lanes maps now draw. Before, a map of about 5,000 pages or more (with chapter folding off) was refused as "too big"; now maps up to about 250,000 stops (about 6,500 pages with 3 links each) draw, in 0.5 to 1.6 seconds for 5,000 to 6,500 pages. Smaller maps take the same time. Bigger ones are still refused, with the same plain message.

## 2026.10.22.1845 · 2026-10-22

### Quick
Flow, Down, Spine and Lanes layouts of a few thousand pages are built faster, and the pictures are exactly the same.

### Details
Not recorded beyond the line above.

### Deep
Flow, Down, Spine and Lanes layouts of a few thousand pages are built faster, and the pictures are exactly the same. The layered drawing is now netflow-layers 1.3.1. First layout of a 3,000-page map (lower is better): Chromium 447 to 248 ms (1.8 times faster, higher is better), Firefox 551 to 294 ms (1.9 times), WebKitGTK 469 to 211 ms (2.2 times), GNOME Web 454 to 215 ms (2.1 times); a 1,000-page map is 1.5 to 1.7 times faster, and a plain 20,000-page tree 1.1 to 1.2 times. The page file grows 0.19% (999,600 to 1,001,498 bytes).

## 2026.10.22.1253 · 2026-10-22

### Quick
Letting go of an item you moved on a big Network map no longer freezes the page.

### Details
Not recorded beyond the line above.

### Deep
Letting go of an item you moved on a big Network map no longer freezes the page. Before, the drop built the whole picture again; now it only refreshes the outer box, the click grid and the link hover, and the picture is identical. Main-thread time of the drop on a 10,000-item map with 31,026 links (lower is better): Chromium 106.8 to 2.3 ms (46 times faster, higher is better), Firefox 203 to 3 ms (68 times), WebKitGTK 84 to 19 ms (4.4 times), GNOME Web 84 to 20 ms (4.2 times). The page file grows 0.08% (998,834 to 999,600 bytes).

## 2026.10.22.1227 · 2026-10-22

### Quick
The first grab of an item on a big Network map no longer stalls.

### Details
Not recorded beyond the line above.

### Deep
The first grab of an item on a big Network map no longer stalls. Before, picking up an item on a map with tens of thousands of links first unpacked the whole stored link list; now the app moves the links in place and the list stays packed. Main-thread time for the first move on a 10,000-item map with 31,026 links (lower is better): Chromium 18.9 to 8.4 ms (2.2 times faster, higher is better), Firefox 20.0 to 6.0 ms (3.3 times), WebKitGTK 30 to 23 ms (1.3 times), GNOME Web 28 to 24 ms (1.2 times). Later moves are unchanged and pictures are identical. The page file grows 0.1% (997,825 to 998,834 bytes).

## 2026.10.18.2342 · 2026-10-18

### Quick
Moving an item by hand on a big Network map is much faster: only the item and its links are redrawn, and the picture is identical.

### Details
Not recorded beyond the line above.

### Deep
Moving an item by hand on a big Network map is much faster: only the item and its links are redrawn, and the picture is identical. Time per move on a 10,000-item map with 31,026 links (lower is better): Chromium 50.8 to 3.4 ms (14.9 times faster, higher is better), Firefox 106 to 3.0 ms (35.3 times), WebKitGTK 50 to 18 ms (2.8 times), GNOME Web 59 to 19 ms (3.1 times). Distances keeps its faster two-pair math above 20,000 items too (1.02 to 1.10 times faster at 30,000 and 60,000 items). The Sankey view uses netflow-sankey 2.3.0 (same pictures, no measurable change in speed on the stories tried). The smallest copy opens 1.18 to 1.32 times sooner (Chromium 140 to 106 ms, Firefox 183 to 155 ms, WebKitGTK 144 to 111 ms, GNOME Web 151 to 122 ms; lower is better). The page file grows 2.4% (974,757 to 997,825 bytes).

## 2026.10.18.2137 · 2026-10-18

### Quick
The copy to hand out now opens as fast as the page itself.

### Details
Not recorded beyond the line above.

### Deep
The copy to hand out now opens as fast as the page itself. `node tools/build.mjs --pack` also writes a fast-opening copy (the browser's own unpacker, 366 KB) next to the smallest-file LZMA copy (322 KB): ready in 66 to 116 ms instead of 145 to 187 ms, which is 1.6 to 2.2 times faster in all four test browsers (lower is better). The app itself is unchanged.

## 2026.10.18.2127 · 2026-10-18

### Quick
Big Network maps now come back much faster the second time.

### Details
Not recorded beyond the line above.

### Deep
Big Network maps now come back much faster the second time. A map of 1,500 items or more that you opened before is put back from this browser's own storage instead of being arranged again: 2.4 to 14.9 times faster in all four test browsers (higher is better), with exactly the same picture (3,000 items: 55 to 72 ms instead of 670 to 900 ms). The first time a map is opened costs about 3% more (up to 12%). Nothing leaves your computer; the Advanced tab has a switch and a "Forget saved pictures" button. The Distances arrangement is also 1.0 to 1.4 times faster up to 20,000 items (two pairs of items at a time, same picture). The page file grows 1.0% (974,757 bytes).

## 2026.10.18.2021 · 2026-10-18

### Quick
The flat Force arrangement is faster and truer on big maps (5,000 up to 20,000 items): it now starts from the Distances picture.

### Details
Not recorded beyond the line above.

### Deep
The flat Force arrangement is faster and truer on big maps (5,000 up to 20,000 items): it now starts from the Distances picture. Layout takes 1.5 to 2.4 times less time in all four test browsers (higher is better), and the hop error at 10,000 items drops from 0.265 to 0.168 (lower is truer). Force pictures change at those sizes; smaller and bigger maps are as before.

## 2026.10.18.1951 · 2026-10-18

### Quick
More of the layout work now runs as WebAssembly, with plain JavaScript kept as the backup.

### Details
Not recorded beyond the line above.

### Deep
More of the layout work now runs as WebAssembly, with plain JavaScript kept as the backup. Pictures are the same. Circle at 30,000 items is 1.7 to 2.8 times faster in all four test browsers; Distances 3D at 3,000 and at 30,000 items is 1.0 to 1.8 times faster; Closeness at 20,000 items and more is 1.1 to 1.5 times faster (higher is better; smaller maps stay on JavaScript, where the gain was not clear).

## 2026.10.18.1823 · 2026-10-18

### Quick
New arrangement: Distances 3D. The Network view can now lay a map out in 3D with the Distances method (turn it by dragging). Compared with the flat Distances it is truer at every size (hop error 0.117 against 0.177 at 30,000 items; lower is truer) and builds in 0.9 s at 30,000 items, 3.2 times faster than 3D force.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1411 · 2026-10-18

### Quick
The Sankey view now uses the shared netflow-sankey module (2.2.1). Pictures are the same. The page file grows 0.8%.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1259 · 2026-10-18

### Quick
New Spacing switch for Flow, Top-down, Spine and Lanes: Tight (as before) or Wide (looser, more tree-like, easier to read on a wide screen).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1246 · 2026-10-18

### Quick
Sankey on a big network no longer shows "NaN" for its crossing count.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1220 · 2026-10-18

### Quick
The old flow view is now called Sankey everywhere. Views saved under the old name open in the default view.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1149 · 2026-10-18

### Quick
A page that never packs its memory now saves about 5.8 MB (14.96 to 9.12 MB; lower is better).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.1101 · 2026-10-18

### Quick
The layout worker warms up while idle. First layout of a 3,000-item map: Chromium 1,029 to 833 ms, Firefox 1,047 to 863 ms (about 1.2 times faster; lower is better).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.0830 · 2026-10-18

### Quick
Firefox no longer logs a blocked-code error when a big map is packed.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.18.0032 · 2026-10-18

### Quick
A big map's link list is packed while the map sits idle. Memory in Chromium (lower is better): 30,000 items 101.8 to 93.1 MB (8.5% less); 100,000 items 331.5 to 295.7 MB (10.8% less).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.2238 · 2026-10-17

### Quick
Hovering over links on a big map uses far less memory: 30,000 items +142 MB to +31 MB, and the first hover takes about 0.3 s instead of 3.5 s in Chromium.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.2203 · 2026-10-17

### Quick
Idle links of a big map take about 93 bytes each instead of 340. At 100,000 items Chromium holds 402 to 335 MB (17% less).

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.2134 · 2026-10-17

### Quick
An idle layout worker now rests on maps of 20,000 items or more and gives its memory back (about 38 MB at 100,000 items in Firefox). The next layout takes about 1 s longer to restart it. Frame rate is written "FPS" everywhere.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.2058 · 2026-10-17

### Quick
The layered drawing now comes from the shared module netflow-layers (no change to any picture).

### Details
For users: Flow, Top-down, Spine, Lanes, Sankey, Arc and Matrix now draw from the shared netflow-layers module. Pictures are the same. Tested in: FF 158, UC 155, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**The layered drawing now comes from the shared module netflow-layers (no change to any picture).** The code that lays out Flow, Top-down, Spine, Lanes, Sankey, Arc and Matrix (354 lines inside `src/engine.js`) is replaced by `vendor/netflow-layers.js`, an exact copy of JS-modules netflow-layers 1.2.0 (API 1; 1.2.0 only adds exports of the inner pieces the app needs). Why: one copy to fix and improve for every app that uses it. Picture identity (equal is the goal): 1,344 builds against the previous engine, 7 views x 12 option sets (every Top-down choice, chapters on and off) x 16 maps of 30 to 900 pages, 0 differences, 0 errors; the 28 pinned pictures and the chapter checks pass. Cost (smaller is better): page file 759,438 to 765,179 bytes (5.7 KB, 0.76% bigger), gzip 273,193 to 275,345 bytes (2.2 KB, 0.79% bigger), because the module also carries its own `layout()` and `toSvg()`, which the app does not call. Speed is the same code path (not re-measured). Browser test, one at a time (Firefox on a virtual screen), no check changed: Chromium 155.0.8059.39 159 checks on this build; Firefox 158.0 148, WebKitGTK 2.52.6 148 and GNOME Web 46.5 148 on build 2026.10.17.2051, which has the same code except the version number inside the vendored file. Node: 23 files pass in about 18 s. The three bench pages (tester, Sankey lab, D3 race) load with no errors. The vendored file is byte for byte the released JS-modules netflow-layers 1.2.0 (JS-modules PR 53, merge c87abb9, SHA256 starts a73139a6ba6ec8ef).

## 2026.10.17.2015 · 2026-10-17

### Quick
Top-down: chapters, mini-map, bundled links, tapered links.

### Details
For users: Top-down: chapters fold big maps into boxes you can open (5,002 pages: 3,267 boxes down to 88, crossings 1,216 to 355). A mini-map shows the whole map. Optional bundled and tapered links. Tested in: FF 158, UC 155, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Top-down: chapters, mini-map, bundled links, tapered links.** (1) *Chapters (View panel, Auto/On/Off).* On a big map the pages behind each must-pass page fold into one "Chapter" box, and if more than 600 boxes remain, runs of about 80 to 130 pages fold into "Part" boxes; each folded box names its first page and the share of all routes through it ("23% of routes", "under 1% of routes"); click a box to open it, right-click to fold it back, search and selection open the box that hides a page. Auto folds above 1,500 pages. On a 5,002-page story boxes go 3,267 to 88, stand-in stops 33,087 to 1,697, crossings 1,216 to 355 and build 339 to 17 ms (all smaller is better); opening one 129-page part costs 18 ms. A 20,002-page story, which the old drawing refuses, draws as 252 boxes in 120 ms. (2) *Mini-map* (Auto/On/Off): a small picture of the whole map with a frame for the screen; first draw 7.4 ms, each redraw 0.01 ms at 5,002 pages. (3) *Bundle links that share a start or an end* (off by default): 5,002 pages, stops 33,087 to 30,654 (7% fewer) and crossings 1,216 to 1,065 (12% fewer); loop-free random 1,000 pages, stops 531 to 326 (39% fewer); little effect with tags on, and a 201-page story with story order gets 3 crossings worse (4 to 7). (4) *Taper links* (off by default): thick at the start, thin at the end, also in SVG export; about 1 ms per draw at 5,258 links. Straight-line placement (Brandes-Koepf) was built, measured (fewer slanted pieces but 7% to 5.7 times more drift and about 12 times wider) and **not** adopted. The shared parts (bundle, SVG taper) are published as the module netflow-layers 1.1.0. Folded chapter boxes show the first page name and the share of routes through them. Tested in all four on this build, one at a time: Chromium 155.0.8059.39 (159 checks), Firefox 158.0 (148, run on a virtual screen so the WebGL checks run), WebKitGTK 2.52.6 (148), GNOME Web 46.5 (148; one run had one failure in the "exact odds" check, a timing gap that returned an empty list, and the rerun passed all 148); the baselines are now 159, 148, 148, 148. Node: 23 test files pass in 19.1 s, including 9 new chapter checks and 3 new Top-down ones; 480 builds against the old engine, 0 differences with all options off. Numbers: `docs/TOPDOWN.md`.

## 2026.10.17.1830 · 2026-10-17

### Quick
Top-down: seven new choices, all off until you turn them on (the picture is exactly the old one by default).

### Details
For users: Top-down: seven new choices, all off until you turn them on. For example, very long links can be drawn as short tags (a 5,002-page story builds 6.5 times faster; a 20,000-page story that was refused now draws in 322 ms). Tested in: FF 158, UC 155, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Top-down: seven new choices, all off until you turn them on (the picture is exactly the old one by default).** In the View panel for Flow and Top-down: (1) *Rows: Story order.* Pages sit below every page that leads to them, so gold means a real loop. On a 5,002-page story, gold links drop from 1,027 to 97 (smaller is better) and crossings from 1,216 to 805 (smaller is better); the map gets 1.4 times taller (1,337 to 1,908 rows). On a map with no loops at all, gold drops from 851 to 0 but crossings rise from 90,351 to 131,569 (worse), so it is a choice, not the default. (2) *Draw very long links as tags.* A link longer than 8 rows becomes a short stub with a name chip at each end (click the chip to select the link) instead of a line across the page. On 5,002 pages: stand-in stops 33,087 to 11 (smaller is better), crossings 1,216 to 60, build time 392 to 60 ms (6.5 times faster; smaller is better). A 20,000-page story that used to be refused as too big now draws in 322 ms. (3) *Keep must-pass pages in one column.* On 5,002 pages, width 5,816 to 1,913 px (67% narrower) together with tags. (4) *Untangle harder.* Six more rounds; never worse than before; crossings 1,216 to 891 on 5,002 pages (27% fewer) at 392 to 651 ms. (5) *Cut a very tall map into columns.* On 5,002 pages the map goes from 38 times taller than wide to 0.8 (about the shape of a screen) in 12 columns, 4,223 x 160,446 px to 17,389 x 13,446 px. (6) *Show step numbers down the side* ("step 12"; more rows show as you zoom in). (7) *One column per group* in Top-down. Also a right-click item, *Select every page on a route through it*. (8) *Looks-only changes reuse the layout* (applies to every view). When nothing the layout depends on changed (the settings the engine gets, the data, the pins), a change that only affects looks, such as a color choice the engine does not use or turning step numbers on, now makes a new picture from the layout already on the stage instead of working the layout out again; a full rebuild gives the same layout and picture (3 new browser checks, positions of 300 items equal). Chromium 155, 100,000 items, color change: 6.2 s to 2.6 s (2.4 times faster; lower is better) and highest page memory 1,206 MB to 926 MB (23% less; lower is better, sampled right after the picture); page memory after a full collection is unchanged at about 590 MB (no leak either way). Tested in all four on this build, one at a time: Chromium 155.0.8059.39 (146 checks), Firefox 158.0 (126), WebKitGTK 2.52.6 (135), GNOME Web 46.5 (135); 9 new checks each (6 top-down, 3 for the reuse). Firefox runs fewer checks than the others, as before; the patch's Firefox baseline of 132 was a count error and is now 126. Node: 22 test files pass in about 19 s, including the new `test/topdown.test.js` (28 pictures pinned from the old engine). Numbers: `docs/TOPDOWN.md`.

## 2026.10.17.1651 · 2026-10-17

### Quick
Big maps: a rough picture first, and a smarter clean-up.

### Details
For users: Big maps (40,000 items or more) show a rough picture about twice as soon (100,000 items: 6.3 s down to 2.8 s). The finished picture arrives about 1 s later. Tested in: Chromium 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Big maps: a rough picture first, and a smarter clean-up.** (1) *Early preview.* A Network map of 40,000 items or more (Distances arrangement) now shows a rough picture as soon as the layout has been grown back from its half-size copy, before the polish steps and the no-touching clean-up; the finished picture replaces it when ready, and a note says so. The finished picture is the same, to the last digit, as without a preview (the half-size start is kept and resumed, not redone; test `early preview` in `test/stress-wasm.test.js`). Cost: the finished picture arrives a little later because the front of the build runs twice. Node, one run each, **lower is better**: 30,000 items rough picture at 0.99 s (whole build without preview 1.93 s, so about 2x sooner), finished at 2.06 s with preview (about 7% longer); 100,000 items rough at 2.7 to 3.0 s (without preview 6.2 to 6.4 s, about 2.1x sooner), finished at 7.2 to 7.6 s with preview (about 1.0 to 1.2 s, or 16 to 19%, longer). Smaller maps are unchanged. Knob: `stressTuning.previewMin` (40,000). (2) *Clean-up jump.* On maps of 20,000 items or more with more than 2 touching neighbors per item after the layout, the picture is first stretched by one step (at most 1.7x, `jumpMin`, `jumpMax`, `jumpPer`) before the push-apart passes: 100,000 items about 7.5 s to about 5.5 s in Node (about 27% less, lower is better), same truth score (0.178), picture size within +5.5% (not measured in the browsers). (3) *Fix, Firefox only.* The page policy check treated `'wasm-unsafe-eval'` as if it allowed `'unsafe-eval'`, so Firefox logged four refused-eval errors per big result; now it looks for the exact word `'unsafe-eval'` (new test in `test/pack.test.js`). Full Node run (21 files) passed. Browser test: Chromium 155.0.8059.39 137 of 137, WebKitGTK 2.52.6 126 of 126 and GNOME Web 46.5 126 of 126 on build 2026.10.17.1636, Firefox 158.0 117 of 117 on this build (the later change is the one-line Firefox fix above; the other three were not rerun for it), one at a time, from the `browsers` branch. Baselines: 137, 117, 126, 126 (one new check each: rough picture first, then the finished one).

## 2026.10.17.1612 · 2026-10-17

### Quick
Multilevel start, tuned: faster and a touch truer (follow-up to build 1531).

### Details
For users: Big networks lay out faster and truer: 10,000 items in 397 ms in Chromium (was 643 ms), with a better truth score (0.173 against D3 force's 0.190; lower is better). Tested in: Chromium 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Multilevel start, tuned: faster and a touch truer** (follow-up to build 1531). The polish step after growing the picture back used as many pivot searches and near neighbors as a from-scratch layout; it needs far fewer. Now it uses 6 pivot searches, 6 near neighbors per item and 3 sweeps (was about 30 to 60 pivot searches, 60 to 100 near neighbors, 6 sweeps; knobs `multiPiv`, `multiNear`, `multiIters` in `stressTuning`). A grid over 2 graph seeds at 10,000 items gave truth 0.170 to 0.177 for every setting between 4 and 15 pivots, so the smaller pair lists cost no truth. Whole build for 10,000 items in the race page (lower is better for both; D3 force scores 0.190 on truth and needs 11.1 to 18.1 s): Chromium 155.0.8059.39 643 ms / truth 0.207 at build 1507, 743 ms / 0.175 at build 1531, now **397 ms / 0.173**; Firefox 158.0 882 ms / 0.204, 887 ms / 0.178, now **527 ms / 0.173**; WebKitGTK 2.52.6 862 ms / 0.203, 979 ms / 0.176, now **558 ms / 0.172**; GNOME Web 46.5 791 ms / 0.203, 1.20 s / 0.176, now **670 ms / 0.172** (one run each, so a few tenths of a second is noise). In Node (1 run, lower is better): 30,000 items 0.178 in 0.94 s (build 1531: 0.180 in 2.5 s; before the multilevel start: 0.206 in 2.8 s); 100,000 items 0.178 in 7.6 s (build 1531: 0.177 in 12.1 s; before: 0.798 in 29.1 s). Networks of 4,000 items or fewer are unchanged. Full Node run (21 files) passed; browser test in Chromium 155.0.8059.39: 136 of 136. Tested in: ungoogled-chromium 155.0.8059.39 (chromium 155.0.8059.39), Firefox 158.0, WebKitGTK 2.52.6 (MiniBrowser 2.52.6) and GNOME Web 46.5 (Epiphany 46.5), one at a time, from the `browsers` branch, layout race only. Results files: `bench/results/multilevel/layout-1612-*.md`

## 2026.10.17.1540 · 2026-10-17

### Quick
A page policy on every Netflow Map page that allows WebAssembly and nothing looser (the owner's rule, 2026-10-17: `'wasm-unsafe-eval'` goes into `script-src` on all our pages; relayed by the coordinator).

### Details
For users: Every Netflow Map page now allows WebAssembly and nothing looser. Tested in: Chromium 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**A page policy on every Netflow Map page that allows WebAssembly and nothing looser** (the owner's rule, 2026-10-17: `'wasm-unsafe-eval'` goes into `script-src` on all our pages; relayed by the coordinator). The app (`index.html`), the tester, the Sankey lab and the D3 race page now carry `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:; connect-src 'none'; form-action 'none'; base-uri 'none'`. In plain words: a page can run its own inline code and WebAssembly, start its helper thread from a blob, and show pictures it makes itself; it cannot load anything from the internet, cannot build code from text (no `'unsafe-eval'`), and cannot send a form. One cost: the quick way of building a million alike items from packed columns (`new Function` in `src/pack.js`) is refused by such a policy, so a page with the policy skips it (`evalAllowed`) and uses the plain loop that was already the fallback: for 1,000,000 items of 12 fields about 490 ms against 78 to 93 ms in Firefox 158 (lower is better; about 0.4 s more per million), and 851 against 931 ms in Node 22 (no cost); a 100,000-item picture pays about 0.04 s. Node tests (no page) keep the quick way. The browser test reads the GIF it makes from the blob it was handed, because a page with `connect-src 'none'` cannot fetch even a blob address, and has one new check that the policy text is there with no `'unsafe-eval'` and that a fetch is refused (baselines: Chromium 136, Firefox 116, WebKitGTK 125; each was 1 lower). The WebAssembly helper-thread checks pass under the policy (the helper inherits it). Tested in: ungoogled-chromium 155.0.8059.39 (136 of 136), Firefox 158.0 (116 of 116), WebKitGTK 2.52.6 (125 of 125) and GNOME Web 46.5 (120 pass; the same 5 click and drag checks fail as on the build before the policy, because GNOME Web refuses WebDriver clicks), one at a time, from the `browsers` branch; the race page (network step, quick), the Sankey lab (quick) and the tester's 3D step ran in all four (tester: Chromium, Firefox, WebKitGTK) with no page errors, and in Chromium the tester shows the same two WARN lines as the tester built before the policy. This build also carries the multilevel start of the row above.

## 2026.10.17.1531 · 2026-10-17

### Quick
Truer big maps: a multilevel start for the Distances (Stress) arrangement (the owner chose "Both, truth first" from `/research/d3-comparison/REPORT.md`, 2026-10-17).

### Details
For users: Truer big networks: the Distances arrangement now starts from a shrunken copy of the map. At 10,000 items it is truer than D3 force in all four browsers. Tested in: Chromium 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Truer big maps: a multilevel start for the Distances (Stress) arrangement** (the owner chose "Both, truth first" from `/research/d3-comparison/REPORT.md`, 2026-10-17). Before, a network of more than 4,000 items started from a spiral and was then pulled into place by sweeps over a sample of item pairs, so its overall shape came out a little off (and badly off at 100,000 items). Now the engine first shrinks the network to about half its size by pairing each item with a linked neighbor, lays that smaller copy out (shrinking again while it is still over 2,000 items, then using every pair), grows the picture back, and polishes it with 6 gentle sweeps instead of 36 hard ones. Nothing changes for networks of 4,000 items or fewer (same picture to the last digit; `test/stress-wasm.test.js`). The truth score (lower is truer; D3 force scores 0.190 at 10,000 items) in the same four browsers as the race page: 10,000 items Chromium 155 0.207 to 0.175, Firefox 158 0.204 to 0.178, WebKitGTK 2.52.6 0.203 to 0.176, GNOME Web 46.5 0.203 to 0.176, so Netflow Map is now truer than D3 at every size of the race. Time for 10,000 items (lower is better; one run each, so a few tenths of a second is noise): Chromium 643 to 743 ms, Firefox 882 to 887 ms, WebKitGTK 862 to 979 ms, GNOME Web 791 ms to 1.20 s; D3 needs 10.6 to 16.0 s for the same network. In Node (1 run): 30,000 items truth 0.206 to 0.180 and 2.8 to 2.5 s; 100,000 items truth 0.798 to 0.177 (a 4.5x truer picture) and 29.1 to 12.1 s (about 2.4x faster). The WebAssembly and plain-JavaScript paths still give the same picture (`stress-wasm.test.js` has a new case: 6,000 items truth 0.207 to 0.170, two runs identical, a 1,200-item piece unchanged). Closeness, which starts from Stress, benefits the same way. Knobs in `NFMEngine.stressTuning`: `multi` (1 on, 0 off), `multiMin` 4000, `multiCoarse` 2000, `multiEta` 0.12, `multiIters` 6, `multiJitter` 0.3; chosen from a grid over three graph seeds (a smaller multiCoarse is faster and a bigger one a little truer: 3000 gave 0.168 at 10,000 items for about 0.3 s more). The race page also takes `?only=network` or `?only=flow` now, to run one race alone. Tested in: ungoogled-chromium 155.0.8059.39 (chromium 155.0.8059.39), Firefox 158.0, WebKitGTK 2.52.6 (MiniBrowser 2.52.6) and GNOME Web 46.5 (Epiphany 46.5), one at a time, from the `browsers` branch, layout race only (the flow and drawing races are not touched by this change); full Node run (21 files) passed. Results files: `bench/results/multilevel/`

## 2026.10.17.1507 · 2026-10-17

### Quick
New: the Netflow Map against D3 race page (`bench/netflow-map-d3-race.html`, build `node tools/build-d3-race.mjs`; the owner chose "Head-to-head page" from `/research/d3-comparison/REPORT.md`, 2026-10-17).

### Details
Tested in: Chromium 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**New: the Netflow Map against D3 race page** (`bench/netflow-map-d3-race.html`, build `node tools/build-d3-race.mjs`; the owner chose "Head-to-head page" from `/research/d3-comparison/REPORT.md`, 2026-10-17). A one-button page that races Netflow Map against the open-source D3 library on the same data in whatever browser opens it, and writes `netflow-map-d3-race-results.md`. Three races, each with tables that say which direction is better: (1) network layout at 1,000, 3,000 and 10,000 items (Netflow Stress and Force against d3-force 3.0.0: time and the repository's truth score); (2) flow layout at 100, 400 and 1,500 items (Netflow Flow against d3-sankey 0.12.3: time and straight-line link crossings); (3) drawing the same positions while panning and zooming (D3 SVG, D3 canvas, Netflow Map WebGL 2, Netflow Map basic canvas: FPS, slowest 1 in 20 pictures, time to the first picture). D3 is bundled under its own licenses (ISC and BSD-3-Clause, texts at the bottom of the page); it is never part of `index.html`. No app change: `index.html` is untouched. Page size 459 KB. A full run took 54 to 67 seconds in each test browser. Layout results from the four browsers (Netflow Map's faster arrangement against d3-force, **times faster, higher is better**): 1,000 items 3.3 to 6.8, 3,000 items 3.0 to 5.2, 10,000 items 12 to 20; the truth score is better than d3-force's at 1,000 and 3,000 items and worse at 10,000 (Stress 0.203 to 0.207 against d3-force 0.190, **lower is truer**). Flow layout: fewer crossings in all 12 runs (for example 3,761 against 107,409 at 1,500 items), but slower than d3-sankey in 9 of 12 runs (0.2 to 0.9 times, **higher is better**; 1.2, 3.5 and 5.8 times in the other 3). Drawing numbers from these runs come from software drawing in a script-driven browser and are not a measure of a real graphics card, so only the owner's laptop run counts for drawing (Firefox 158 could not start WebGL 2 here). Tested in: ungoogled-chromium 155.0.8059.39 (chromium 155.0.8059.39), Firefox 158.0, WebKitGTK 2.52.6 (MiniBrowser 2.52.6) and GNOME Web 46.5 (Epiphany 46.5), one at a time, from the `browsers` branch; all four ran the whole page (it needs no clicks, so GNOME Web's refusal of WebDriver clicks did not matter). Results files: `/research/d3-comparison/results/`

## 2026.10.17.1435 · 2026-10-17

### Quick
Moved to the LFC Foundry organization and renamed Netflow Map (the owner, 2026-10-17).

### Details
For users: Moved to the LFC Foundry organization and renamed Netflow Map. Tested in: Node 22 (FF = Firefox, UC = ungoogled Chromium).

### Deep
**Moved to the LFC Foundry organization and renamed Netflow Map** (the owner, 2026-10-17). The repository now lives at `https://github.com/lfcfoundry/netflow-map` (private), moved by GitHub's transfer so all history and every commit author are unchanged. The product is now called **Netflow Map** (one word, was "Net Flow Map"): page title, credit line, source comments, README, AGENTS.md and the docs. The credit link in the page and the file header now point to the new address. File names changed too: `bench/net-flow-map-tester.html` is `bench/netflow-map-tester.html`, `bench/net-flow-map-sankey.html` is `bench/netflow-map-sankey.html`, and the files they offer to save are `netflow-map-tester-results.md` and `netflow-map-sankey-results.md`. Old rows in this file and saved results in `bench/results/` keep the old name because they describe the builds as they were. The JSON file tag `"net-flow-map"` is still read (older saved files use it) and `"netflow-map"` is now read too (one new check, `test/import-fixes.test.js`). No feature or speed change: 0 lines of drawing or engine code changed (comments and text only). The vendored `vendor/back-close.js` header now names `lfcfoundry/JS-modules` and LFC Foundry (comment only; the file is still the older 1.0 copy, not the module's current 1.1.0). The tester and Sankey lab pages were rebuilt, so they now also carry the Force and Distances WebAssembly work already on `main` (tester 631,859 to 692,758 bytes, Sankey page 424,199 to 519,063 bytes). `index.html` size 734,434 to 734,438 bytes (+4 bytes, the new date stamp and shorter name roughly cancel). Tested in: Node 22.22.0 only (`node test/all.js --changed`: 21 files, all pass except `engine-fixes.test.js` checks 5a and 5f, which miss their time limits when files run four at a time and pass when that file runs alone, 32 of 32). **Not used for this build: Firefox 158.0, ungoogled-chromium 155.0.8059.39, WebKitGTK 2.52.6, GNOME Web 46.5** (the change is text only; the browser tests were not run)

## 2026.10.17.1424 · 2026-10-17

### Quick
The Distances arrangement runs in WebAssembly, 1.0 to 2.2 times faster from 3,000 to 30,000 items, and its pair lists take 37.5% less memory. Pictures are the same.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.1256 · 2026-10-17

### Quick
WebAssembly Force, and two plain-JavaScript speed-ups (the owner chose "Force" from the WebAssembly audit, 2026-10-17).

### Details
For users: The Force arrangement runs in WebAssembly: 10,000 items in Chromium 4,734 to 2,223 ms (2.1 times faster), 1.4 to 1.6 times in the other browsers. Same positions as before. Tested in: UC 155, FF 158, WebKitGTK 2.52.6, GNOME Web 46.5 (5 known click/drag failures) (FF = Firefox, UC = ungoogled Chromium).

### Deep
**WebAssembly Force, and two plain-JavaScript speed-ups** (the owner chose "Force" from the WebAssembly audit, 2026-10-17). (1) The Force arrangement's rounds (springs, repulsion, gravity; also 3D force, the 3D start-up polish and group clusters) now run as a 7,260-byte WebAssembly program, `wasm/force.c`, used automatically from 150 items up inside the helper thread. **Same positions to the last digit** in 2D and 3D, also when two items sit on one spot (`test/force-wasm.test.js`, 10 checks; one more browser check runs it inside each browser's own helper). The JavaScript stays the fallback if WebAssembly is missing, blocked or fails. Time for 10,000 items in 2D (120 rounds), JavaScript to WebAssembly in milliseconds, **lower is better**: Node 22.22.0 4,462 to 2,540 (1.76 times faster), ungoogled-chromium 155 4,734 to 2,223 (2.13), Firefox 158 3,895 to 2,567 (1.52), WebKitGTK 2.52.6 3,728 to 2,357 (1.58), GNOME Web 46.5 3,224 to 2,287 (1.41); 3D force at 10,000 items is 1.11 to 1.99 times faster (WebKitGTK 1.11, GNOME Web 1.14); 30,000 items 1.50 to 1.68 times. All sizes in `docs/BENCHMARKS.md` section 21 and `README.md`. Cost: the page grows by 11,442 bytes (712,344 to 723,786; gzipped 253,567 to 259,227, +2.2%). This page has no content-security policy, so nothing needed adding; a page that carries one needs only `'wasm-unsafe-eval'` in `script-src`. Source, build script and embed step: `wasm/` (`sh wasm/build.sh`, `python3 wasm/embed.py`; two builds give the same bytes). 100,000 items: not measured (about a minute in JavaScript). (2) Closeness no longer calls `Math.pow` with exponents that are always 1 and 0: identical pictures, 0.94 to 1.57 times as fast (Chromium 1.23 to 1.57; Firefox 0.95 to 1.17; two rows are 5 to 6% slower, within noise). (3) The simulator keeps per-end results only for ends that were hit (up to 4,000 trials): 1,000 runs on a 100,000-item tree with 66,667 ends took 8.0 to 10.4 s and now take 0.10 to 0.30 s (30 to 106 times faster) in all five engines, every number identical (`test/sim.test.js` section 4); the control without ends is unchanged. Tested in: ungoogled-chromium 155.0.8059.39 (134 checks, 53 s), Firefox 158.0 (114, 40 s), WebKitGTK 2.52.6 (123, 49 s), all green, plus all 20 Node test files. GNOME Web 46.5: 118 passed and 5 failed; the 5 are the mouse-drag and click checks that GNOME Web's WebDriver refuses, and they fail the same way on the previous build. Not run: Safari itself, Chrome on the phone.

## 2026.10.17.0403 · 2026-10-17

### Quick
Repeated links now add their weights together. Links with weight 0 or less are left out with a note. Hiding a group no longer recolors the others.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.0351 · 2026-10-17

### Quick
Many import fixes: numbers like 1.637 and 1,637 read correctly, odd dates and numbers, and files that hung or were cut now say so. Also fixes in the layout, simulator, Sankey and SVG export.

### Details
Not recorded beyond the line above.

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.17.0307 · 2026-10-17

### Quick
Reverted the 0228 "let go of the old big picture first" step.

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Reverted the 0228 "let go of the old big picture first" step. An independent code review (part of the bug hunt) found it did not actually free anything (the renderers and the key map still pointed at the old picture, so peak memory was unchanged) and that an error while building the new picture would leave the map dead with a frozen frame. My Node measurement (150 MB per 100,000-item picture) stands; the claim that the app's peak fell from 300 MB to 150 MB was never measured in the app and was wrong. Chromium baseline back to 94 checks. Tested in: ungoogled-chromium 155.0.8059.39 (browser test, 94 passed, 48.0 s); full Node run with the 90-second fuzz (17 files, 82.5 s) passed before the revert and the revert touches only the page

## 2026.10.17.0304 · 2026-10-17

### Quick
Tester only, from the owner's 0236 report: (1) every live picture box now has a caption saying exactly what is drawing in it right now (items, drawing way and which of the three turning tests), and the flat item-position pictures are captioned "Finished flat picture (not live)" so a frozen 2D...

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Tester only, from the owner's 0236 report: (1) every live picture box now has a caption saying exactly what is drawing in it right now (items, drawing way and which of the three turning tests), and the flat item-position pictures are captioned "Finished flat picture (not live)" so a frozen 2D picture is no longer mistaken for the test below it; (2) Ctrl + wheel and trackpad pinch anywhere over the turning picture, its buttons and captions no longer zoom the web page (page-level guard; a page-zoom can still happen if the browser is busy for seconds, which is not yet proven); (3) zoom out was slower than zoom in because the zoom eased in straight steps (a quarter of the remaining distance each picture), which is fast to grow and slow to shrink: it now eases in log steps by real time, so in and out are mirror images, and mouse wheels that report lines (Firefox) are scaled like the app; (4) new rows in the results file give the drawing time zoomed out, at the fitted size and zoomed in, to show whether zooming out is genuinely heavier to draw (every item and link on screen at once). Tested in: ungoogled-chromium 155.0.8059.39 (tester 3D step with 1,000 and 3,000 items: captions appear, wheel guard blocks Ctrl + wheel on the picture and its caption and leaves the rest of the page alone); not run on a graphics card, Firefox or the owner's laptop

## 2026.10.17.0255 · 2026-10-17

### Quick
Test tooling only (no change to the app), from the guide's bug-hunting playbook: (1) a browser check that the old big picture is let go before the new one is built, with a control that fails when the limit is raised; (2) new `test/awkward.test.js` (about 1 s): an awkward table (NaN, Infinity,...

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Test tooling only (no change to the app), from the guide's bug-hunting playbook: (1) a browser check that the old big picture is let go before the new one is built, with a control that fails when the limit is raised; (2) new `test/awkward.test.js` (about 1 s): an awkward table (NaN, Infinity, blanks, "1,234.50", 1e308, Arabic digits, a self-loop, blank ends) goes through the importer, 7 view and layout combinations and the SVG export, with no crash and no NaN or Infinity in places, sizes or the picture (found nothing wrong; "no value" is deliberately NaN in sizeV, colorV, widthV). Chromium baseline is now 96 checks; Firefox and WebKitGTK baselines rise at their next run. Tested in: ungoogled-chromium 155.0.8059.39 (browser test, 96 passed); Firefox 158.0 and WebKitGTK 2.52.6 not run for these two checks

## 2026.10.17.0249 · 2026-10-17

### Quick
Test tooling only (no change to the app): lessons from the universal QA guide.

### Details
Tested in: UC 155, FF 158, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Test tooling only (no change to the app): lessons from the universal QA guide. (1) Every browser run now counts its passing checks and fails if there are fewer than the last all-green run of that browser (a run that quietly skips checks is a failure); counts are saved in `test/baseline.json` (`NFM_BLESS=1` saves a new count after a reviewed change). (2) `node test/all.js --only=REGEX` and `--changed` run just the Node tests for what changed (a page-only change runs none and says to run the browser test; an unrecognized change runs everything). (3) New `docs/FLAKES.md` ledger for failures that pass on rerun. (4) The earlier guide's memory advice was corrected after measuring. Build 0228 (the app) was also run in all three approved browsers one at a time: Chromium 94 checks passed in 48.9 s, Firefox 74 in 29.1 s, WebKitGTK 83 in 34.9 s

## 2026.10.17.0228 · 2026-10-17

### Quick
Memory: a map of 20,000+ items now lets go of the old picture's lists before the new ones are built (at 100,000 items one picture keeps about 150 MB of item, link and label objects alive, so the peak while rebuilding was about 300 MB and is now about 150 MB; maps under 20,000 items behave exactly as before).

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Memory: a map of 20,000+ items now lets go of the old picture's lists before the new ones are built (at 100,000 items one picture keeps about 150 MB of item, link and label objects alive, so the peak while rebuilding was about 300 MB and is now about 150 MB; maps under 20,000 items behave exactly as before). Measured in Node: those 150 MB are JavaScript objects (about 300,000 links, 100,000 items, 100,000 labels), not number buffers, so 16-bit positions and buffer reuse would save only a few MB and were not done. The browser test lowers the limit to 50 items (`window.NFM_RELEASE_MIN`) so the same path is tested. Tested in: ungoogled-chromium 155.0.8059.39 (browser test passed, 47 s), software drawing

## 2026.10.17.0209 · 2026-10-17

### Quick
Tester only, from the owner's steady 0141 laptop run (screen 60 FPS and arithmetic 21 to 23 ms at all four readings; everything completed; WebGL 2 turned and zoomed at 60 FPS almost everywhere; two freezes left: 1.35 s zooming at 100,000 items and 0.75 s turning at 25,000).

### Details
Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Tester only, from the owner's steady 0141 laptop run (screen 60 FPS and arithmetic 21 to 23 ms at all four readings; everything completed; WebGL 2 turned and zoomed at 60 FPS almost everywhere; two freezes left: 1.35 s zooming at 100,000 items and 0.75 s turning at 25,000). The hands-on turning picture used to start drawing at the beginning of the 3D step and ran beside the tests ("angle math only, nothing drawn" read 42 FPS), and the tester kept every finished 3D map in memory while the owner zoomed. Now the picture starts after every test has finished, finished maps are let go, and the picture rebuilds only the map on show when a size button is pressed. Each freeze over a quarter second in the hands-on test now also records the zoom level it happened at. Tested in: Firefox 158.0, ungoogled-chromium 155.0.8059.39 and WebKitGTK 2.52.6 (quick tester runs, no errors; size buttons checked in Chromium); the app itself is unchanged

## 2026.10.17.0155 · 2026-10-17

### Quick
The privacy-mode clock check now uses env-probes 1.1.0 from JS-modules (the app carried the first unlabeled copy, 75 lines; the new one is 256 lines).

### Details
Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
The privacy-mode clock check now uses env-probes 1.1.0 from JS-modules (the app carried the first unlabeled copy, 75 lines; the new one is 256 lines). Used only by the device check: `timerRounded()` is now true for any clock step above about 8 ms, not only 100 ms, so Firefox's "resist fingerprinting" (about 16.7 ms) now counts and the check says the clock is rounded; the old copy only caught a 100 ms step. The page grew by 8,353 bytes (682,459 to 690,812; about 2,869 bytes gzipped, 243,175 to 246,044) because the new file also brings checks the app does not call. No drawing changed. Tested in: Firefox 158.0 (74 checks), ungoogled-chromium 155.0.8059.39 (94 checks), WebKitGTK 2.52.6 (83 checks), one at a time, and all 16 Node test files

## 2026.10.17.0141 · 2026-10-17

### Quick
Tester only: from the owner's 0119 laptop run, which ran badly because the whole computer was slowed down (a blank picture reached only 32 to 40 FPS instead of 60, some processor timings were 3 times slower than the run before) and then ran out of memory at 100,000 items.

### Details
Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Tester only: from the owner's 0119 laptop run, which ran badly because the whole computer was slowed down (a blank picture reached only 32 to 40 FPS instead of 60, some processor timings were 3 times slower than the run before) and then ran out of memory at 100,000 items. New "Was the computer steady during the run?" check reads the blank screen rate and a fixed bit of arithmetic at the start, before the drawing tests, before the 3D tests and at the end, and says in plain words when the computer slowed down (battery saver, other programs, heat) so the timings are not trusted. The drawing-time section no longer times 100,000-item pictures one by one on the page (each allocates over 100 MB; the card-path turning tests cover that size). A 3D build that runs out of memory now fails only its own row instead of the whole step and the hands-on picture. Tested in: Firefox 158.0, ungoogled-chromium 155.0.8059.39 and WebKitGTK 2.52.6 (quick tester runs, no errors, steady verdict ok); the app itself is unchanged

## 2026.10.17.0119 · 2026-10-17

### Quick
The app no longer draws with WebGPU (the owner's decision after the 0039 laptop run: random 1.5 to 1.9 second freezes in WebGPU while turning, zooming and dragging; WebGL 2 stayed steady).

### Details
For users: The app no longer draws with WebGPU, because it caused random freezes of 1.5 to 1.9 seconds. WebGL 2 (then basic drawing) is used instead. Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
The app no longer draws with WebGPU (the owner's decision after the 0039 laptop run: random 1.5 to 1.9 second freezes in WebGPU while turning, zooming and dragging; WebGL 2 stayed steady). Automatic is WebGL 2 then basic drawing, the Advanced menu no longer offers WebGPU, a saved WebGPU choice becomes Automatic, and the device check says WebGPU works but is not used for drawing. WebGPU still does the graphics-card arrangement math; the renderer code stays for the tester and tests (`NFMRender.setWebGPUDrawing(true)`). New browser-test check locks this in. Tested in: Firefox 158.0 (74 ok), ungoogled-chromium 155.0.8059.39 (94 ok), WebKitGTK 2.52.6 (83 ok), one at a time, software drawing

## 2026.10.17.0114 · 2026-10-17

### Quick
Tester fixes from the owner's 0039 laptop run: (1) a way of drawing too slow to show 3 pictures in 0.7 s (the 100,000-item case) was thrown away and mislabeled "the page was in the background"; slow ways now get up to 6 s and report their numbers, and "background" is said only when the page really is hidden.

### Details
Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Tester fixes from the owner's 0039 laptop run: (1) a way of drawing too slow to show 3 pictures in 0.7 s (the 100,000-item case) was thrown away and mislabeled "the page was in the background"; slow ways now get up to 6 s and report their numbers, and "background" is said only when the page really is hidden. (2) The drawing-time section's verdict came from the last size only, so one untimed size hid all the others; every size now reports for itself and the verdict is the worst level. (3) The graphics-card computing device from the earlier steps stayed open for the whole run (after tables of up to gigabytes); it is now closed before the drawing tests, a suspect for the 1.5 to 1.9 second freezes. (4) The hands-on picture now puts the map on the card before the first turn (as the app does) and the results file adds a plain-words count of freezes over a quarter second per way of drawing, also in the raw data. Tested in: Firefox 158.0 (quick tester run plus scripted drag and scroll), ungoogled-chromium 155.0.8059.39 (quick tester run, a deliberately slow 30,000-item drawing-time run, browser test 93 ok), WebKitGTK 2.52.6 (quick tester run); one at a time, software drawing

## 2026.10.17.0100 · 2026-10-17

### Quick
Faster tests, same checks: the browser test went from 150 s to 46 s in Chromium, from about 70 s to 27 s in Firefox and from 43 s to 35 s in WebKitGTK (pictures compared inside the page instead of sent out as numbers, a smaller sample map for the turning-on-the-card check, short pauses replaced by...

### Details
Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Faster tests, same checks: the browser test went from 150 s to 46 s in Chromium, from about 70 s to 27 s in Firefox and from 43 s to 35 s in WebKitGTK (pictures compared inside the page instead of sent out as numbers, a smaller sample map for the turning-on-the-card check, short pauses replaced by waits for the screen to really settle, a short sample for the device check). New `test/all.js` runs every Node test two at a time (about 44 s instead of about 84 s). The app gained two things only tests use: `NFM.pending()` (how many short screen-update delays are still waiting) and `window.NFM_CHECK_MS` (a shorter timing window for the device check; nothing sets it for people). Tested in: Firefox 158.0 (73 ok), ungoogled-chromium 155.0.8059.39 (93 ok), WebKitGTK 2.52.6 (82 ok), one at a time, software drawing

## 2026.10.17.0039 · 2026-10-17

### Quick
Tester: an FPS counter is always in the top strip next to the run clock (the page's own screen refresh rate, with the longest pause of the last half second), and the turning-picture counter now shows from the first frame in every mode.

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Tester: an FPS counter is always in the top strip next to the run clock (the page's own screen refresh rate, with the longest pause of the last half second), and the turning-picture counter now shows from the first frame in every mode. Tested in: ungoogled-chromium 155.0.8059.39 (tester page smoke runs, software drawing); Firefox and WebKitGTK not run for this tester-only change

## 2026.10.17.0033 · 2026-10-17

### Quick
Fix: a WebGL 2 renderer that was switched off no longer tells the manager the graphics were lost (its context is lost on purpose when it is destroyed; the late event tore down the renderer that replaced it, and three in a minute turned WebGL 2 off).

### Details
For users: Fixed a false "graphics lost" message when a WebGL 2 drawer is switched off. Tested in: FF 158, UC 155, WK 2.52.6 (FF = Firefox, UC = ungoogled Chromium).

### Deep
Fix: a WebGL 2 renderer that was switched off no longer tells the manager the graphics were lost (its context is lost on purpose when it is destroyed; the late event tore down the renderer that replaced it, and three in a minute turned WebGL 2 off). Found by the browser test once WebGL 2 became the first choice. WebKit (WebKitGTK 2.52.6) joins every test run through `bench/webkit-driver.js` (published in JS-modules as `tools/webkit-driver`). Tested in: Firefox 158.0 (73 checks), ungoogled-chromium 155.0.8059.39 (94 checks), WebKitGTK 2.52.6 (83 checks); all software drawing, one at a time

## 2026.10.16.2352 · 2026-10-16

### Quick
Tester: run clock pinned at the top of the page; live FPS counter in every viewing box. Tested in the `browsers` branch builds: ungoogled-chromium 155.0.8059.39 (tester page smoke run, software drawing); Firefox and WebKitGTK not run for this change.

### Details
Tested in: UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.2348 · 2026-10-16

### Quick
WebGL 2 first for drawing (WebGPU next); big 3D maps pre-loaded onto the card; tester backend buttons and accuracy fixes. Tested in the `browsers` branch builds: Firefox 158.0 and ungoogled-chromium 155.0.8059.39 (one at a time, software drawing only); WebKitGTK not run.

### Details
For users: WebGL 2 is tried first for drawing. Big 3D maps are loaded onto the graphics card ahead of time. Tested in: FF 158, UC 155 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.2319 · 2026-10-16

### Quick
FPS wording; no automatic scene rebuild after dragging; tester hands-on FPS meter.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.2204 · 2026-10-16

### Quick
Tester: 3D sizes 5k/25k/50k/100k, preview on the card path with a button per size, zoom in-and-out speed rows.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.2152 · 2026-10-16

### Quick
Zoom and pan a big 3D map on the card; live tester view; WebGPU default back to write.

### Details
For users: Zoom and pan a big 3D map on the graphics card. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.2019 · 2026-10-16

### Quick
Fix a WebGPU leak (destroy skipped the device); tester shows the live step on top and ends with buttons, then the turning 3D map.

### Details
For users: Fixed a graphics-memory leak when a WebGPU drawer was closed. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.0022 · 2026-10-16

### Quick
Tester: the 3D turning rows get a 24-picture warm-up, and the setup time is reported separately.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.16.0008 · 2026-10-16

### Quick
WebGPU turning: paint order goes through staging buffers by default (laptop: steady 60 at 100,000 items); old way kept as a tester comparison.

### Details
Tested in: FF 158, UC 154; its laptop figure: browser not recorded (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2357 · 2026-10-15

### Quick
Tester: the paint-order ways run three times in turn (middle run reported) and each is warmed up first.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2353 · 2026-10-15

### Quick
WebGPU: ring and staging-buffer ways to send the paint order, tester compares them; verdict no longer trusts the nothing-drawn row.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2332 · 2026-10-15

### Quick
Cut link cost (4-point strips, embedded end places); texture-based paint order option and tester way.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2310 · 2026-10-15

### Quick
WebGL 2 turning: paint order goes through three fixed buffers; tester time budget fixed.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2257 · 2026-10-15

### Quick
Tester: card time from two batch sizes; WebGL 2 loops no longer wait on the card per picture.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2245 · 2026-10-15

### Quick
Comment spelling (American English).

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2244 · 2026-10-15

### Quick
3D turning: far less work and memory per angle; tester goes to 100,000 items.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2228 · 2026-10-15

### Quick
Tester split: measure card time in batches so fixed browser waits do not count.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2216 · 2026-10-15

### Quick
Tester: take the largest 3D turning apart (angle math, card time per part, picture-time spread).

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2149 · 2026-10-15

### Quick
3D turning: the card does the math for big maps (60 fps well past 3,000 items).

### Details
For users: 3D turning: big maps run at 60 FPS well past 3,000 items. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2055 · 2026-10-15

### Quick
3D turning: build straight links straight into one shared buffer (15 -> 5 ms at 3,000 items).

### Details
For users: 3D turning builds links 3 times faster (15 to 5 ms at 3,000 items). Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2033 · 2026-10-15

### Quick
3D turning: reuse what each item and link looks like between pictures; softer Sankey loops.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2016 · 2026-10-15

### Quick
Sankey view: the improved Sankey layout in the app, with click and right-click editing (Stage 1).

### Details
For users: New Sankey view with click and right-click editing. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.2000 · 2026-10-15

### Quick
Rebuild index.html (3D force accuracy, WebGPU buffer reuse).

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1812 · 2026-10-15

### Quick
Distance error colors, 3D benchmarks, Sankey research prototype and before/after page.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1725 · 2026-10-15

### Quick
Device check times the graphics-card arrangement and says if it works and pays off; own-steps example balanced and passed through the data check; example tests.

### Details
For users: The device check times the graphics-card arrangement and says if it works and pays off. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1702 · 2026-10-15

### Quick
Graphics card in the app (best quality, with sanity check and processor fallback), first-start tuning test, example of the app's own steps.

### Details
For users: The graphics card can compute the best-quality arrangement, with a processor fallback. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1647 · 2026-10-15

### Quick
Engine hook for a picture computed elsewhere; tester runs the whole app path (card picture through the page's own overlap clean-up).

### Details
Tested in: FF 158, UC 154, FF 159 laptop (tester9) (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1504 · 2026-10-15

### Quick
Faster best quality (2-3 sweeps, tuned step) and Force arrangement fix for Firefox.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1444 · 2026-10-15

### Quick
Hop-count table 25% faster (64 searches at once, skip repeated half); plain-words arrangement advice with one-click offer of best quality.

### Details
For users: Hop-count table 25% faster. Plain-words arrangement advice with a one-click offer of best quality. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1422 · 2026-10-15

### Quick
Closeness arrangement: Stress start, then link pulls and sampled pushes; neighborhood score 1.3 to 4x the best competitor.

### Details
For users: New Closeness arrangement: neighborhoods kept 1.3 to 4 times better than the best competitor. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1409 · 2026-10-15

### Quick
Best-quality Stress about 40% faster (3 to 4 sweeps, split coordinate lists); WebGPU majorization agreement check.

### Details
For users: Best-quality arrangement about 40% faster. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1351 · 2026-10-15

### Quick
Best-quality Stress: every pair for 4,001 to 20,000 items, 32 searches at a time; neighbor-term and majorization findings.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1315 · 2026-10-15

### Quick
GIF palette samples every other pixel on big pictures; GIF profile tooling; neighborhood-preservation measure; layout-paper research notes.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1202 · 2026-10-15

### Quick
Copyright notices and credit now say LFC Foundry; record the Stress and GIF ideas tried and not kept.

### Details
Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.1130 · 2026-10-15

### Quick
Stress for 10,000+ items, no two items touch, results as columns, faster GIF and draws.

### Details
For users: Distances for 10,000+ items, no two items touch, results as columns, faster GIF and drawing. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.0953 · 2026-10-15

### Quick
Read zips, Excel and graph files; fuzz and memory-safety tests; scorecard.

### Details
For users: Reads zips, Excel files and graph files. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.0816 · 2026-10-15

### Quick
Faster CSV reading and Stress layout, benchmark suite for Firefox and Chromium.

### Details
For users: Faster CSV reading and Distances layout. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.15.0158 · 2026-10-15

### Quick
Phone and PC layout pass, faster big-network layouts, minified build.

### Details
For users: Phone and PC layouts, faster big-network layouts. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.14.2339 · 2026-10-14

### Quick
Animated states and GIF export.

### Details
For users: Animated states and GIF export. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.14.2322 · 2026-10-14

### Quick
Monte Carlo simulation in the Advanced tab.

### Details
For users: Monte Carlo simulation in the Advanced tab. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.14.2307 · 2026-10-14

### Quick
Rebuilt the app: columns workbench, rail-based Map, six tabs.

### Details
For users: Rebuilt: columns workbench, a rail-based Map, six tabs. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.

## 2026.10.14.2136 · 2026-10-14

### Quick
Net Flow Map v0: one-file app that reads data and maps it.

### Details
For users: First version: a one-file app that reads data and maps it. Tested in: FF 158, UC 154 (FF = Firefox, UC = ungoogled Chromium).

### Deep
See docs/BENCHMARKS.md and the commit of this build for the measurements and the reasons.
