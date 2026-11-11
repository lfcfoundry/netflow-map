Copyright (c) 2026 LFC Foundry. MIT License.

# Current state

- Repository: `lfcfoundry/netflow-map`; handoff branch parent/live-main `03a34a4c3410d23e74b517a2a14c097176a7bde2`.
- Exact detached candidate copied into `vendor/netflow-plot.js`, `vendor/netflow-scene.js`, `test/plot.test.js`, `index.html`, and `docs/play/index.html`.
- `index.html` and `docs/play/index.html` are generated, identical candidate page artifacts. They are included because browser-visible behavior otherwise would still use the parent build. Avoid editing them by hand; rebuild and verify parity only after source changes.
- `test/video.test.js`, `test/all.js`, and `src/video.js` are unchanged parent files. Their source and the stall observations are present in this branch.
- The canonical local `main` had divergent history but was not moved or reconciled. This branch starts from the verified GitHub live-main commit, not a divergent local branch.

No dependency or format update is implied. A corresponding source candidate exists on `lfcfoundry/JS-modules` branch `codex/claude-handoff-2026-11-11`. Coordinate changes between upstream source and this vendor copy without merging histories.
