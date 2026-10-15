# Net Flow Map

Copyright (c) 2026 LFC Foundry. MIT License. Forged by LFC Foundry.

One file, `index.html`, that works offline. Bring in a table, a JSON graph, an outline, or a folder of notes, and see how everything connects. It has six tabs:

- **Data**: drop in files or a folder (or paste text), see in plain words what was found, and use the columns workbench: every column with its type and what it does on the map (color, size, line width, labels, filters), plus calculated columns. If the data holds the same network at several times, a States card turns one column per state (or a column naming the state on repeated links) into baseline / year 1 / year 2 / end state.
- **Nodes**: the items and links as tables you can sort, filter, edit, add to, and delete from.
- **Map**: (with states: a timeline under the picture to play, pause or drag through them) nine views, a network view with several arrangements (including 3D you can turn), a floating key you can drag and edit, search, strongest-links slider, facets, route lighting, box and lasso selection, hand-moved items, right-click menus, formatting rules for items and links, saved views, and a poster print.
- **Check**: findings about the data, each with a plain-words reason, a way to see it on the map or in the table, and a fix where one is safe.
- **Advanced**: the Monte Carlo simulation (up to 100,000 walkers; start items, walker types, 16 distributions for arrivals, uncertain link weights, link costs and dwell times; exact odds with error bars beside the dice; step, cost and settling charts; what-if ranking of items or links; results as map color and link width, with optional flow dots), layout settings, and the one-button device check.
- **Export**: JSON, CSV, SVG, PNG, poster, the check report, saved views, an animated GIF for slides (plays through the states with a smooth change between them, or turns a 3D view around), and a one-page HTML report with the animation inside.

Nothing is uploaded. Everything runs in the page.

## What it reads

| You bring | It understands |
|---|---|
| CSV, TSV, semicolon or bar tables | A list of links (from, to, weight, label, kind, groups), items with a column that lists their links, items with a parent column, or a grid (adjacency matrix). It guesses; you can change the guess. |
| JSON | `nodes` + `links` or `edges`, Cytoscape.js, JSON Canvas, story projects (`passages` with `choices`), lists of links, `name: [targets]` lists |
| Outlines | Indented or bulleted lists, Markdown headings; `[[wiki links]]` inside lines add cross links |
| Excel (.xlsx) | Every sheet is read as its own table (dates become dates) and the sheets are merged by name, so a sheet of links and a sheet describing the items work together |
| Graph files | GraphML (including yEd labels), GEXF (Gephi), GML and Graphviz DOT (clusters become groups) |
| Zip files | A zip of any of the above, in any mix, folders and zips inside zips included; opened with safety limits (see `docs/BENCHMARKS.md`, section 9) |
| Markdown notes | Several files or a whole folder (Obsidian style): `[[links]]`, `[text](note.md)` links, aliases, tags, folders; links to notes that do not exist become placeholders |
| Arrow lines | `A -> B : label`, and simple Graphviz DOT |

Every import ends with a short report of what was kept, merged, skipped or shortened.

## The nine views

Flow, Top-down, Choke-point spine, Lanes (one band per group), Shape (the stretches between choke points), River (bands as wide as the number of players who take them), Arc, Matrix, and Network (for data that is not a story).

## How it draws

The map is drawn by WebGPU if this browser can really use it, otherwise WebGL 2, otherwise basic 2D drawing. "Can really use it" means a small test runs at startup (it does not just ask the browser what it claims). All three draw the same picture (they agree to within about 0.2 out of 255 on average). The layout work runs in a background helper so big maps do not freeze the page. The **Check this device** button runs all of this again, times a large map, and says in plain words what to expect.

## No two items touch

Most layout tools place points. d3-force and ForceAtlas2 do not know how big an item is, so at the sizes this app draws, **70 to 100% of their items end up on top of another item** (ForceAtlas2 on a plain tree: 9%). Every network arrangement here ends with a step that guarantees that **no two items touch**: push-apart passes, then (if a pair still touches) a stretch of the whole picture, which does not change how true it is, then each leftover item moves to the nearest free spot. A test checks it (`test/layout.test.js`), and 40 layouts per browser were checked in Chromium and Firefox.

| 5,000 items, moderate network (Node, one run) | Time | Truth (lower = truer) | Items touching |
|---|---:|---:|---:|
| **Ours (Stress)** | **0.8 s** | 0.198 | **0%** |
| d3-force | 11 s | 0.182 | 98.5% |
| d3-force + forceCollide | 16 s | 0.182 | 12% |
| ForceAtlas2 | 9.8 s | 0.183 | 98% |

That guarantee costs a little truth (the score ignores item size, so it favors the others), and the benchmarks count ours with that cost included. Through 3,000 items ours is still the truest; at 10,000 items it is 10% truer to 9% less true than d3-force. `docs/BENCHMARKS.md` section 12 has the full table, how it was measured, and what the numbers do not show; `docs/RESEARCH-r-packages.md` compares the same problem across R packages.

## Build and test

```
node tools/build.mjs                 # writes a minified index.html (version stamp year.month.day.HHMM, US Eastern); needs esbuild
node tools/build.mjs --dev           # readable, larger file
node tools/build.mjs --pack          # also writes index.packed.html, a self-extracting copy (our lzma-pack module) for downloads outside git
node test/archive.test.js            # zips, Excel and graph files, including zip bombs, bad checksums and cut-off files
node --expose-gc test/fuzz.test.js 90  # about 90 s of random and hostile input, layout shapes, dense links and leak loops
node test/importers.test.js          # 19 quick checks of the readers, including 6,000 random tables against a plain reader
node test/layout.test.js             # network layouts must leave no two items touching (the guarantee above)
node test/pack.test.js               # a layout sent from the helper to the page comes back exactly as the engine made it
node test/gif.test.js && node test/sim.test.js   # GIF writer (byte-identical fast path) and the random draws
node bench/overlap.js moderate 1000 3000 5000    # Node only: items left touching, ours against d3-force and ForceAtlas2 (needs bench/npm install)
node test/oracle.test.mjs            # new engine versus the older story-map package, 40 random stories
node test/limits.test.js             # a 20,000-page chain, 1,500 stacked diamonds, a 3,000-item network
node test/browser.test.js chromium   # real browser run (see the file header for the browser programs it needs)
node test/browser.test.js firefox    # add NFM_HEADFUL=1 NFM_STRICT=1 NFM_VK_ICD=<a vk_*_icd.json> under xvfb-run to also run WebGL 2 and WebGPU in Firefox
sh tools/hooks/install.sh            # once per clone: house-rule commit hooks
```

## Files

- `src/engine.js`: layouts, choke points, traffic, exact odds, network layout, scores (no page needed)
- `src/importers.js`: everything that reads data
- `src/scene.js`: turns a layout into drawing lists (also writes the SVG)
- `src/render.js`: the three drawing backends
- `src/probe.js`: the startup test and the one-button device check
- `src/engine-client.js`: runs the engine in a background helper, with a fallback
- `src/columns.js`, `src/sim.js`, `src/check.js`: column types, calculated columns and states, the walker simulation, the data checks
- `src/gif.js`: the animated GIF writer (palette, frame differencing, LZW)
- `src/pack.js`: sends a big layout from the helper to the page as typed-array columns instead of copying every object
- `src/app/*.js` (joined in file-name order into one function), `src/app.css`, `src/index.template.html`: the page (00 core, 10 data, 20 nodes, 30 map, 32 interact, 35 rail, 40 states, 50 check, 60 advanced, 61 simulation, 70 export, 72 gif, 99 boot)
- `vendor/`: `env-probes.js` and `back-close.js` from [JS-modules](https://github.com/JNFoo/JS-modules); `story-map.global.js` is only the test oracle, it is not shipped in `index.html`

## Known limits

- Good and bad marks apply to endings (items with no way on).
- Link weights act as odds only when "Use link weights" is on.
- In loops, the map shows expected visits per player, not "share of players who saw it".
- A layered view stops above 90,000 stops and says so; use Network or Matrix instead.
- Not yet run on a phone (test phone) or on a real graphics chip. The tests ran on Firefox 158 and ungoogled-chromium 154 with WebGPU, WebGL 2 and basic drawing all matching to about 0.2 out of 255.

## Benchmarks

`bench/` runs the same jobs in Firefox and ungoogled-chromium against Papa Parse, d3-force, ForceAtlas2, dagre, ELK, Louvain, expr-eval, gifenc and more, up to 1,000,000 items. Results and findings are in `docs/BENCHMARKS.md`; the raw numbers are in `bench/results/`. `node bench/report.js` rebuilds the tables.


Headlines (both browsers; `docs/BENCHMARKS.md` has every table, the losses included):

- Stress layout: 2.4 to 12× faster than d3-force up to 3,000 items and 14 to 23× faster at 10,000, truer through 3,000 items, and the only one of the three with no overlapping items (section 12). At 10,000 items it is 10% truer to 9% less true than d3-force.
- Best-quality Stress (choose "Distances, best quality (slower)" in the Arrangement list): for 4,001 to 20,000 items it uses every pair of items. At 10,000 items it is 9 to 32% truer than d3-force and ForceAtlas2 and 2.9 to 4.8× faster than the faster of them (5 to 8 s), with no overlaps; the normal Stress arrangement stays the quick default (1.5 s, about 0.20). Section 16.
- Sending a big layout from the helper to the page as columns: 2.5× faster end to end at 100,000 items in Chromium (1.8× in Firefox). Section 14.
- GIF export: 10 to 16× lower color error than gifenc; 1.24× (Chromium) to 1.5× (Firefox) faster at 31 frames; level with it at 4 frames in Firefox and 1.8× slower in Chromium; files 6 to 8% larger. Section 14.
- Where Stress is weaker: on neighborhood preservation (are my linked items the ones nearest to me?) it scores below d3-force and ForceAtlas2, because it follows distances, not closeness. Pick Force or Stress for the question you are asking. Section 15. Four ways of adding a closeness term to Stress were tried and none helped (section 13).
- Random draws: faster in every Chromium row (normal 2.3 to 2.5×); in Firefox a tie or a small loss on normal draws. Section 14.
- Methods read from the recent layout papers: `docs/RESEARCH-layout-papers.md`.
- Methods read from the R packages `graphlayouts`, `igraph`, `packcircles` and `ggrepel`, and what was tried from them: `docs/RESEARCH-r-packages.md`.
