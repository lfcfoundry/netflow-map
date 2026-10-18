# bench/compression-methods

Copyright (c) 2026 LFC Foundry. MIT License.

Four small scripts that show which parts of memory-compression Netflow Map really uses and where the module's standing memory goes. `make.mjs` builds a test page (a copy of the module with counters added, plus the engine); `run.js` packs five data sets of about 100,000 items in one test browser and prints the ways chosen; `footprint.js` and `load-cost.js` read the memory of a Chromium page stage by stage.

## Why

To decide with data whether rarely used parts of the module can go, instead of guessing. The answer and the numbers are in [RESULTS.md](RESULTS.md); raw tables are in [DATA.md](DATA.md).

## Run

```
node bench/compression-methods/make.mjs
node bench/compression-methods/run.js firefox [app:communities app:random app:hub app:rich other]
node bench/compression-methods/footprint.js      # Chromium 155
node bench/compression-methods/load-cost.js      # Chromium 155, 5 fresh browsers per case
```
Test browsers and paths are the ones in `bench/then-and-now/run.js` (Firefox needs `xvfb-run -a` and `NFM_HEADFUL=1`). `page.html` is generated and not committed.

## Credits

Browsers from the "browsers" branch of lfcfoundry/knowledge-base: Firefox 158.0, ungoogled-chromium 155.0.8059.39-1.
