# Top-down view: the new choices and what each one gives

Copyright (c) 2026 LFC Foundry. MIT License.

All the choices below are off by default (chapters fold only on very big maps, see below); with them off the picture is exactly the old one (checked on 28 pictures pinned from the old engine in `test/topdown.test.js`, and on 480 builds against the old engine while developing). Turn them on in the View panel for Flow (top to bottom) and Top-down.

| Choice (View panel) | In plain words | Engine option |
|---|---|---|
| Rows: Story order | Every page sits below all the pages that lead to it. Gold links are then real loops only. | `rows: 'story'` |
| Draw very long links as tags | A link longer than 8 rows is not drawn across the page: a short stub and a name chip at each end. Click a chip to select the link. | `tagLen: 8` |
| Keep must-pass pages in one column | The pages every route goes through share one column. | `spineCol: true` |
| Untangle harder | Six more rounds of reordering; the best order seen is kept, so it is never worse. | `better: true` |
| Cut a very tall map into columns | A map more than 2.2 times taller than wide is cut every few rows into side-by-side columns (about the shape of a screen); links between columns become tags. | `wrap: true` |
| Show step numbers down the side | "step 12" beside each row; more rows show as you zoom in. | `ruler: true` |
| One column per group (Top-down) | One band per group, left to right. | `downLanes: true` |
| Bundle links that share a start or an end (Flow, Top-down) | Links that start at the same page share one run of stand-in stops; links that end at the same page and are alone at their start share one from the end. | `bundle: true` |
| Taper links (thick at the start, thin at the end) | Links are drawn as shapes that narrow from the start to the end, so direction shows without arrowheads. Also in SVG export. | `taper: true` (scene) |
| River direction: top to bottom | River runs down the page instead of across it (hand edits stay left to right only). | `riverDir: 'TB'` (view) |
| Chapters: Auto / On / Off | On a big map, runs of pages behind a must-pass page fold into one "Chapter" box; if more than 600 boxes remain, runs of about 80 to 130 pages fold into "Part" boxes. Click a box to open it, right-click an open one to fold it back. Search and selecting a page open the box that hides it. Auto folds above 1,500 pages. | `chapters: 1500`, `openCh` |
| Mini-map (Auto / On / Off) | A small picture of the whole map in the corner with a frame for the screen; click or drag it to move. Auto shows it when the screen sees less than 70% of the map across or down. | view `minimap` |

Also a right-click item on a page: **Select every page on a route through it** (every page that can lead to it plus every page it can lead on to).

## Numbers

Test maps are seeded story-shaped maps (chapters of 2 to 4 branches that merge, side links, shortcuts, some links back) built through the full `build` path (so straight runs are folded, as in the app). Build time is the median of 5 runs after one warm-up in Node 22 on a container with about 2 effective cores; CPU ms is the processor time of the same median run. Compare ratios, not absolute times. Smaller is better in every column except Tags (a count). "Gold links" = back, sideways and tagged-back links. "Tall:wide" = height divided by width.


### Story, 201 pages

| Option | Rows | Stand-in stops | Gold links | Tags | Crossings | Width x height (px) | Tall:wide | Build time ms (median of 5) | CPU ms |
|---|---|---|---|---|---|---|---|---|---|
| today (shortest route) | 56 | 77 | 44 | 0 | 12 | 2,100 x 6,726 | 3.2 | 8 | 19 |
| + story order | 78 | 157 | 7 | 0 | 4 | 1,769 x 9,366 | 5.3 | 7 | 16 |
| + tags (links over 8 rows) | 56 | 1 | 44 | 5 | 0 | 1,642 x 6,726 | 4.1 | 4 | 12 |
| + must-pass column | 56 | 77 | 44 | 0 | 12 | 2,351 x 6,726 | 2.9 | 4 | 8 |
| + untangle harder | 56 | 77 | 44 | 0 | 12 | 2,100 x 6,726 | 3.2 | 5 | 9 |
| + cut into columns | 56 | 21 | 44 | 8 | 4 | 3,214 x 3,366 | 1.0 | 6 | 13 |
| tags + column | 56 | 1 | 44 | 5 | 0 | 1,730 x 6,726 | 3.9 | 2 | 3 |
| tags + column + columns | 56 | 1 | 44 | 10 | 0 | 3,016 x 3,366 | 1.1 | 4 | 17 |
| everything on | 78 | 42 | 7 | 14 | 2 | 3,619 x 2,406 | 0.7 | 8 | 12 |

### Story, 1,000 pages

| Option | Rows | Stand-in stops | Gold links | Tags | Crossings | Width x height (px) | Tall:wide | Build time ms (median of 5) | CPU ms |
|---|---|---|---|---|---|---|---|---|---|
| today (shortest route) | 280 | 973 | 172 | 0 | 28 | 2,681 x 33,606 | 12.5 | 12 | 17 |
| + story order | 380 | 1,575 | 16 | 0 | 20 | 2,097 x 45,606 | 21.7 | 27 | 52 |
| + tags (links over 8 rows) | 280 | 8 | 172 | 12 | 6 | 3,720 x 33,606 | 9.0 | 12 | 24 |
| + must-pass column | 280 | 973 | 172 | 0 | 28 | 1,839 x 33,606 | 18.3 | 13 | 18 |
| + untangle harder | 280 | 973 | 172 | 0 | 23 | 2,679 x 33,606 | 12.5 | 22 | 30 |
| + cut into columns | 280 | 133 | 172 | 21 | 12 | 6,124 x 8,406 | 1.4 | 18 | 26 |
| tags + column | 280 | 8 | 172 | 12 | 6 | 1,309 x 33,606 | 25.7 | 9 | 14 |
| tags + column + columns | 280 | 8 | 172 | 25 | 6 | 6,945 x 5,646 | 0.8 | 15 | 18 |
| everything on | 380 | 249 | 16 | 39 | 7 | 7,469 x 5,766 | 0.8 | 32 | 67 |

### Story, 5,002 pages

| Option | Rows | Stand-in stops | Gold links | Tags | Crossings | Width x height (px) | Tall:wide | Build time ms (median of 5) | CPU ms |
|---|---|---|---|---|---|---|---|---|---|
| today (shortest route) | 1,337 | 33,087 | 1,027 | 0 | 1,216 | 4,223 x 160,446 | 38.0 | 392 | 521 |
| + story order | 1,908 | 48,779 | 97 | 0 | 805 | 2,862 x 228,966 | 80.0 | 532 | 774 |
| + tags (links over 8 rows) | 1,337 | 11 | 1,027 | 95 | 60 | 5,816 x 160,446 | 27.6 | 60 | 96 |
| + must-pass column | 1,337 | 33,087 | 1,027 | 0 | 1,216 | 3,208 x 160,446 | 50.0 | 379 | 484 |
| + untangle harder | 1,337 | 33,087 | 1,027 | 0 | 891 | 4,071 x 160,446 | 39.4 | 651 | 767 |
| + cut into columns | 1,337 | 940 | 1,027 | 93 | 122 | 17,975 x 20,166 | 1.1 | 388 | 555 |
| tags + column | 1,337 | 11 | 1,027 | 95 | 60 | 1,913 x 160,446 | 83.9 | 54 | 82 |
| tags + column + columns | 1,337 | 11 | 1,027 | 124 | 60 | 17,389 x 13,446 | 0.8 | 114 | 161 |
| everything on | 1,908 | 1,286 | 97 | 144 | 36 | 16,874 x 13,566 | 0.8 | 198 | 298 |

### Story, 20,000 pages

| Option | Rows | Stand-in stops | Gold links | Tags | Crossings | Width x height (px) | Tall:wide | Build time ms (median of 3) | CPU ms |
|---|---|---|---|---|---|---|---|---|---|
| today (shortest route) | refused: too big | | | | | | | | |
| + story order | refused: too big | | | | | | | | |
| + tags (links over 8 rows) | 5,376 | 36 | 3,947 | 316 | 283 | 29,760 x 645,126 | 21.7 | 322 | 490 |
| + must-pass column | refused: too big | | | | | | | | |
| + untangle harder | refused: too big | | | | | | | | |
| + cut into columns | refused: too big | | | | | | | | |
| tags + column | 5,376 | 36 | 3,947 | 316 | 283 | 2,019 x 645,126 | 319.5 | 311 | 456 |
| tags + column + columns | 5,376 | 36 | 3,947 | 385 | 282 | 34,287 x 28,086 | 0.8 | 503 | 693 |
| everything on | 7,611 | 5,247 | 323 | 442 | 204 | 36,207 x 25,446 | 0.7 | 924 | 1,334 |

### Random map with no loops at all, 1,000 pages and 1,999 links (story order caveat)

| Option | Rows | Stand-in stops | Gold links | Tags | Crossings | Width x height (px) | Tall:wide | Build time ms (median of 5) | CPU ms |
|---|---|---|---|---|---|---|---|---|---|
| today (shortest route) | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 22 | 33 |
| + story order | 19 | 3,589 | 0 | 0 | 131,569 | 28,101 x 2,286 | 0.1 | 55 | 73 |
| + tags (links over 8 rows) | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 25 | 34 |
| + must-pass column | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 20 | 27 |
| + untangle harder | 12 | 531 | 851 | 0 | 85,665 | 59,980 x 1,446 | 0.0 | 49 | 62 |
| + cut into columns | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 24 | 32 |
| tags + column | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 29 | 42 |
| tags + column + columns | 12 | 531 | 851 | 0 | 90,351 | 59,772 x 1,446 | 0.0 | 29 | 36 |
| everything on | 19 | 2,763 | 0 | 90 | 101,789 | 26,902 x 2,286 | 0.1 | 111 | 119 |

### Chapters (5,002 pages and others; smaller is better except where noted)

| Map | Boxes drawn | Stand-in stops | Crossings | Width x height (px) | Build ms |
|---|---|---|---|---|---|
| 202 pages, today to folded | 135 to 110 | 77 to 77 | 12 to 5 | 2,100 x 6,726 to 1,810 x 6,726 | 7 to 4 |
| 1,002 pages | 648 to 60 | 973 to 68 | 28 to 0 | 2,681 x 33,606 to 990 x 5,166 | 18 to 4 |
| 5,002 pages | 3,267 to 88 | 33,087 to 1,697 | 1,216 to 355 | 4,223 x 160,446 to 1,019 x 9,966 | 339 to 17 |
| 5,002 pages, one part opened (129 pages) | 144 | 1,870 | 357 | 1,320 x 13,686 | 18 |
| 20,002 pages | refused to 252 | 5,915 | 3,730 | 2,106 x 20,046 | 120 |

Plain takeaway: a folded 5,002-page story draws in 17 ms instead of 339 ms and fits about one screen of boxes; opening one part costs one more 18 ms rebuild. The mini-map's first draw is 7.4 ms and each redraw 0.01 ms at 5,002 pages.

### Bundling (smaller is better)

| Map | Stand-in stops | Crossings |
|---|---|---|
| 5,002-page story | 33,087 to 30,654 (7% fewer) | 1,216 to 1,065 (12% fewer) |
| 5,002-page story, story order | 48,779 to 44,834 (8% fewer) | 805 to 721 (10% fewer) |
| 1,000 pages | 973 to 947 | 28 to 25 |
| loop-free random, 1,000 pages | 531 to 326 (39% fewer) | 90,351 to 86,508 (4% fewer) |
| 201 pages, story order | 157 to 139 | 4 to 7 (worse) |

Plain takeaway: bundling pays on big maps without tags; with tags on there is nothing left to bundle, and a small map can end with a crossing or two more, so it stays a choice.

### Tapered links and vertical River

Tapering costs about 1 ms per draw at 5,258 links (0.76, 1.12 and 1.19 ms in three runs, within noise). Vertical River swaps the picture's two directions after the layout is made, so the layout time is unchanged.

### Not adopted: straight-line placement (Brandes-Koepf)

Built and measured, then removed. It gives fewer slanted pieces (5% to 61% fewer) but more sideways drift (7% more on 201 pages, 5.7 times more on 5,002 pages) and wider maps (4,223 to 49,496 px wide at 5,002 pages), so the picture is worse where it matters. The code and tables are in `topdown-research/experiments/built/` (`bk-place.js`, `pos1.md`).

## Reading the tables

- **Tags** are the big win on large stories: on 5,002 pages the stand-in stops drop from 33,087 to 11 and the build from 392 to 60 ms (6.5 times faster); 20,000 pages, which the old drawing refuses ("too big", 558,161 stops), draw in about 0.3 s.
- **Story order** makes gold honest (1,027 to 97 on 5,002 pages) and lowers crossings on stories (1,216 to 805), but the map gets taller, and on a map with no loops at all it raises crossings (90,351 to 131,569), so it is a choice.
- **Must-pass column** only helps when the map has must-pass (choke) pages; width 5,816 to 1,913 px with tags on 5,002 pages.
- **Untangle harder** costs time (392 to 651 ms on 5,002 pages) for 27% fewer crossings there.
- **Columns** turn a strip 38 times taller than wide into a block 0.8 times as tall as wide.
- Numbers come from `node` runs of `E.build`; the browser runs (Chromium 155, Firefox 158, WebKitGTK 2.52.6, GNOME Web 46.5) check behavior, not timing.
