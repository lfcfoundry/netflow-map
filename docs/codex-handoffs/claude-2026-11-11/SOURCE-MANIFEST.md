Copyright (c) 2026 LFC Foundry. MIT License.

# Source manifest

Parent/live-main commit: `03a34a4c3410d23e74b517a2a14c097176a7bde2`. The five candidate files below were copied byte-for-byte from the detached November 10 Netflow Map assessment checkout at that exact base:

| Repository path | Role | SHA-256 |
|---|---|---|
| `vendor/netflow-plot.js` | Combined `Other`/wedge plot candidate | `5f8b7c5f28aae3b7e7643d9bb51085ac62d39e82a16e66691019fe1da322a63b` |
| `vendor/netflow-scene.js` | XML scalar escaping candidate | `032a39f45c1f673a0279a61fe85909bac3246de7a1217cdf45ee5158d0d89bf0` |
| `test/plot.test.js` | Separate NUL, `Other`, SVG and wedge regression blocks | `e94a0e0f59f16cbc1769ef5eef9d267d84c2d053d74c6cf8ff5a123518ee8b53` |
| `index.html` | Generated candidate page | `2e3b3a30007ee4919d62a5cbc9f66d128cdce961f9687adf857c9b1111af2447` |
| `docs/play/index.html` | Identical generated candidate page | `2e3b3a30007ee4919d62a5cbc9f66d128cdce961f9687adf857c9b1111af2447` |

The handoff directory contains six status/task documents and `evidence/netflow-adversarial.cjs`, `netflow-adversarial-results.jsonl`, `netflow-plot-baseline.js`, `netflow-scene-baseline.js`, `svg-baseline.svg.gz`, and `svg-candidate.svg.gz`. Baseline files are exact `vendor/` blobs from the parent commit; the portable fixture was adapted to load the branch's vendor files, generate SVGs in a controlled temporary directory, and report relative SVG filenames. The baseline plot and scene SHA-256 values are `9fea895b43875693b5eefaa723b33cc75566b37e8686dd2b2fdc93200e31ac26` and `3714d3ee0f88864b3d6663c12d16348525d4d89ccd44ec6aea0cdacdeb591743`.

Excluded: dirty/divergent local worktrees, unrelated benchmark result archives, browser binaries and credentials. Existing `bench/`, `test/video.test.js`, `test/all.js` and `src/video.js` are already present at the branch parent and are not duplicated under the handoff directory.
