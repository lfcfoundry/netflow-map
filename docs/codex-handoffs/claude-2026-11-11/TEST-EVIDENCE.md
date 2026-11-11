Copyright (c) 2026 LFC Foundry. MIT License.

# Test evidence and commands

From repository root with the existing Node/Python setup:

```sh
node test/plot.test.js
node docs/codex-handoffs/claude-2026-11-11/evidence/netflow-adversarial.cjs
python3 -c "import gzip,xml.etree.ElementTree as E; E.fromstring(gzip.open('docs/codex-handoffs/claude-2026-11-11/evidence/svg-candidate.svg.gz','rb').read())"
node --expose-gc test/video.test.js
node test/all.js --only='video|plot'
node tools/build.mjs
```

The November 10 candidate plot test passed 319 checks; build passed with a readable fallback and a warning about non-Latin-1 characters. The independent review reran 319 checks and the adversarial baseline/candidate matrix. Parent SVG failed XML parsing, candidate SVG parsed. The included [raw matrix](evidence/netflow-adversarial-results.jsonl) records row coverage and raw/rounded wedge area; exact [baseline](evidence/svg-baseline.svg.gz) and [candidate](evidence/svg-candidate.svg.gz) SVG samples are gzip-compressed to preserve literal trailing tab/newline test characters without introducing whitespace errors into the handoff diff. The fixture regenerates them in a controlled temporary directory. The publication worktree's targeted results are recorded in the consolidated publication report.

`node --expose-gc test/video.test.js` passed alone in about 0.29 s for 10/150/400/3000 picture cases. `node test/all.js --only='video|plot'` passed 2/2 files. The prior full run stopped after over five minutes with its video child in futex wait. Independent full retries with external 180 s and 900 s limits did **not** complete, so no full-suite pass exists. Node v26.13.0 on Android arm64 reported `os.cpus().length === 0`, causing one-lane serial execution; this may prolong the suite but does not explain the prior futex wait by itself. The child/harness root cause remains open.

Browser raster visibility, the required Linux x86_64 approved-browser gate, and Pixel manual QA were **not** run. A valid SVG path or positive angle is not proof of visible rendering. Do not treat generated HTML alone as browser qualification or skip the video test.
