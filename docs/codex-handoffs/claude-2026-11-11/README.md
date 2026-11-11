Copyright (c) 2026 LFC Foundry. MIT License.

# Claude handoff: Netflow Map chart correctness

**Update 2026-11-11 (Claude):** corrections, test runs and the stall investigation are in [CLAUDE-RESULTS.md](CLAUDE-RESULTS.md). The text below is the original handoff, kept as published.

This is an **isolated handoff branch**, `codex/claude-handoff-2026-11-11`, based on live-main `03a34a4c3410d23e74b517a2a14c097176a7bde2`. It is not canonical `main`. It contains the exact November 10 vendor/chart candidate, its test, and generated page artifacts. The matching upstream `netflow-plot`/`netflow-scene` source candidate is on the same-named `lfcfoundry/JS-modules` handoff branch.

Treat the three proposals independently: real `Other` versus synthetic top-N overflow is **BLOCKED**; SVG XML scalar escaping is **ready for integration consideration**; tiny donut wedge visibility is **BLOCKED**. The NUL grouped-key collision is already fixed at the parent. The isolated video test passed, but the full Node suite **did not complete**. Browser raster visibility was **not verified**. Do not merge this combined branch into `main` as it stands.

Read [CURRENT-STATE.md](CURRENT-STATE.md), [FINDINGS.md](FINDINGS.md), [TASKS.md](TASKS.md), [TEST-EVIDENCE.md](TEST-EVIDENCE.md), and [SOURCE-MANIFEST.md](SOURCE-MANIFEST.md). The portable independent fixture, baseline sources, raw observations and SVG samples are in [evidence/](evidence/); the branch is usable without Termux files. Claude should fix the two blockers, preserve the reviewed SVG candidate, investigate the test stall without weakening tests, run qualification, and return integration-ready results on this branch. Never merge into a canonical branch.
