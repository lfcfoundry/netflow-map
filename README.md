# Net Flow Map

Copyright (c) 2026 JNFoo. MIT License.

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
| Markdown notes | Several files or a whole folder (Obsidian style): `[[links]]`, `[text](note.md)` links, aliases, tags, folders; links to notes that do not exist become placeholders |
| Arrow lines | `A -> B : label`, and simple Graphviz DOT |

Every import ends with a short report of what was kept, merged, skipped or shortened.

## The nine views

Flow, Top-down, Choke-point spine, Lanes (one band per group), Shape (the stretches between choke points), River (bands as wide as the number of players who take them), Arc, Matrix, and Network (for data that is not a story).

## How it draws

The map is drawn by WebGPU if this browser can really use it, otherwise WebGL 2, otherwise basic 2D drawing. "Can really use it" means a small test runs at startup (it does not just ask the browser what it claims). All three draw the same picture (they agree to within about 0.2 out of 255 on average). The layout work runs in a background helper so big maps do not freeze the page. The **Check this device** button runs all of this again, times a large map, and says in plain words what to expect.

## Build and test

```
node tools/build.mjs                 # writes index.html (version stamp year.month.day.HHMM, US Eastern)
node test/importers.test.js          # 17 quick checks of the readers
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
- `src/app/*.js` (joined in file-name order into one function), `src/app.css`, `src/index.template.html`: the page (00 core, 10 data, 20 nodes, 30 map, 32 interact, 35 rail, 40 states, 50 check, 60 advanced, 61 simulation, 70 export, 72 gif, 99 boot)
- `vendor/`: `env-probes.js` and `back-close.js` from [JS-modules](https://github.com/JNFoo/JS-modules); `story-map.global.js` is only the test oracle, it is not shipped in `index.html`

## Known limits

- Good and bad marks apply to endings (items with no way on).
- Link weights act as odds only when "Use link weights" is on.
- In loops, the map shows expected visits per player, not "share of players who saw it".
- A layered view stops above 90,000 stops and says so; use Network or Matrix instead.
- Not yet run on a phone (Pixel 7 Pro) or on a real graphics chip. The tests ran on Firefox 158 and ungoogled-chromium 154 with WebGPU, WebGL 2 and basic drawing all matching to about 0.2 out of 255.
