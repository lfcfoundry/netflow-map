# Changelog

Copyright (c) 2026 LFC Foundry. MIT License.

What changed in Netflow Map, in plain words, newest first. Each build is stamped `year.month.day.HHMM` (US Eastern) in the page header. This is the short list for people who use the app. The long version for each build (every measurement, test count and tool change) is kept in the private knowledge base, under `projects/netflow-map/changelogs/`.

Tested one browser at a time in Firefox 158.0, ungoogled-chromium 155.0.8059.39, WebKitGTK 2.52.6 and GNOME Web 46.5. Not tested for any build: Safari itself, any iPhone, Chrome on a phone.

## October 22

- **2026.10.22.1845** Flow, Down, Spine and Lanes layouts of a few thousand pages are built faster, and the pictures are exactly the same. The layered drawing is now netflow-layers 1.3.1. First layout of a 3,000-page map (lower is better): Chromium 447 to 248 ms (1.8 times faster, higher is better), Firefox 551 to 294 ms (1.9 times), WebKitGTK 469 to 211 ms (2.2 times), GNOME Web 454 to 215 ms (2.1 times); a 1,000-page map is 1.5 to 1.7 times faster, and a plain 20,000-page tree 1.1 to 1.2 times. The page file grows 0.19% (999,600 to 1,001,498 bytes).
- **2026.10.22.1253** Letting go of an item you moved on a big Network map no longer freezes the page. Before, the drop built the whole picture again; now it only refreshes the outer box, the click grid and the link hover, and the picture is identical. Main-thread time of the drop on a 10,000-item map with 31,026 links (lower is better): Chromium 106.8 to 2.3 ms (46 times faster, higher is better), Firefox 203 to 3 ms (68 times), WebKitGTK 84 to 19 ms (4.4 times), GNOME Web 84 to 20 ms (4.2 times). The page file grows 0.08% (998,834 to 999,600 bytes).
- **2026.10.22.1227** The first grab of an item on a big Network map no longer stalls. Before, picking up an item on a map with tens of thousands of links first unpacked the whole stored link list; now the app moves the links in place and the list stays packed. Main-thread time for the first move on a 10,000-item map with 31,026 links (lower is better): Chromium 18.9 to 8.4 ms (2.2 times faster, higher is better), Firefox 20.0 to 6.0 ms (3.3 times), WebKitGTK 30 to 23 ms (1.3 times), GNOME Web 28 to 24 ms (1.2 times). Later moves are unchanged and pictures are identical. The page file grows 0.1% (997,825 to 998,834 bytes).

## October 18

- **2026.10.18.2342** Moving an item by hand on a big Network map is much faster: only the item and its links are redrawn, and the picture is identical. Time per move on a 10,000-item map with 31,026 links (lower is better): Chromium 50.8 to 3.4 ms (14.9 times faster, higher is better), Firefox 106 to 3.0 ms (35.3 times), WebKitGTK 50 to 18 ms (2.8 times), GNOME Web 59 to 19 ms (3.1 times). Distances keeps its faster two-pair math above 20,000 items too (1.02 to 1.10 times faster at 30,000 and 60,000 items). The Sankey view uses netflow-sankey 2.3.0 (same pictures, no measurable change in speed on the stories tried). The smallest copy opens 1.18 to 1.32 times sooner (Chromium 140 to 106 ms, Firefox 183 to 155 ms, WebKitGTK 144 to 111 ms, GNOME Web 151 to 122 ms; lower is better). The page file grows 2.4% (974,757 to 997,825 bytes).
- **2026.10.18.2137** The copy to hand out now opens as fast as the page itself. `node tools/build.mjs --pack` also writes a fast-opening copy (the browser's own unpacker, 366 KB) next to the smallest-file LZMA copy (322 KB): ready in 66 to 116 ms instead of 145 to 187 ms, which is 1.6 to 2.2 times faster in all four test browsers (lower is better). The app itself is unchanged.
- **2026.10.18.2127** Big Network maps now come back much faster the second time. A map of 1,500 items or more that you opened before is put back from this browser's own storage instead of being arranged again: 2.4 to 14.9 times faster in all four test browsers (higher is better), with exactly the same picture (3,000 items: 55 to 72 ms instead of 670 to 900 ms). The first time a map is opened costs about 3% more (up to 12%). Nothing leaves your computer; the Advanced tab has a switch and a "Forget saved pictures" button. The Distances arrangement is also 1.0 to 1.4 times faster up to 20,000 items (two pairs of items at a time, same picture). The page file grows 1.0% (974,757 bytes).
- **2026.10.18.2021** The flat Force arrangement is faster and truer on big maps (5,000 up to 20,000 items): it now starts from the Distances picture. Layout takes 1.5 to 2.4 times less time in all four test browsers (higher is better), and the hop error at 10,000 items drops from 0.265 to 0.168 (lower is truer). Force pictures change at those sizes; smaller and bigger maps are as before.
- **2026.10.18.1951** More of the layout work now runs as WebAssembly, with plain JavaScript kept as the backup. Pictures are the same. Circle at 30,000 items is 1.7 to 2.8 times faster in all four test browsers; Distances 3D at 3,000 and at 30,000 items is 1.0 to 1.8 times faster; Closeness at 20,000 items and more is 1.1 to 1.5 times faster (higher is better; smaller maps stay on JavaScript, where the gain was not clear).
- **2026.10.18.1823** New arrangement: Distances 3D. The Network view can now lay a map out in 3D with the Distances method (turn it by dragging). Compared with the flat Distances it is truer at every size (hop error 0.117 against 0.177 at 30,000 items; lower is truer) and builds in 0.9 s at 30,000 items, 3.2 times faster than 3D force.
- **2026.10.18.1411** The Sankey view now uses the shared netflow-sankey module (2.2.1). Pictures are the same. The page file grows 0.8%.
- **2026.10.18.1259** New Spacing switch for Flow, Top-down, Spine and Lanes: Tight (as before) or Wide (looser, more tree-like, easier to read on a wide screen).
- **2026.10.18.1246** Sankey on a big network no longer shows "NaN" for its crossing count.
- **2026.10.18.1220** The old flow view is now called Sankey everywhere. Views saved under the old name open in the default view.
- **2026.10.18.1149** A page that never packs its memory now saves about 5.8 MB (14.96 to 9.12 MB; lower is better).
- **2026.10.18.1101** The layout worker warms up while idle. First layout of a 3,000-item map: Chromium 1,029 to 833 ms, Firefox 1,047 to 863 ms (about 1.2 times faster; lower is better).
- **2026.10.18.0830** Firefox no longer logs a blocked-code error when a big map is packed.
- **2026.10.18.0032** A big map's link list is packed while the map sits idle. Memory in Chromium (lower is better): 30,000 items 101.8 to 93.1 MB (8.5% less); 100,000 items 331.5 to 295.7 MB (10.8% less).

## October 17

- **2026.10.17.2238** Hovering over links on a big map uses far less memory: 30,000 items +142 MB to +31 MB, and the first hover takes about 0.3 s instead of 3.5 s in Chromium.
- **2026.10.17.2203** Idle links of a big map take about 93 bytes each instead of 340. At 100,000 items Chromium holds 402 to 335 MB (17% less).
- **2026.10.17.2134** An idle layout worker now rests on maps of 20,000 items or more and gives its memory back (about 38 MB at 100,000 items in Firefox). The next layout takes about 1 s longer to restart it. Frame rate is written "FPS" everywhere.
- **2026.10.17.2058** Flow, Top-down, Spine, Lanes, Sankey, Arc and Matrix now draw from the shared netflow-layers module. Pictures are the same.
- **2026.10.17.2015** Top-down: chapters fold big maps into boxes you can open (5,002 pages: 3,267 boxes down to 88, crossings 1,216 to 355). A mini-map shows the whole map. Optional bundled and tapered links.
- **2026.10.17.1830** Top-down: seven new choices, all off until you turn them on. For example, very long links can be drawn as short tags (a 5,002-page story builds 6.5 times faster; a 20,000-page story that was refused now draws in 322 ms).
- **2026.10.17.1651** Big maps (40,000 items or more) show a rough picture about twice as soon (100,000 items: 6.3 s down to 2.8 s). The finished picture arrives about 1 s later.
- **2026.10.17.1612** Big networks lay out faster and truer: 10,000 items in 397 ms in Chromium (was 643 ms), with a better truth score (0.173 against D3 force's 0.190; lower is better).
- **2026.10.17.1531** Truer big networks: the Distances arrangement now starts from a shrunken copy of the map. At 10,000 items it is truer than D3 force in all four browsers.
- **2026.10.17.1540** Every Netflow Map page now allows WebAssembly and nothing looser.
- **2026.10.17.1435** Moved to the LFC Foundry organization and renamed Netflow Map.
- **2026.10.17.1424** The Distances arrangement runs in WebAssembly, 1.0 to 2.2 times faster from 3,000 to 30,000 items, and its pair lists take 37.5% less memory. Pictures are the same.
- **2026.10.17.1256** The Force arrangement runs in WebAssembly: 10,000 items in Chromium 4,734 to 2,223 ms (2.1 times faster), 1.4 to 1.6 times in the other browsers. Same positions as before.
- **2026.10.17.0403** Repeated links now add their weights together. Links with weight 0 or less are left out with a note. Hiding a group no longer recolors the others.
- **2026.10.17.0351** Many import fixes: numbers like 1.637 and 1,637 read correctly, odd dates and numbers, and files that hung or were cut now say so. Also fixes in the layout, simulator, Sankey and SVG export.
- **2026.10.17.0119** The app no longer draws with WebGPU, because it caused random freezes of 1.5 to 1.9 seconds. WebGL 2 (then basic drawing) is used instead.
- **2026.10.17.0033** Fixed a false "graphics lost" message when a WebGL 2 drawer is switched off.

## October 16

- **2026.10.16.2348** WebGL 2 is tried first for drawing. Big 3D maps are loaded onto the graphics card ahead of time.
- **2026.10.16.2152** Zoom and pan a big 3D map on the graphics card.
- **2026.10.16.2019** Fixed a graphics-memory leak when a WebGPU drawer was closed.

## October 15

- **2026.10.15.2149** 3D turning: big maps run at 60 FPS well past 3,000 items.
- **2026.10.15.2055** 3D turning builds links 3 times faster (15 to 5 ms at 3,000 items).
- **2026.10.15.2016** New Sankey view with click and right-click editing.
- **2026.10.15.1725** The device check times the graphics-card arrangement and says if it works and pays off.
- **2026.10.15.1702** The graphics card can compute the best-quality arrangement, with a processor fallback.
- **2026.10.15.1444** Hop-count table 25% faster. Plain-words arrangement advice with a one-click offer of best quality.
- **2026.10.15.1422** New Closeness arrangement: neighborhoods kept 1.3 to 4 times better than the best competitor.
- **2026.10.15.1409** Best-quality arrangement about 40% faster.
- **2026.10.15.1130** Distances for 10,000+ items, no two items touch, results as columns, faster GIF and drawing.
- **2026.10.15.0953** Reads zips, Excel files and graph files.
- **2026.10.15.0816** Faster CSV reading and Distances layout.
- **2026.10.15.0158** Phone and PC layouts, faster big-network layouts.

## October 14

- **2026.10.14.2339** Animated states and GIF export.
- **2026.10.14.2322** Monte Carlo simulation in the Advanced tab.
- **2026.10.14.2307** Rebuilt: columns workbench, a rail-based Map, six tabs.
- **2026.10.14.2136** First version: a one-file app that reads data and maps it.
