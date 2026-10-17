# Changelog

Copyright (c) 2026 LFC Foundry. MIT License.

Net Flow Map is one self-contained page, `index.html`. Each build is stamped `year.month.day.HHMM` (US Eastern) in the page header. This file lists every build in plain words and says **which browsers it was tested in**.

## Browsers used in testing

| Where | Browser | What it ran | Where it is recorded |
|---|---|---|---|
| Cloud container, headless, by script | **Firefox 158.0** (driven with Puppeteer over WebDriver BiDi; WebGL 2 and WebGPU through software drawing) | `test/browser.test.js firefox`, the benchmark suite (192 of the 432 saved records) | `bench/results/firefox-*.jsonl` (`"browser":"firefox/158.0"`), `README.md` Known limits, `AGENTS.md` Targets |
| Cloud container, headless, by script | **ungoogled-chromium 154.0.8037.97** (driven with Playwright) | `test/browser.test.js chromium`, the benchmark suite (240 of the 432 records) | `bench/results/chromium-*.jsonl` (`"browser":"chromium 154.0.8037.97"`), `README.md` Known limits |
| The owner's Windows laptop (Ryzen 7 8845HS, Radeon 780M graphics, 14 GB), by hand | **Firefox 159.0** | the one-page tester (`bench/net-flow-map-tester.html`), 8 runs on 2026-10-15 | `bench/results/laptop-8845HS-780M-firefox159-tester*.md` (the page prints its browser) |

The repository does not log which build each test run used. What it does show is that this same setup (Firefox 158 and ungoogled-chromium 154 in the container) is the one named in the README of the very first build (2026.10.14.2136) and in `test/browser.test.js` from the first benchmark build (2026.10.15.0816) on, so every build below counts as tested in **Firefox 158 and ungoogled-chromium 154**. If the ungoogled build is missing, `test/browser.test.js` falls back to Playwright's stock Chromium 1194 (about version 141); the saved benchmark records name only the ungoogled build.

**Not yet used for any build:** ungoogled Chromium 155, WebKitGTK 2.52.6 / GNOME Web 46.5 (the new test browsers on the `browsers` branch of the private knowledgebase), Safari or any iPhone, and Chrome on the Pixel 7 Pro. The first build tested with them will say so here.

**Rule from now on (the owner, 2026-10-17):** test only with the browsers on the `browsers` branch of the private knowledgebase (Firefox 158, ungoogled-chromium 155, WebKitGTK 2.52.6 / GNOME Web 46.5), one at a time, with the version labeled. Re-read that branch's README before each test run, because versions can change or a browser can be added or removed. Every new entry below names the browsers (with versions) the build was tested in, and the ones it was not.

## Laptop runs (by hand, Firefox 159.0)

Each run is the tester page opened on the laptop; the page prints its own version and browser.

| Tester version | Date and time (UTC) | Result file |
|---|---|---|
| 2026.10.15.1541 | 2026-10-15 19:44 | `bench/results/laptop-8845HS-780M-firefox159-tester1.md` |
| 2026.10.15.1554 | 2026-10-15 19:55 | `bench/results/laptop-8845HS-780M-firefox159-tester2.md` |
| 2026.10.15.1601 | 2026-10-15 20:05 | `bench/results/laptop-8845HS-780M-firefox159-tester4.md` |
| 2026.10.15.1608 | 2026-10-15 20:12 | `bench/results/laptop-8845HS-780M-firefox159-tester5.md` |
| 2026.10.15.1614 | 2026-10-15 20:16 | `bench/results/laptop-8845HS-780M-firefox159-tester6.md` |
| 2026.10.15.1625 | 2026-10-15 20:29 | `bench/results/laptop-8845HS-780M-firefox159-tester7.md` |
| 2026.10.15.1641 | 2026-10-15 20:45 | `bench/results/laptop-8845HS-780M-firefox159-tester8.md` |
| 2026.10.15.1647 | 2026-10-15 20:49 | `bench/results/laptop-8845HS-780M-firefox159-tester9.md` |

The 2026.10.15.1647 run is of the same build as the app build of that stamp below. The earlier tester stamps are tester-page builds with no matching app build. Laptop runs after 2026-10-15 are not saved in the repository, so some entries below that quote laptop numbers (for example "laptop: steady 60 at 100,000 items") name no browser version; they are marked "browser not recorded".

## Builds

Newest last. "Tested in" is **FF 158** (Firefox 158.0) and **UC 154** (ungoogled-chromium 154.0.8037.97) in the container, plus **FF 159 laptop** where a laptop run of that build exists. The "What changed" text is the build's commit message; the numbers in it were measured when it was written and the details are in `docs/BENCHMARKS.md`.

| Build | What changed | Tested in |
|---|---|---|
| 2026.10.14.2136 | Net Flow Map v0: one-file app that reads data and maps it | FF 158, UC 154 |
| 2026.10.14.2307 | Rebuilt the app: columns workbench, rail-based Map, six tabs | FF 158, UC 154 |
| 2026.10.14.2322 | Monte Carlo simulation in the Advanced tab | FF 158, UC 154 |
| 2026.10.14.2339 | Animated states and GIF export | FF 158, UC 154 |
| 2026.10.15.0158 | Phone and PC layout pass, faster big-network layouts, minified build | FF 158, UC 154 |
| 2026.10.15.0816 | Faster CSV reading and Stress layout, benchmark suite for Firefox and Chromium | FF 158, UC 154 |
| 2026.10.15.0953 | Read zips, Excel and graph files; fuzz and memory-safety tests; scorecard | FF 158, UC 154 |
| 2026.10.15.1130 | Stress for 10,000+ items, no two items touch, results as columns, faster GIF and draws | FF 158, UC 154 |
| 2026.10.15.1202 | Copyright notices and credit now say LFC Foundry; record the Stress and GIF ideas tried and not kept | FF 158, UC 154 |
| 2026.10.15.1315 | GIF palette samples every other pixel on big pictures; GIF profile tooling; neighborhood-preservation measure; layout-paper research notes | FF 158, UC 154 |
| 2026.10.15.1351 | Best-quality Stress: every pair for 4,001 to 20,000 items, 32 searches at a time; neighbor-term and majorization findings | FF 158, UC 154 |
| 2026.10.15.1409 | Best-quality Stress about 40% faster (3 to 4 sweeps, split coordinate lists); WebGPU majorization agreement check | FF 158, UC 154 |
| 2026.10.15.1422 | Closeness arrangement: Stress start, then link pulls and sampled pushes; neighborhood score 1.3 to 4x the best competitor | FF 158, UC 154 |
| 2026.10.15.1444 | Hop-count table 25% faster (64 searches at once, skip repeated half); plain-words arrangement advice with one-click offer of best quality | FF 158, UC 154 |
| 2026.10.15.1504 | Faster best quality (2-3 sweeps, tuned step) and Force arrangement fix for Firefox | FF 158, UC 154 |
| 2026.10.15.1647 | Engine hook for a picture computed elsewhere; tester runs the whole app path (card picture through the page's own overlap clean-up) | FF 158, UC 154, FF 159 laptop (tester9) |
| 2026.10.15.1702 | Graphics card in the app (best quality, with sanity check and processor fallback), first-start tuning test, example of the app's own steps | FF 158, UC 154 |
| 2026.10.15.1725 | Device check times the graphics-card arrangement and says if it works and pays off; own-steps example balanced and passed through the data check; example tests | FF 158, UC 154 |
| 2026.10.15.1812 | Distance error colors, 3D benchmarks, river (Sankey) research prototype and before/after page | FF 158, UC 154 |
| 2026.10.15.2000 | Rebuild index.html (3D force accuracy, WebGPU buffer reuse) | FF 158, UC 154 |
| 2026.10.15.2016 | River view: the improved Sankey layout in the app, with click and right-click editing (Stage 1) | FF 158, UC 154 |
| 2026.10.15.2033 | 3D turning: reuse what each item and link looks like between pictures; softer River loops | FF 158, UC 154 |
| 2026.10.15.2055 | 3D turning: build straight links straight into one shared buffer (15 -> 5 ms at 3,000 items) | FF 158, UC 154 |
| 2026.10.15.2149 | 3D turning: the card does the math for big maps (60 fps well past 3,000 items) | FF 158, UC 154 |
| 2026.10.15.2216 | Tester: take the largest 3D turning apart (angle math, card time per part, picture-time spread) | FF 158, UC 154 |
| 2026.10.15.2228 | Tester split: measure card time in batches so fixed browser waits do not count | FF 158, UC 154 |
| 2026.10.15.2244 | 3D turning: far less work and memory per angle; tester goes to 100,000 items | FF 158, UC 154 |
| 2026.10.15.2245 | Comment spelling (American English) | FF 158, UC 154 |
| 2026.10.15.2257 | Tester: card time from two batch sizes; WebGL 2 loops no longer wait on the card per picture | FF 158, UC 154 |
| 2026.10.15.2310 | WebGL 2 turning: paint order goes through three fixed buffers; tester time budget fixed | FF 158, UC 154 |
| 2026.10.15.2332 | Cut link cost (4-point strips, embedded end places); texture-based paint order option and tester way | FF 158, UC 154 |
| 2026.10.15.2353 | WebGPU: ring and staging-buffer ways to send the paint order, tester compares them; verdict no longer trusts the nothing-drawn row | FF 158, UC 154 |
| 2026.10.15.2357 | Tester: the paint-order ways run three times in turn (middle run reported) and each is warmed up first | FF 158, UC 154 |
| 2026.10.16.0008 | WebGPU turning: paint order goes through staging buffers by default (laptop: steady 60 at 100,000 items); old way kept as a tester comparison | FF 158, UC 154; its laptop figure: browser not recorded |
| 2026.10.16.0022 | Tester: the 3D turning rows get a 24-picture warm-up, and the setup time is reported separately | FF 158, UC 154 |
| 2026.10.16.2019 | Fix a WebGPU leak (destroy skipped the device); tester shows the live step on top and ends with buttons, then the turning 3D map | FF 158, UC 154 |
| 2026.10.16.2152 | Zoom and pan a big 3D map on the card; live tester view; WebGPU default back to write | FF 158, UC 154 |
| 2026.10.16.2204 | Tester: 3D sizes 5k/25k/50k/100k, preview on the card path with a button per size, zoom in-and-out speed rows | FF 158, UC 154 |
| 2026.10.16.2319 | FPS wording; no automatic scene rebuild after dragging; tester hands-on FPS meter | FF 158, UC 154 |
| 2026.10.16.2348 | WebGL 2 first for drawing (WebGPU next); big 3D maps pre-loaded onto the card; tester backend buttons and accuracy fixes. Tested in the `browsers` branch builds: Firefox 158.0 and ungoogled-chromium 155.0.8059.39 (one at a time, software drawing only); WebKitGTK not run | FF 158, UC 155 |
| 2026.10.16.2352 | Tester: run clock pinned at the top of the page; live FPS counter in every viewing box. Tested in the `browsers` branch builds: ungoogled-chromium 155.0.8059.39 (tester page smoke run, software drawing); Firefox and WebKitGTK not run for this change | UC 155 |
| 2026.10.17.0033 | Fix: a WebGL 2 renderer that was switched off no longer tells the manager the graphics were lost (its context is lost on purpose when it is destroyed; the late event tore down the renderer that replaced it, and three in a minute turned WebGL 2 off). Found by the browser test once WebGL 2 became the first choice. WebKit (WebKitGTK 2.52.6) joins every test run through `bench/webkit-driver.js` (published in JS-modules as `tools/webkit-driver`). Tested in: Firefox 158.0 (73 checks), ungoogled-chromium 155.0.8059.39 (94 checks), WebKitGTK 2.52.6 (83 checks); all software drawing, one at a time | FF 158, UC 155, WK 2.52.6 |
| 2026.10.17.0039 | Tester: an FPS counter is always in the top strip next to the run clock (the page's own screen refresh rate, with the longest pause of the last half second), and the turning-picture counter now shows from the first frame in every mode. Tested in: ungoogled-chromium 155.0.8059.39 (tester page smoke runs, software drawing); Firefox and WebKitGTK not run for this tester-only change | UC 155 |
| 2026.10.17.0100 | Faster tests, same checks: the browser test went from 150 s to 46 s in Chromium, from about 70 s to 27 s in Firefox and from 43 s to 35 s in WebKitGTK (pictures compared inside the page instead of sent out as numbers, a smaller sample map for the turning-on-the-card check, short pauses replaced by waits for the screen to really settle, a short sample for the device check). New `test/all.js` runs every Node test two at a time (about 44 s instead of about 84 s). The app gained two things only tests use: `NFM.pending()` (how many short screen-update delays are still waiting) and `window.NFM_CHECK_MS` (a shorter timing window for the device check; nothing sets it for people). Tested in: Firefox 158.0 (73 ok), ungoogled-chromium 155.0.8059.39 (93 ok), WebKitGTK 2.52.6 (82 ok), one at a time, software drawing | FF 158, UC 155, WK 2.52.6 |
| 2026.10.17.0114 | Tester fixes from the owner's 0039 laptop run: (1) a way of drawing too slow to show 3 pictures in 0.7 s (the 100,000-item case) was thrown away and mislabeled "the page was in the background"; slow ways now get up to 6 s and report their numbers, and "background" is said only when the page really is hidden. (2) The drawing-time section's verdict came from the last size only, so one untimed size hid all the others; every size now reports for itself and the verdict is the worst level. (3) The graphics-card computing device from the earlier steps stayed open for the whole run (after tables of up to gigabytes); it is now closed before the drawing tests, a suspect for the 1.5 to 1.9 second freezes. (4) The hands-on picture now puts the map on the card before the first turn (as the app does) and the results file adds a plain-words count of freezes over a quarter second per way of drawing, also in the raw data. Tested in: Firefox 158.0 (quick tester run plus scripted drag and scroll), ungoogled-chromium 155.0.8059.39 (quick tester run, a deliberately slow 30,000-item drawing-time run, browser test 93 ok), WebKitGTK 2.52.6 (quick tester run); one at a time, software drawing | FF 158, UC 155, WK 2.52.6 |
| 2026.10.17.0119 | The app no longer draws with WebGPU (the owner's decision after the 0039 laptop run: random 1.5 to 1.9 second freezes in WebGPU while turning, zooming and dragging; WebGL 2 stayed steady). Automatic is WebGL 2 then basic drawing, the Advanced menu no longer offers WebGPU, a saved WebGPU choice becomes Automatic, and the device check says WebGPU works but is not used for drawing. WebGPU still does the graphics-card arrangement math; the renderer code stays for the tester and tests (`NFMRender.setWebGPUDrawing(true)`). New browser-test check locks this in. Tested in: Firefox 158.0 (74 ok), ungoogled-chromium 155.0.8059.39 (94 ok), WebKitGTK 2.52.6 (83 ok), one at a time, software drawing | FF 158, UC 155, WK 2.52.6 |
