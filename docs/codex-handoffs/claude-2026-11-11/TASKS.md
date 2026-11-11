Copyright (c) 2026 LFC Foundry. MIT License.

# Claude tasks

1. Repair top-N overflow identity so any real category, including `Other`, `Others`, `Others, average`, blank and missing, remains distinct from synthetic overflow. Preserve literal labels, stable output order, row coverage, grouped/ungrouped semantics and compatibility with existing chart consumers.
2. Preserve the reviewed SVG XML scalar escaping candidate and test valid/invalid Unicode boundaries, large labels, ordinary metacharacters and parseability. Keep source/vendor/generated page parity.
3. Replace the tiny-wedge partial geometry policy with an honest visible representation for small positive values. Test angular gap, coordinate rounding, floating-point precision, zero, uneven and many-category cases. Obtain reproducible pixel evidence using the repository's approved Linux browsers when available; Android results do not substitute for that gate.
4. Investigate the full `test/all.js` stall with standalone and harnessed `video.test.js`, child state, timeout/error/cleanup behavior and environment constraints. Preserve all assertions and include a full-suite result only if it actually completes.
5. Run relevant Node, build and browser tests under repository rules. Keep LFCP/chart compatibility; coordinate upstream `netflow-plot`/`netflow-scene` source changes with the JS-modules handoff branch. Report exact changed files and test evidence. Work on this branch; never merge into `main`.
