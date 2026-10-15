# Benchmarks

Measured in two desktop browsers, because real data work happens there: **ungoogled-chromium 154** and **Firefox 158**, headless, on a 2-core, 7 GB Linux machine. Every table below is generated from the raw files in `bench/results/*.jsonl` by `node bench/report.js`, so the numbers here are the numbers in the files.

Libraries we compare against (all current npm releases, bundled into the benchmark page): Papa Parse, d3-dsv, d3-force, graphology-layout-forceatlas2, dagre, ELK, graphology Louvain, d3-random, jStat, expr-eval, gifenc, graphology and Cytoscape.

## How the measurements were made

- Every job runs in a fresh page. Times are the median of up to three runs (seven interleaved runs for the CSV grid); anything slower than 600 ms is run once.
- A job that passes its time limit (5 minutes in the scale runs) or loses its page is recorded as a failure, and the browser is restarted. A bigger size of the same job is skipped when the smaller one failed, or when even a straight-line projection from it passes the limit.
- Firefox rounds its timer to 1 ms, so differences under about 3 ms are not meaningful there. Firefox does not report JS heap; its memory is whole-process memory, which is noisy at the MB scale.
- "Layout score" (also called truth) is the sampled stress of the picture: how far page distances are from hop counts after the best single scale factor (lower is truer). d3-force and ForceAtlas2 place points with no size and leave most items lying on top of each other (section 12), while ours keeps every sized item apart. That costs a little truth, so the score favors them; we count it as a standard we hold ourselves to, not a handicap to hide.
- Three kinds of structure at every scale: **simple** is a plain tree (two columns); **moderate** has communities, about 3 links per item, weights, groups and labels; **complex** adds hubs, cycles, self-links, repeated links, 12 columns, quoted text with commas, doubled quotes and line breaks, four state columns, and about 4 links per item.
- The earlier Node-only numbers in `RESEARCH-open-source-comparison.md` used a different Chromium (Playwright's 141) for its browser checks; everything here is ungoogled-chromium 154 and Firefox 158.

## Summary: are the wins consistent across both browsers?

| Area | Chromium 154 | Firefox 158 | Verdict |
|---|---|---|---|
| CSV reading vs Papa Parse (21 table shapes) | faster in 20, median 0.70× the time, worst 1.13× | faster in 18, median 0.82×, worst 1.32× | Consistent win on quoted, long-field and wide data; parity on small unquoted data |
| CSV reading, whole files of each structure (9 files) | at or under Papa in 3, up to 1.5× slower in the rest | at or under Papa in 2, up to 1.4× slower (one 6 ms parse read 2× against Firefox's 1 ms timer) | Parity, within about ±40%, noise-limited |
| Stress layout vs d3-force (20 cases, 200 to 10,000 items) | faster in 20 of 20 | faster in 20 of 20 | Consistent win: 2.4 to 12× faster up to 3,000 items, 14 to 23× at 10,000 (10 to 19× against ForceAtlas2) |
| Stress layout truth vs d3-force and ForceAtlas2 | as true or truer in 17 of 20 (both) | 17 of 20 (both) | Win up to 3,000 items (15 to 58% truer); at 10,000 items 10% truer to 9% less true than d3-force and 4% truer to 17% less true than ForceAtlas2 (was 7 to 28% less true) |
| **Items left touching (section 12)** | **0 in all 40 test layouts per browser; d3-force and ForceAtlas2 leave 70 to 100% of items overlapping at the same item sizes (ForceAtlas2 on a plain tree: 9%)** | same (the rule is in the code, and a test checks it) | **Vital advantage**: the picture can be read; the others need a zoom of 2.6× to 48× to separate their worst pair, or a slower collision pass |
| **Neighborhood preservation (section 15; 4 networks, Node, single runs)** | **Stress is below d3-force, d3-force + forceCollide and ForceAtlas2 in all four** | not run | **Weakness**: distance truth and local closeness disagree; Force is closer to the competitors |
| **Best-quality Stress (section 16; 6 networks, 10,000 items)** | **truer than d3-force and ForceAtlas2 in all 3 (0.137 to 0.158 against 0.18 to 0.21), 4.4 to 5.5× faster than the faster of them** | **same (0.137 to 0.159), 3.9 to 4.3× faster than the faster of them** | **Win, opt-in: 4 to 6 s at 10,000 items against 1.5 s for the normal arrangement; no overlaps** |
| **Closeness arrangement (section 17; 9 networks, 1,000 to 10,000 items, Node)** | **neighborhood score 1.3 to 4× the best of ForceAtlas2 and d3-force in all 9; distance truth 8 to 37% worse on moderate and complex networks, level or better on trees** | 18 browser runs: 0.4 to 5.3 s, nothing touching | **Win on the neighborhood question, loss on distances: a separate choice, not a replacement** |
| Force layout vs d3-force | faster in 20 of 20 | faster in 20 of 20 | Consistent win |
| Layered drawing vs dagre / ELK | 7 to 13× faster than dagre, but 7 to 117% more crossings | same | Speed win, quality loss (unchanged) |
| Formulas vs expr-eval | 3.8× faster | 5.0× faster | Consistent win |
| Poisson / binomial draws vs d3-random | 6.4 / 2.4× faster | 3.9 / 1.5× faster | Consistent win |
| Normal / lognormal draws vs d3-random, jStat | normal 2.3 / 2.5× faster (jStat / d3-random), lognormal 1.3× faster | normal 1.4 / 1.2× slower, lognormal and exponential 1.06 to 1.2× faster | Win in Chromium; tie or small loss in Firefox (section 14) |
| GIF export vs gifenc (shared palette) | 31 frames 1.24× faster, 4 frames 1.8× slower; color error 10 to 12× lower; files 7 to 8% larger | 31 frames 1.5× faster, 4 frames level (84 against 80 ms); color error 13 to 16× lower; files 6 to 7% larger | Win on speed for longer animations and on quality everywhere; a loss on the 4-frame run in Chromium and on file size (section 14) |
| Found groups vs Louvain | equal or better match at 1,000 and 3,000 items, 1.4 to 1.7× faster; merges planted groups at 300 | same, 1.4 to 2.5× faster | Win at size |
| Memory at 10,000 items | 5.9 MB heap (1.2 MB typed) vs graphology 11.1 and Cytoscape 56.8 | process memory only, too noisy at this size (graphology +92 MB, Cytoscape +204 MB) | Win in Chromium; Firefox points the same way |

## 1. CSV: why it was slower than Papa Parse, and what changed

**Cause.** The first reader built every field one character at a time by adding to a string. That costs time proportional to every character, and it got much worse with long fields: at 200 characters per field it took 3.2 s in Chromium (and 1.7 s in Firefox) for 50,000 rows against 42 and 128 ms for Papa and d3-dsv. Papa and d3 jump to the next delimiter or quote with the engine's own search and cut the text out in one piece.

**Fix.** A line with no quote mark is cut with the engine's own `split`; a record with quotes jumps from quote to quote and takes ordinary text in whole runs. The new reader gives identical rows to the old one (6,000 random tables are compared in `test/importers.test.js`, and a separate 120,000-case check found no differences).

**Chromium 154** (50,000 rows, 6 columns)

| data | ours: first version | ours: now | Papa Parse | d3-dsv | speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted 0, field length 12 | 96 ms | 28 ms | 40 ms | 25 ms | 3.39× |
| quoted 0.1, field length 12 | 116 ms | 38 ms | 47 ms | 60 ms | 3.08× |
| quoted 0.5, field length 12 | 148 ms | 53 ms | 93 ms | 84 ms | 2.77× |
| quoted 1, field length 12 | 192 ms | 66 ms | 143 ms | 135 ms | 2.92× |
| quoted 0, field length 4 | 36 ms | 30 ms | 51 ms | 16 ms | 1.21× |
| quoted 0, field length 64 | 804 ms | 33 ms | 34 ms | 64 ms | 24.14× |
| quoted 0, field length 200 | 3.2 s | 27 ms | 42 ms | 128 ms | 117.31× |
| quoted 0.5, field length 12 | 193 ms | 55 ms | 85 ms | 84 ms | 3.50× |

**Firefox 158** (50,000 rows, 6 columns)

| data | ours: first version | ours: now | Papa Parse | d3-dsv | speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| quoted 0, field length 12 | 71 ms | 55 ms | 67 ms | 60 ms | 1.29× |
| quoted 0.1, field length 12 | 85 ms | 85 ms | 87 ms | 81 ms | 1.00× |
| quoted 0.5, field length 12 | 128 ms | 74 ms | 112 ms | 86 ms | 1.73× |
| quoted 1, field length 12 | 116 ms | 77 ms | 154 ms | 124 ms | 1.51× |
| quoted 0, field length 4 | 52 ms | 48 ms | 54 ms | 54 ms | 1.08× |
| quoted 0, field length 64 | 525 ms | 72 ms | 97 ms | 114 ms | 7.29× |
| quoted 0, field length 200 | 1.7 s | 75 ms | 128 ms | 236 ms | 22.12× |
| quoted 0.5, field length 12 | 101 ms | 66 ms | 109 ms | 87 ms | 1.53× |

**What is left is not parsing.** Parsing a whole file is now at parity with Papa and d3-dsv. Building a graph from the rows takes 2 to 5 times as long as parsing them, because every row becomes items and links with their own text cleanup, duplicate checks and attribute objects. Three changes cut that by about 20 to 30%: printable-ASCII text skips the Unicode and control-character clean-up, repeated-link checks use one number per pair instead of a joined string, and extra-column lists are worked out once instead of once per row. A hand test of the floor (the engine's own `split` on every line, with no quote handling at all) took the same time as the reader, so further gains need a different approach, not tuning.

**A bug found on the way.** In Node 22, one whole-text search for a carriage return inside the optimized reader froze it for 85 seconds after a few runs (no such stall appeared in either browser). The check is now done line by line, and 120 runs of each structure showed no stall.

### Parsing grid (50,000 rows unless stated)

**Chromium 154**

| rows | cols | share quoted | field length | share with line breaks | delimiter | ours | Papa Parse | d3-dsv | ours ÷ Papa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 6 | 0 | 12 | 0 | , | 0.5 ms | 0.8 ms | 1.2 ms | 0.63× |
| 10,000 | 6 | 0 | 12 | 0 | , | 7.5 ms | 9.0 ms | 6.5 ms | 0.83× |
| 100,000 | 6 | 0 | 12 | 0 | , | 80 ms | 94 ms | 122 ms | 0.85× |
| 1,000,000 | 6 | 0 | 12 | 0 | , | 853 ms | 934 ms | 934 ms | 0.91× |
| 50,000 | 2 | 0 | 12 | 0 | , | 25 ms | 34 ms | 18 ms | 0.73× |
| 50,000 | 6 | 0 | 12 | 0 | , | 28 ms | 40 ms | 25 ms | 0.70× |
| 50,000 | 12 | 0 | 12 | 0 | , | 61 ms | 54 ms | 68 ms | 1.13× |
| 50,000 | 30 | 0 | 12 | 0 | , | 133 ms | 142 ms | 164 ms | 0.94× |
| 50,000 | 6 | 0 | 12 | 0 | , | 48 ms | 63 ms | 40 ms | 0.76× |
| 50,000 | 6 | 0.1 | 12 | 0 | , | 38 ms | 47 ms | 60 ms | 0.81× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 53 ms | 93 ms | 84 ms | 0.57× |
| 50,000 | 6 | 1 | 12 | 0 | , | 66 ms | 143 ms | 135 ms | 0.46× |
| 50,000 | 6 | 0 | 4 | 0 | , | 30 ms | 51 ms | 16 ms | 0.58× |
| 50,000 | 6 | 0 | 12 | 0 | , | 25 ms | 36 ms | 33 ms | 0.70× |
| 50,000 | 6 | 0 | 64 | 0 | , | 33 ms | 34 ms | 64 ms | 0.97× |
| 50,000 | 6 | 0 | 200 | 0 | , | 27 ms | 42 ms | 128 ms | 0.65× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 56 ms | 106 ms | 96 ms | 0.53× |
| 50,000 | 6 | 0.5 | 12 | 0.05 | , | 55 ms | 85 ms | 84 ms | 0.65× |
| 50,000 | 6 | 0.5 | 12 | 0.3 | , | 51 ms | 90 ms | 103 ms | 0.57× |
| 50,000 | 6 | 0 | 12 | 0 | tab | 24 ms | 40 ms | 25 ms | 0.61× |
| 50,000 | 6 | 0.2 | 12 | 0 | ; | 43 ms | 61 ms | 67 ms | 0.71× |

**Firefox 158**

| rows | cols | share quoted | field length | share with line breaks | delimiter | ours | Papa Parse | d3-dsv | ours ÷ Papa |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1,000 | 6 | 0 | 12 | 0 | , | 1.0 ms | 2.0 ms | 1.0 ms | 0.50× |
| 10,000 | 6 | 0 | 12 | 0 | , | 15 ms | 13 ms | 21 ms | 1.15× |
| 100,000 | 6 | 0 | 12 | 0 | , | 76 ms | 70 ms | 80 ms | 1.09× |
| 1,000,000 | 6 | 0 | 12 | 0 | , | 746 ms | 566 ms | 707 ms | 1.32× |
| 50,000 | 2 | 0 | 12 | 0 | , | 21 ms | 32 ms | 18 ms | 0.66× |
| 50,000 | 6 | 0 | 12 | 0 | , | 55 ms | 67 ms | 60 ms | 0.82× |
| 50,000 | 12 | 0 | 12 | 0 | , | 101 ms | 114 ms | 157 ms | 0.89× |
| 50,000 | 30 | 0 | 12 | 0 | , | 216 ms | 235 ms | 340 ms | 0.92× |
| 50,000 | 6 | 0 | 12 | 0 | , | 56 ms | 63 ms | 63 ms | 0.89× |
| 50,000 | 6 | 0.1 | 12 | 0 | , | 85 ms | 87 ms | 81 ms | 0.98× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 74 ms | 112 ms | 86 ms | 0.66× |
| 50,000 | 6 | 1 | 12 | 0 | , | 77 ms | 154 ms | 124 ms | 0.50× |
| 50,000 | 6 | 0 | 4 | 0 | , | 48 ms | 54 ms | 54 ms | 0.89× |
| 50,000 | 6 | 0 | 12 | 0 | , | 60 ms | 68 ms | 82 ms | 0.88× |
| 50,000 | 6 | 0 | 64 | 0 | , | 72 ms | 97 ms | 114 ms | 0.74× |
| 50,000 | 6 | 0 | 200 | 0 | , | 75 ms | 128 ms | 236 ms | 0.59× |
| 50,000 | 6 | 0.5 | 12 | 0 | , | 76 ms | 107 ms | 94 ms | 0.71× |
| 50,000 | 6 | 0.5 | 12 | 0.05 | , | 66 ms | 109 ms | 87 ms | 0.61× |
| 50,000 | 6 | 0.5 | 12 | 0.3 | , | 69 ms | 117 ms | 95 ms | 0.59× |
| 50,000 | 6 | 0 | 12 | 0 | tab | 52 ms | 71 ms | 70 ms | 0.73× |
| 50,000 | 6 | 0.2 | 12 | 0 | ; | 70 ms | 81 ms | 71 ms | 0.86× |

### Whole files by structure (parse only, then the full import into a graph)

**Chromium 154**

| structure | rows | size | ours: parse | Papa Parse | d3-dsv | ours ÷ Papa | ours: full import into a graph | items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 9,999 | 0.1 MB | 4.0 ms | 5.3 ms | 6.0 ms | 0.75× | 26 ms | 10,000 |
| simple | 99,999 | 1.3 MB | 43 ms | 32 ms | 46 ms | 1.35× | 287 ms | 100,000 |
| simple | 499,999 | 7.2 MB | 269 ms | 282 ms | 245 ms | 0.95× | 1.5 s | 500,000 |
| moderate | 29,938 | 0.8 MB | 32 ms | 30 ms | 13 ms | 1.06× | 114 ms | 10,000 |
| moderate | 299,757 | 8.4 MB | 247 ms | 163 ms | 197 ms | 1.52× | 1.2 s | 100,000 |
| moderate | 1,500,196 | 44.8 MB | 1.1 s | 945 ms | 946 ms | 1.13× | 7.2 s | 500,000 |
| complex | 41,975 | 5.2 MB | 54 ms | 71 ms | 49 ms | 0.76× | 197 ms | 10,000 |
| complex | 420,519 | 53.1 MB | 603 ms | 573 ms | 684 ms | 1.05× | 2.6 s | 100,000 |
| complex | 2,100,244 | 270 MB | 3.7 s | 3.0 s | 3.4 s | 1.21× | 15 s | 500,000 |

**Firefox 158**

| structure | rows | size | ours: parse | Papa Parse | d3-dsv | ours ÷ Papa | ours: full import into a graph | items |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 9,999 | 0.1 MB | 6.0 ms | 3.0 ms | 2.0 ms | 2.00× | 31 ms | 10,000 |
| simple | 99,999 | 1.3 MB | 36 ms | 62 ms | 52 ms | 0.58× | 326 ms | 100,000 |
| simple | 499,999 | 7.2 MB | 209 ms | 154 ms | 122 ms | 1.36× | 1.7 s | 500,000 |
| moderate | 29,938 | 0.8 MB | 29 ms | 21 ms | 20 ms | 1.38× | 92 ms | 10,000 |
| moderate | 299,757 | 8.4 MB | 233 ms | 187 ms | 267 ms | 1.25× | 1.3 s | 100,000 |
| moderate | 1,500,196 | 44.8 MB | 1.2 s | 938 ms | 1.1 s | 1.28× | 9.2 s | 500,000 |
| complex | 41,975 | 5.2 MB | 78 ms | 75 ms | 91 ms | 1.04× | 173 ms | 10,000 |
| complex | 420,519 | 53.1 MB | 796 ms | 931 ms | 1.1 s | 0.85× | 2.6 s | 100,000 |
| complex | 2,100,244 | 270 MB | 5.0 s | 4.5 s | 5.5 s | 1.11× | 17 s | 500,000 |

Limits found: the import has always stopped at 200,000 items or 800,000 links as a safety cap; it is now a default that the caller can change (`importAny(text, { maxNodes, maxEdges })`), and these runs lifted it. Chromium cannot hold a text over about 512 million characters in one string: the 1,000,000-item complex file (about 4.2 million rows, 540 MB) fails there with "Invalid string length", while Firefox read and imported it (11 s to parse, 40 s to import).

## 2. Stress layout against d3-force, ForceAtlas2 and our Force layout

**Why Stress was slower than d3-force at some sizes.** Below 700 items it used every pair of items, kept as one small array per pair, and shuffled them in memory each pass. At 600 items that is 180,000 pairs held as 180,000 separate arrays, read in random order 30 times: 124 to 300 ns per update, against 14 to 25 ns once the same pairs sit in typed arrays and are read in order. Above that size, most of the time went to pushing overlapping items apart, not to the layout itself (80% at 20,000 items in a Node profile).

**What changed.**
- Pairs are held in typed arrays (two integer lists, two decimal lists) and swept in memory order; the random order is made once.
- Distances come from a flat list of neighbors (CSR) instead of per-item arrays and map lookups.
- All pairs are now used up to 4,000 items (was 700, then 3,000), with fewer passes as the count grows, because the sweep is now cheap enough. This is the largest single gain in layout truth: at 1,000 items the score went from 0.18 to 0.12.
- Bigger pieces use pivots plus each item's nearest 100 neighbors (60 above 20,000 items; section 13 explains why this was the change that mattered), and the pair count is capped by memory (about 12 million pairs).
- Overlap removal (section 12) uses a plain grid with a counting sort, a cell sized to the largest items, and a first stretch of crowded pictures so little is left to push apart. Stress at 20,000 items went from 6.2 s to about 1.4 s (Node measurement).

**Chromium 154** (time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 28 ms / 0.106 | 48 ms / 0.107 | 129 ms / 0.140 | 189 ms / 0.177 | 94 ms / 0.180 |
| simple | 600 | 119 ms / 0.121 | 538 ms / 0.120 | 358 ms / 0.151 | 625 ms / 0.204 | 767 ms / 0.195 |
| simple | 1,000 | 218 ms / 0.121 | 369 ms / 0.184 | 644 ms / 0.171 | 1.3 s / 0.208 | 1.2 s / 0.189 |
| simple | 3,000 | 1.6 s / 0.130 | 1.2 s / 0.222 | 2.5 s / 0.191 | 4.9 s / 0.217 | 4.8 s / 0.203 |
| simple | 10,000 | 1.2 s / 0.192 | 2.1 s / 0.245 | 5.3 s / 0.260 | 26 s / 0.210 | 23 s / 0.201 |
| moderate | 200 | 35 ms / 0.087 | 65 ms / 0.087 | 113 ms / 0.116 | 236 ms / 0.176 | 99 ms / 0.164 |
| moderate | 600 | 125 ms / 0.124 | 573 ms / 0.127 | 413 ms / 0.163 | 745 ms / 0.189 | 714 ms / 0.184 |
| moderate | 1,000 | 247 ms / 0.137 | 343 ms / 0.224 | 637 ms / 0.162 | 1.2 s / 0.198 | 1.2 s / 0.174 |
| moderate | 3,000 | 2.0 s / 0.151 | 1.3 s / 0.234 | 2.7 s / 0.168 | 4.7 s / 0.194 | 5.1 s / 0.176 |
| moderate | 10,000 | 1.6 s / 0.207 | 3.5 s / 0.233 | 6.2 s / 0.252 | 22 s / 0.190 | 24 s / 0.180 |
| complex | 200 | 24 ms / 0.119 | 54 ms / 0.124 | 115 ms / 0.130 | 238 ms / 0.150 | 111 ms / 0.140 |
| complex | 600 | 121 ms / 0.119 | 799 ms / 0.155 | 413 ms / 0.130 | 848 ms / 0.144 | 874 ms / 0.141 |
| complex | 1,000 | 266 ms / 0.124 | 359 ms / 0.238 | 661 ms / 0.140 | 1.6 s / 0.187 | 1.5 s / 0.147 |
| complex | 3,000 | 1.8 s / 0.138 | 1.4 s / 0.243 | 2.6 s / 0.157 | 4.8 s / 0.172 | 5.7 s / 0.185 |
| complex | 10,000 | 1.5 s / 0.205 | 4.3 s / 0.246 | 6.4 s / 0.207 | 24 s / 0.195 | 27 s / 0.179 |
| planted | 200 | 40 ms / 0.077 | 56 ms / 0.077 | 141 ms / 0.122 | 217 ms / 0.185 | 122 ms / 0.118 |
| planted | 600 | 186 ms / 0.109 | 666 ms / 0.115 | 476 ms / 0.137 | 765 ms / 0.184 | 710 ms / 0.162 |
| planted | 1,000 | 275 ms / 0.129 | 480 ms / 0.195 | 690 ms / 0.153 | 1.4 s / 0.192 | 1.3 s / 0.170 |
| planted | 3,000 | 1.8 s / 0.146 | 1.5 s / 0.215 | 2.7 s / 0.172 | 5.4 s / 0.195 | 5.6 s / 0.180 |
| planted | 10,000 | 1.5 s / 0.203 | 5.0 s / 0.233 | 6.5 s / 0.275 | 23 s / 0.188 | 24 s / 0.190 |

**Firefox 158**(time / layout score, lower score = truer)

| structure | items | Stress (now) | Stress (before) | Force | d3-force | ForceAtlas2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 200 | 21 ms / 0.107 | 78 ms / 0.107 | 156 ms / 0.139 | 257 ms / 0.177 | 115 ms / 0.170 |
| simple | 600 | 168 ms / 0.121 | 1.4 s / 0.120 | 424 ms / 0.151 | 869 ms / 0.204 | 587 ms / 0.195 |
| simple | 1,000 | 212 ms / 0.122 | 746 ms / 0.187 | 750 ms / 0.172 | 1.6 s / 0.208 | 1.1 s / 0.203 |
| simple | 3,000 | 1.6 s / 0.130 | 2.6 s / 0.215 | 3.4 s / 0.191 | 8.0 s / 0.217 | 4.5 s / 0.208 |
| simple | 10,000 | 1.4 s / 0.190 | 3.5 s / 0.253 | 8.6 s / 0.260 | 32 s / 0.210 | 20 s / 0.198 |
| moderate | 200 | 62 ms / 0.087 | 70 ms / 0.087 | 134 ms / 0.117 | 238 ms / 0.176 | 138 ms / 0.151 |
| moderate | 600 | 157 ms / 0.124 | 1.5 s / 0.127 | 993 ms / 0.163 | 943 ms / 0.189 | 486 ms / 0.178 |
| moderate | 1,000 | 641 ms / 0.136 | 827 ms / 0.212 | 1.3 s / 0.163 | 1.7 s / 0.198 | 1.2 s / 0.179 |
| moderate | 3,000 | 2.4 s / 0.151 | 2.7 s / 0.237 | 4.5 s / 0.168 | 6.9 s / 0.194 | 4.0 s / 0.184 |
| moderate | 10,000 | 1.8 s / 0.204 | 6.7 s / 0.229 | 10 s / 0.252 | 30 s / 0.190 | 21 s / 0.175 |
| complex | 200 | 36 ms / 0.119 | 86 ms / 0.123 | 142 ms / 0.130 | 230 ms / 0.150 | 107 ms / 0.151 |
| complex | 600 | 141 ms / 0.119 | 1.7 s / 0.151 | 497 ms / 0.130 | 998 ms / 0.144 | 559 ms / 0.140 |
| complex | 1,000 | 255 ms / 0.124 | 941 ms / 0.247 | 1.0 s / 0.140 | 1.8 s / 0.187 | 1.0 s / 0.146 |
| complex | 3,000 | 2.2 s / 0.138 | 3.5 s / 0.248 | 4.1 s / 0.158 | 9.6 s / 0.172 | 4.9 s / 0.169 |
| complex | 10,000 | 2.0 s / 0.207 | 7.7 s / 0.247 | 9.4 s / 0.206 | 34 s / 0.195 | 23 s / 0.179 |
| planted | 200 | 53 ms / 0.078 | 101 ms / 0.077 | 127 ms / 0.122 | 300 ms / 0.185 | 99 ms / 0.148 |
| planted | 600 | 158 ms / 0.109 | 1.5 s / 0.115 | 502 ms / 0.137 | 965 ms / 0.184 | 750 ms / 0.152 |
| planted | 1,000 | 303 ms / 0.129 | 901 ms / 0.200 | 1.0 s / 0.153 | 2.3 s / 0.192 | 1.0 s / 0.172 |
| planted | 3,000 | 2.2 s / 0.145 | 3.3 s / 0.216 | 4.1 s / 0.172 | 7.7 s / 0.195 | 4.1 s / 0.189 |
| planted | 10,000 | 2.1 s / 0.198 | 6.5 s / 0.243 | 8.9 s / 0.276 | 34 s / 0.188 | 21 s / 0.187 |

Reading it: **time** is lower for Stress in all 40 cases (20 per browser): 2.4 to 12× faster than d3-force up to 3,000 items, and 14 to 23× faster at 10,000 items (10 to 19× faster than ForceAtlas2). **Truth** is better than both competitors up to 3,000 items (ours scores 0.42 to 0.86 of their score). At 10,000 items it is 10% truer to 9% less true than d3-force and 4% truer to 17% less true than ForceAtlas2; that is 17 of 20 cases as true or truer in each browser, and the three that are not are the moderate, complex and planted networks at 10,000 items. The last round measured 7 to 28% worse at 10,000 items. Section 13 says what closed most of the gap, what was tried and did not help, and what is left. The "before" column is the engine as committed before the first round of this work, loaded in the same page; at 3,000 items in Chromium the engine now takes 1.2 to 1.5× longer than that column (in Firefox it is 1.1 to 1.6× faster) because it now also guarantees that no two items touch (section 12).

Memory trade: at 4,000 items the all-pairs method holds 8 million pairs (16 bytes each, 128 MB; designed, not separately measured), several times the old method's footprint at that size, and then returns it. Above 3,000 items it uses less memory than before.

## 3. What typed arrays cost, and what they save

**Chromium 154: the sweep itself, same pairs held three ways**

| items | pairs | held as | build | 30 sweeps | per update | heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 44,850 | arrays | 7.9 ms | 67 ms | 50 ns | 1.7 MB |
| 300 | 44,850 | typedIndexed | 3.7 ms | 44 ms | 33 ns | 1 MB |
| 300 | 44,850 | typedSeq | 8.5 ms | 37 ms | 27 ns | 2 MB |
| 600 | 179,700 | arrays | 28 ms | 671 ms | 124 ns | 8.3 MB |
| 600 | 179,700 | typedIndexed | 6.8 ms | 166 ms | 31 ns | 3.7 MB |
| 600 | 179,700 | typedSeq | 17 ms | 77 ms | 14 ns | 4.1 MB |
| 1500 | 1,124,250 | arrays | 88 ms | 4.1 s | 123 ns | 51.4 MB |
| 1500 | 1,124,250 | typedIndexed | 30 ms | 3.3 s | 97 ns | 21.7 MB |
| 1500 | 1,124,250 | typedSeq | 104 ms | 561 ms | 17 ns | 22 MB |

**Chromium 154: whole Stress layout, before and now**

| structure | items | engine | time | heap | process memory growth |
| --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 3,000 | before | 1.8 s | 25.6 MB | 48 MB |
| moderate | 3,000 | now | 1.9 s | 76 MB | 98 MB |
| moderate | 10,000 | before | 3.7 s | 35.2 MB | 83 MB |
| moderate | 10,000 | now | 689 ms | 29 MB | 58 MB |
| complex | 3,000 | before | 1.6 s | 34.4 MB | 61 MB |
| complex | 3,000 | now | 1.9 s | 80.5 MB | 91 MB |
| complex | 10,000 | before | 4.1 s | 38.4 MB | 95 MB |
| complex | 10,000 | now | 731 ms | 29.5 MB | 73 MB |

**Chromium 154: sending a layout result (one object per item vs typed arrays)**

| items | objects (structured clone) | typed arrays: copied | typed arrays: moved | object size (rough) | typed size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 25 ms | 0.3 ms | 0.5 ms | 1 MB | 0.3 MB |
| 100,000 | 246 ms | 3.6 ms | 0.0 ms | 9.9 MB | 3.1 MB |
| 500,000 | 1.5 s | 23 ms | 0.1 ms | 49.6 MB | 15.3 MB |
| 1,000,000 | 3.8 s | 64 ms | 0.2 ms | 99.2 MB | 30.5 MB |

**Firefox 158: the sweep itself, same pairs held three ways**

| items | pairs | held as | build | 30 sweeps | per update | heap |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 44,850 | arrays | 17 ms | 467 ms | 347 ns | – |
| 300 | 44,850 | typedIndexed | 3.0 ms | 74 ms | 55 ns | – |
| 300 | 44,850 | typedSeq | 11 ms | 32 ms | 24 ns | – |
| 600 | 179,700 | arrays | 23 ms | 1.3 s | 238 ns | – |
| 600 | 179,700 | typedIndexed | 5.0 ms | 386 ms | 72 ns | – |
| 600 | 179,700 | typedSeq | 21 ms | 120 ms | 22 ns | – |
| 1500 | 1,124,250 | arrays | 95 ms | 10.0 s | 296 ns | – |
| 1500 | 1,124,250 | typedIndexed | 25 ms | 4.6 s | 137 ns | – |
| 1500 | 1,124,250 | typedSeq | 207 ms | 737 ms | 22 ns | – |

**Firefox 158: whole Stress layout, before and now**

| structure | items | engine | time | heap | process memory growth |
| --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 3,000 | before | 3.3 s | – | 295 MB |
| moderate | 3,000 | now | 2.1 s | – | 158 MB |
| moderate | 10,000 | before | 6.8 s | – | 192 MB |
| moderate | 10,000 | now | 861 ms | – | 106 MB |
| complex | 3,000 | before | 3.2 s | – | 127 MB |
| complex | 3,000 | now | 2.1 s | – | 164 MB |
| complex | 10,000 | before | 7.7 s | – | 156 MB |
| complex | 10,000 | now | 791 ms | – | 144 MB |

**Firefox 158: sending a layout result (one object per item vs typed arrays)**

| items | objects (structured clone) | typed arrays: copied | typed arrays: moved | object size (rough) | typed size |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 34 ms | 0.0 ms | 0.0 ms | 1 MB | 0.3 MB |
| 100,000 | 233 ms | 2.0 ms | 0.0 ms | 9.9 MB | 3.1 MB |
| 500,000 | 1.3 s | 18 ms | 0.0 ms | 49.6 MB | 15.3 MB |
| 1,000,000 | 2.7 s | 32 ms | 0.0 ms | 99.2 MB | 30.5 MB |

- **Speed:** the same pairs swept in memory order are 1.8 to 8.7× faster than one array per pair in Chromium and 11 to 15× in Firefox. Firefox's per-pair arrays are the slowest case of all (up to 347 ns per update).
- **The trap:** reading typed arrays through a shuffled index list keeps only a small part of that gain once the pairs no longer fit in cache (97 to 137 ns at 1.1 million pairs, against 17 to 22 ns in order). The fix was to shuffle the pairs once and sweep forward then backward.
- **Memory:** about 20 bytes per pair against 46 (16 for the four arrays, 4 for the order list), a drop of about 2.3×. Building the pairs is quicker (30 ms against 88 ms at 1,500 items) when their order is left alone.
- **Cost:** shuffling the pairs once in place brings the build back to about the old time (104 ms), and an all-pairs design that is now affordable also holds more pairs at once (see the memory note above).
- **Results:** sending a layout result as one object per item costs 25 ms at 10,000 items and 3.8 s at 1,000,000 in Chromium (2.7 s in Firefox); sent as typed arrays it is 64 ms copied or 0.2 ms moved. The app's layout results are still objects, so this saving is not taken yet; it is the best next use of typed arrays.

## 4. Where the engine stops: 100,000, 500,000 and 1,000,000 items

Time limit per job: 5 minutes. "skipped" means the smaller size failed or a straight-line projection from it passes the limit. "refused" is a built-in guard, not a crash. 1,000 sim runs start from one item (the simple tree is the long walk; in the other two the flow dies out quickly, so their times are short).

**Chromium 154**

| structure | items | CSV file | CSV parse | CSV import | prepare | check | groups | 1,000 sim runs | flow layout | Force layout | Stress layout |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 100,000 | 99,999 rows, 1.3 MB | 43 ms | 270 ms | 119 ms | 641 ms | 104 ms | 9.0 s | refused (too big) | 35 s | 7.9 s |
| simple | 500,000 | 499,999 rows, 7.2 MB | 215 ms | 1.4 s | 687 ms | 2.7 s | 178 ms | 40 s | skipped | 234 s | 66 s |
| simple | 1,000,000 | 999,999 rows, 14.8 MB | 438 ms | 3.3 s | 1.9 s | 6.2 s | 382 ms | 88 s | skipped | skipped | ✗ time limit 300 s |
| moderate | 100,000 | 299,757 rows, 8.4 MB | 168 ms | 1.1 s | 353 ms | 2.4 s | 1.4 s | 123 ms | refused (too big) | 62 s | 16 s |
| moderate | 500,000 | 1,500,196 rows, 44.8 MB | 1.1 s | 7.0 s | 2.3 s | 11 s | 9.0 s | 258 ms | skipped | skipped | ✗ time limit 300 s |
| moderate | 1,000,000 | 2,999,871 rows, 90.2 MB | 2.5 s | 15 s | 4.6 s | 24 s | 23 s | 344 ms | skipped | skipped | skipped |
| complex | 100,000 | 420,519 rows, 53.1 MB | 535 ms | 2.5 s | 659 ms | 2.9 s | 1.1 s | 126 ms | refused (too big) | 55 s | 18 s |
| complex | 500,000 | 2,100,244 rows, 270 MB | 3.6 s | 14 s | 2.1 s | 11 s | 13 s | 208 ms | skipped | ✗ time limit 300 s | ✗ time limit 300 s |
| complex | 1,000,000 | ✗ Invalid string length (after 4200383 rows) | – | – | 4.3 s | 24 s | 29 s | 352 ms | skipped | skipped | skipped |

**Firefox 158**

| structure | items | CSV file | CSV parse | CSV import | prepare | check | groups | 1,000 sim runs | flow layout | Force layout | Stress layout |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| simple | 100,000 | 99,999 rows, 1.3 MB | 60 ms | 409 ms | 129 ms | 695 ms | 61 ms | 13 s | refused (too big) | 52 s | 8.0 s |
| simple | 500,000 | 499,999 rows, 7.2 MB | 173 ms | 1.7 s | 1.0 s | 3.5 s | 277 ms | 64 s | skipped | ✗ time limit 300 s | 63 s |
| simple | 1,000,000 | 999,999 rows, 14.8 MB | 468 ms | 3.7 s | ✗ out of memory | ✗ out of memory | ✗ out of memory | ✗ out of memory | skipped | skipped | ✗ time limit 300 s |
| moderate | 100,000 | 299,757 rows, 8.4 MB | 207 ms | 1.3 s | 518 ms | 2.2 s | 2.0 s | 165 ms | refused (too big) | 75 s | 16 s |
| moderate | 500,000 | 1,500,196 rows, 44.8 MB | 823 ms | 7.9 s | 2.2 s | 11 s | 13 s | 306 ms | skipped | skipped | ✗ time limit 300 s |
| moderate | 1,000,000 | 2,999,871 rows, 90.2 MB | 2.2 s | 21 s | 5.7 s | 26 s | 28 s | 583 ms | skipped | skipped | skipped |
| complex | 100,000 | 420,519 rows, 53.1 MB | 787 ms | 2.9 s | 432 ms | 2.6 s | 1.9 s | 118 ms | refused (too big) | 76 s | 22 s |
| complex | 500,000 | 2,100,244 rows, 270 MB | 4.7 s | 16 s | 3.0 s | 12 s | 18 s | 195 ms | skipped | skipped | ✗ time limit 300 s |
| complex | 1,000,000 | 4,200,383 rows, 541.9 MB | 11 s | 40 s | 6.3 s | 32 s | 38 s | 279 ms | skipped | skipped | skipped |

What this says:
- **Reading data is not the limit.** Parsing and importing scale in a straight line to 1,000,000 items in both browsers (15 to 21 s for the 3-million-row moderate file). The only hard stop is one text of more than about 512 million characters in Chromium.
- **Analysis scales to 1,000,000 items:** prepare, check and groups each finish in 0.4 to 38 seconds everywhere. The one failure is Firefox at 1,000,000 simple items, where the page ran out of memory (the browser reached 6.4 GB on a 7 GB machine) while running the 1,000 simulation runs, so the whole job was lost.
- **Layouts are the limit.** Stress finishes 100,000 items in 8 to 22 s and 500,000 simple items in about a minute; Force takes 35 to 76 s at 100,000 items and 4 minutes at 500,000 simple items in Chromium (Firefox passed the 5-minute limit). No layout finishes at 1,000,000. The layered flow drawing refuses graphs that would need more than a fixed number of stops (it says to use the Network view), by design.
- The Network view is the one to use above about 50,000 items, and Stress is the faster of its two layouts at every size measured.

## 5. Everything else, in both browsers

### Chromium 154

Layered drawing (time, crossings)

| items | ours | crossings | dagre | crossings | ELK | crossings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 14 ms | 566 | 103 ms | 527 | 582 ms | 429 |
| 200 | 35 ms | 2636 | 243 ms | 1746 | 786 ms | 1338 |
| 400 | 77 ms | 12279 | 1.0 s | 5654 | 1.3 s | 5393 |
| 1000 | 139 ms | 50483 | – | – | – | – |
| 3000 | 457 ms | 235925 | – | – | – | – |

Found groups (time, groups found, match with the planted groups; 1.0 = perfect)

| items | planted | ours | found | match | Louvain | found | match |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 6 | 0.9 ms | 4 | 0.852 | 6.0 ms | 6 | 1 |
| 1000 | 10 | 9.1 ms | 12 | 0.978 | 13 ms | 10 | 0.975 |
| 3000 | 20 | 16 ms | 20 | 0.984 | 27 ms | 20 | 0.957 |

Random draws, 1,000,000 each (ms)

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 21 | 53 | 48 |
| lognormal | 80 | 103 | – |
| poisson | 57 | 363 | 84 |
| binomial | 263 | 635 | – |
| exponential | 30 | 45 | – |

Formulas, 300,000 rows: ours 70 ms, expr-eval 265 ms (3.80× faster)

GIF export

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 109 ms | 68 KB | 0.016 / 66.1 dB | 61 ms | 63 KB | 0.159 / 56.1 dB |
| 31 | 960×540 | 238 ms | 521 KB | 0.023 / 64.5 dB | 296 ms | 487 KB | 0.287 / 53.6 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

Checker

| structure | items | links | time | findings |
| --- | ---: | ---: | ---: | ---: |
| simple | 1,000 | 999 | 15 ms | 4 |
| simple | 10,000 | 9,999 | 97 ms | 4 |
| simple | 50,000 | 49,999 | 313 ms | 4 |
| moderate | 1,000 | 2,983 | 39 ms | 6 |
| moderate | 10,000 | 30,054 | 198 ms | 6 |
| moderate | 50,000 | 149,980 | 851 ms | 6 |
| complex | 1,000 | 4,303 | 27 ms | 11 |
| complex | 10,000 | 42,059 | 287 ms | 10 |
| complex | 50,000 | 210,001 | 1.2 s | 11 |

Ingestion, one network three ways

| items | links | JSON | CSV | A -> B lines |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 2,956 | 11 ms | 7.4 ms | 9.8 ms |
| 10,000 | 30,928 | 107 ms | 62 ms | 68 ms |
| 50,000 | 155,405 | 624 ms | 346 ms | 356 ms |

Memory at 10,000 items

| what is held | process growth vs empty page | JS heap | note |
| --- | ---: | ---: | ---: |
| baseline | 0 MB | – |  |
| prepare | 0 MB | 5.9 MB | 1.2 MB typed |
| graphology | -1 MB | 11.1 MB |  |
| cytoscape | 145 MB | 56.8 MB |  |
| layout | 68 MB | 27.2 MB |  |

### Firefox 158

Layered drawing (time, crossings)

| items | ours | crossings | dagre | crossings | ELK | crossings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 16 ms | 566 | 132 ms | 527 | 480 ms | 429 |
| 200 | 30 ms | 2636 | 217 ms | 1746 | 806 ms | 1338 |
| 400 | 79 ms | 12279 | 920 ms | 5654 | 1.4 s | 5393 |
| 1000 | 137 ms | 50483 | – | – | – | – |
| 3000 | 491 ms | 235925 | – | – | – | – |

Found groups (time, groups found, match with the planted groups; 1.0 = perfect)

| items | planted | ours | found | match | Louvain | found | match |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 300 | 6 | 2.0 ms | 4 | 0.852 | 5.0 ms | 6 | 1 |
| 1000 | 10 | 5.0 ms | 12 | 0.978 | 7.0 ms | 10 | 0.975 |
| 3000 | 20 | 13 ms | 20 | 0.984 | 27 ms | 20 | 0.957 |

Random draws, 1,000,000 each (ms)

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 60 | 51 | 42 |
| lognormal | 82 | 87 | – |
| poisson | 78 | 308 | 55 |
| binomial | 364 | 562 | – |
| exponential | 37 | 45 | – |

Formulas, 300,000 rows: ours 52 ms, expr-eval 258 ms (4.96× faster)

GIF export

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 84 ms | 67 KB | 0.015 / 66.4 dB | 80 ms | 63 KB | 0.191 / 55.3 dB |
| 31 | 960×540 | 212 ms | 515 KB | 0.022 / 64.6 dB | 316 ms | 485 KB | 0.347 / 52.7 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

Checker

| structure | items | links | time | findings |
| --- | ---: | ---: | ---: | ---: |
| simple | 1,000 | 999 | 18 ms | 4 |
| simple | 10,000 | 9,999 | 101 ms | 4 |
| simple | 50,000 | 49,999 | 285 ms | 4 |
| moderate | 1,000 | 2,983 | 22 ms | 6 |
| moderate | 10,000 | 30,054 | 253 ms | 6 |
| moderate | 50,000 | 149,980 | 920 ms | 6 |
| complex | 1,000 | 4,303 | 23 ms | 11 |
| complex | 10,000 | 42,059 | 220 ms | 10 |
| complex | 50,000 | 210,001 | 1.5 s | 11 |

Ingestion, one network three ways

| items | links | JSON | CSV | A -> B lines |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 2,956 | 10 ms | 8.0 ms | 12 ms |
| 10,000 | 30,928 | 107 ms | 52 ms | 74 ms |
| 50,000 | 155,405 | 684 ms | 336 ms | 469 ms |

Memory at 10,000 items

| what is held | process growth vs empty page | JS heap | note |
| --- | ---: | ---: | ---: |
| baseline | 0 MB | – |  |
| prepare | -68 MB | – | 1.2 MB typed |
| graphology | 92 MB | – |  |
| cytoscape | 204 MB | – |  |
| layout | 139 MB | – |  |

Notes: GIF compares our encoder with gifenc using one shared palette on four synthetic frames and then 31 (section 14 has the reading and the color-error method). The Node result in the earlier research report (ours 0.4 s against 7.6 to 10.7 s) was gifenc with a palette per frame. The draws are 1,000,000 samples each; d3-random is given a fast LCG generator and jStat its own. "Sending a layout" is section 14.

## 6. Left for the next round

Done in the last rounds (sections 12 to 17): the 10,000+ Stress gap (7 to 28% down to 10% truer to 9% less true than d3-force), layout results as columns (about 2.5× faster end to end at 100,000 items, not the 70 to 100× estimated before the object rebuild was counted), the GIF encoder (now faster than gifenc from about 30 frames, and far truer in color) and the normal / lognormal draws (Chromium win; Firefox tie).

1. Stress at 10,000 items and above, normal arrangement: the last 5 to 9% of distance truth stays open for the quick arrangement (section 13, four rounds, all within noise). The slower **best quality** arrangement closes it (section 16). Open: making best quality faster still (the sweeps and the table of hop counts are each about half of the 4 to 5 s at 10,000 items); a graphics-card version of the sweeps is checked for correctness (end of section 16) but not built into the page.
2. Neighborhood preservation (section 15): four corrections on top of Stress failed (section 13); a separate arrangement with its own objective works (section 17). Open: its distance truth on networks with hubs (23 to 37% worse than ForceAtlas2), and checking the neighborhood score of the browsers' own runs (Node only so far).
3. GIF: the palette is a fixed cost that four frames cannot spread out (section 14). The histogram and the k-means step are what is left to trim.
4. Reading text over 512 million characters in Chromium needs a chunked reader; the import cap of 200,000 items / 800,000 links is still the app default.
5. A faster Force layout above 100,000 items; at that size it takes over a minute.
6. Rebuilding objects on the page is now the largest part of what the page itself still waits for when a big layout arrives (221 of 345 ms at 100,000 items in Chromium); handing out lazy views over the columns would remove it but touches about 150 places that read the layout.

## 7. Scorecard: one geometric mean for all the head-to-head results

How it is counted (you chose: each head-to-head counts once, with speed, memory and layout truth in the same mean):

- One comparison is one of our modules against one competitor on one data set in one browser. A ratio is the competitor's result divided by ours, so above 1 means we are better: 2.0× is twice as fast, uses half the memory, or draws a picture twice as true to the real link distances. Speed ratios are time ÷ time, memory ratios are bytes ÷ bytes, layout truth is the competitor's score ÷ ours (lower score is truer), crossings and group match are done the same way, and GIF file size counts as memory.
- A win is a ratio over 1.03, a tie is within 3%, a loss is under 0.97. Nothing is weighted: a 60× win and a 1.1× win each count once, and the geometric mean (the n-th root of the product) is the right average because 2× faster and 2× slower cancel exactly.
- Speed comparisons where both times are under 3 ms were dropped (Firefox's timer steps in whole milliseconds); 4 comparisons.
- "First place" means our module beats every competitor in that row (for example Stress against both d3-force and ForceAtlas2 at 3,000 complex items in Firefox).

**Overall** (a ratio above 1 means our module is better; a win is a ratio over 1.03, a tie is within 3%)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Speed only, both browsers | 314 | 256 / 7 / 51 | 2.20× |
| Speed only, Chromium 154 | 157 | 132 / 2 / 23 | 2.37× |
| Speed only, Firefox 158 | 157 | 124 / 5 / 28 | 2.04× |
| Speed + memory + layout truth, both browsers | 502 | 393 / 11 / 98 | 1.76× |
| Speed + memory + layout truth, Chromium 154 | 252 | 201 / 4 / 47 | 1.85× |
| Speed + memory + layout truth, Firefox 158 | 250 | 192 / 7 / 51 | 1.68× |

**First places on speed:** one benchmark row is one data set in one browser (for example Stress at 3,000 complex items in Firefox, against d3-force and ForceAtlas2 together). We come first, ahead of every competitor in the row, in 115 of 160 rows (Chromium 60 of 80, Firefox 55 of 80).

**By area** (both browsers, all metrics in the area)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| CSV parsing | 116 | 77 / 4 / 35 | 1.17× |
| Stress layout | 80 | 80 / 0 / 0 | 5.49× |
| Stress layout truth | 80 | 68 / 0 / 12 | 1.35× |
| Force layout | 80 | 66 / 3 / 11 | 1.78× |
| Force layout truth | 80 | 63 / 0 / 17 | 1.09× |
| Layered drawing | 12 | 12 / 0 / 0 | 14.8× |
| Layered drawing truth | 12 | 0 / 0 / 12 | 0.60× |
| Found groups | 6 | 6 / 0 / 0 | 2.23× |
| Found groups truth | 6 | 0 / 4 / 2 | 0.96× |
| Random draws | 14 | 11 / 0 / 3 | 1.62× |
| Formulas | 2 | 2 / 0 / 0 | 4.34× |
| GIF export | 8 | 2 / 0 / 6 | 0.97× |
| GIF export truth | 4 | 4 / 0 / 0 | 12.5× |
| Network memory | 2 | 2 / 0 / 0 | 4.26× |

**By competitor** (all areas and metrics)

| | comparisons | wins / ties / losses | geometric mean (other ÷ ours) |
| --- | ---: | ---: | ---: |
| Papa Parse | 58 | 39 / 2 / 17 | 1.18× |
| d3-dsv | 58 | 38 / 2 / 18 | 1.16× |
| d3-force | 160 | 145 / 0 / 15 | 2.17× |
| ForceAtlas2 | 160 | 132 / 3 / 25 | 1.75× |
| dagre | 6 | 6 / 0 / 0 | 8.85× |
| dagre (crossings) | 6 | 0 / 0 / 6 | 0.66× |
| ELK | 6 | 6 / 0 / 0 | 24.8× |
| ELK (crossings) | 6 | 0 / 0 / 6 | 0.55× |
| Louvain | 6 | 6 / 0 / 0 | 2.23× |
| Louvain (match) | 6 | 0 / 4 / 2 | 0.96× |
| d3-random | 10 | 9 / 0 / 1 | 1.86× |
| jStat | 4 | 2 / 0 / 2 | 1.13× |
| expr-eval | 2 | 2 / 0 / 0 | 4.34× |
| gifenc | 12 | 6 / 0 / 6 | 2.27× |
| graphology | 1 | 1 / 0 / 0 | 1.88× |
| Cytoscape | 1 | 1 / 0 / 0 | 9.63× |

**Each area counted once:** the geometric mean of the 14 area means is 2.30×. Left out as below timer resolution: 4 comparisons.

Reading it plainly: counting every comparison once, we are **1.76× better on average** (393 wins, 11 ties, 98 losses out of 502; 1.85× in Chromium, 1.68× in Firefox), and **2.20× faster on speed alone**. We come first in 115 of the 160 speed rows. The mean is pulled up by Stress (5.5× faster than the two force layouts, with all 80 comparisons won), layered drawing (14.8× faster than dagre and ELK), formulas (4.3×) and the GIF encoder's color accuracy (12.5× lower error); it is pulled down by the places that are honestly behind: layered-drawing crossings (0.60×, we draw more crossings), GIF file size and the short 4-frame run (GIF export overall 0.97×, two wins and six losses), Firefox's normal draws, and CSV parsing, which is only 1.17× ahead on average with 35 losses out of 116 (mostly small unquoted files and whole-file parses that Papa Parse reads about as fast). Weighting each of the 14 areas equally instead of each comparison gives 2.30×.

Three things the scorecard cannot show. First, the Stress truth rows score only distances, so they do not credit what no competitor offers: zero overlapping items (section 12). Second, because of that guarantee the Stress truth rows are scored against pictures where the competitors are allowed to put items on top of each other; if they were made to separate their items as we do, their truth would fall (section 12 measures d3-force with a collision force: it stays about as true, but 3.6 to 17% of its items still touch, and it takes 1.5× longer than d3-force without it and 8 to 29× longer than ours). Third, distance truth is not the only way to judge a layout: on neighborhood preservation (are my linked items the ones nearest to me on the page?) our Stress layout is clearly behind d3-force and ForceAtlas2 (section 15).

Two things the scorecard cannot show. First, the Stress truth rows score only distances, so they do not credit what no competitor offers: zero overlapping items (section 12). Second, because of that guarantee the Stress truth rows are scored against pictures where the competitors are allowed to put items on top of each other; if they were made to separate their items as we do, their truth would fall (section 12 measures d3-force with a collision force: it stays about as true, but 3.6 to 17% of its items still touch, and it takes 1.5× longer than d3-force without it and 8 to 29× longer than ours).

Re-create the table: `node bench/geomean.js` (add `--json` for every individual comparison).

## 8. Reading zips, Excel and graph files

What the Data tab now takes (drop, choose files, or choose a folder): a **.zip** of anything below (any mix, folders inside, other zips inside up to 2 levels deep), **Excel .xlsx** (each sheet becomes a table; dates stay dates; sheets are merged by item name, so one sheet of links and another that describes the items work together), **GraphML** (including the labels yEd writes), **GEXF** (Gephi), **GML**, **Graphviz DOT** (clusters become groups, `{a b} -> {c d}` sets and `a -> b -> c` chains work), and everything that already worked (CSV, tab, semicolon and bar tables, JSON in many shapes, arrow lines, outlines, Markdown notes). Old `.xls` and `.ods` are named in a note with "Save as .xlsx or CSV". A table that only describes items (`id, label, group`, with no link columns) is now read as items instead of as a list of links.

Safety limits (all counted on what is really unpacked, never on what the file claims, so a zip bomb stops at the limit):

| Limit | Value |
|---|---|
| Files listed in one zip | 20,000 (first 5,000 text files are read) |
| One text file | 60 MB (a spreadsheet sheet: 150 MB of XML) |
| Everything unpacked from one drop, all zips together | 400 MB |
| Zip file itself | 300 MB |
| Zips inside zips | 3 levels |
| Names | cleaned of `..`, leading `/` and `\`; nothing is ever written to disk |
| Checks per file | the size and CRC-32 must match what the zip says; encrypted files and unknown compression methods are skipped with a note |

A bad file inside a zip is skipped with a plain-words note and the rest still loads. If the outer file is not a zip, or nothing readable is inside, the Data tab says so in words.

## 9. Testing and memory safety

Everything below was run on the final code (Node 22.22, Chromium 154, Firefox 158).

| Test | What it throws at the code | Result |
|---|---|---|
| `test/archive.test.js` (Node, 17 checks, 6 s) | Mixed zips, stored and deflated entries, junk in front of a zip, UTF-16 and Latin-1 text, nested zips, path tricks, Excel with dates, booleans, blank rows and a cell at the far corner of the sheet, a 300 MB zip bomb that lies and one that tells the truth, a total-size budget, bad checksums, cut-off data, password flags, odd compression methods, lying offsets and counts, 30,000-entry zips, 60,000-character names, hostile nesting in XML, GML and DOT, entity tricks, 3,000 files merged in linear time | all pass |
| `test/fuzz.test.js` (Node, three seeds of 70 s each) | about 600,000 random and mutated documents through every importer (tables, JSON shapes, arrows, outlines, notes, DOT, GML, GraphML, GEXF), about 118,000 randomly damaged zips and workbooks, 7 files full of `__proto__` and `constructor` keys, 12 awkward graph shapes through two layouts (empty, one item, self-link, stars, cliques, NaN and infinite weights), 120 random graphs through the Stress layout, then fixed dense-link, leak and bomb-release loops | 0 failures; 0 prototype pollution; every refusal in plain words; no damaged zip took over 2 s |
| `test/layout.test.js` (Node, 6 checks, 3 s) | Network layouts of 600 leaves on one hub (all wanting the same spot), several pieces, a pair and loners, a radial tree of 2,000 items, and 5,000 items in pivot mode: after layout, a grid search must find **no two items touching** | 0 failures; 0 touching in every case |
| `test/pack.test.js` (Node, 9 checks, 4 s) | A packed layout, once unpacked, is the same set of plain objects (same fields, order and values) as the original, for NaN, Infinity, -0, huge numbers, odd text, nulls, mixed columns, small results and a field named `__proto__` (never packed) | 0 failures |
| `test/fuzz.browser.js` (inside the real page) | The same zip damage run through the browser's own `DecompressionStream`, two 150 MB zip bombs, and 600 unzip-and-read laps with the process memory watched | see below |
| `test/browser.test.js` (both browsers, plus the packed page) | A zip of CSV, JSON, Excel and GraphML dropped through the real file picker, an Excel file alone, a damaged zip, a zip bomb (stopped in about 1.5 s with the rest still read), a GML file | all pass |

**Real bugs the new tests found, now fixed**
1. Outlines and notes with old-Mac (`\r`-only) or Unicode line endings crashed the outline reader. Every reader now splits on all line endings.
2. A `null` entry in a JSON `links` list (or any non-object) crashed the JSON reader.
3. Merging many files copied the whole graph once per file (quadratic): 3,000 files now merge in about 1 second. A single bad file among many is skipped with a note instead of cancelling the whole import.
4. A table with just `id, label, group` columns was read as a list of links (item to label) instead of as items.
5. The Stress layout writes into fixed-size arrays, and writing past the end of a typed array is silently ignored in JavaScript. A check now throws a clear error if the pair list could ever overflow (the 40 random graphs and the dense-link runs never hit it).

**Memory**
- Node: 48 rounds of unzip, read and two layouts: heap 483.1 MB to 483.3 MB (flat). A 120 MB zip bomb opened repeatedly releases all of its buffers (0.2 MB before and after).
- Browsers: see the table the browser fuzz printed (below). Firefox lets garbage pile up during hundreds of thousands of rapidly failing streams and returns it within about 12 seconds; the test waits for that and checks the settled number.

| Browser (30 s of damage) | Cases | Memory over 4 rounds of 150 unzip-and-read laps | Right after the damage run | After 12 s of tidying |
| --- | --- | --- | --- | --- |
| Chromium 154 | 154,914 damaged zips (0 unexpected errors, 0 slow) | 851 (start) -> 902 -> 926 -> 931 -> 936 MB | 1096 MB | 873 MB |
| Firefox 158 | 103,804 damaged zips (0 unexpected errors, 0 slow) | 1047 (start) -> 1279 -> 1250 -> 1292 -> 1226 MB | 5277 MB | 1077 MB |

Both bombs (a zip that claims 100 bytes but holds 150 MB, and one that honestly holds 150 MB, which is over the 60 MB limit for one file) are refused in under 0.6 s in both browsers, without unpacking more than the limit. The peak in the 'right after' column is Firefox collecting the leftovers of about 100,000 rapidly failing streams, which can reach several GB on this machine for those 30 seconds; a normal drop opens at most a few thousand streams.

**Dense links** (Node): 200 items with 15,704 links read in 48 ms and laid out in 67 ms; 1,000 items with 95,000 links in 225 + 786 ms; 2,000 items with 195,000 links in 561 + 2,506 ms (+212 MB heap); 1,000 items with 330,000 links in 1.1 + 2.2 s; one hub with 150,000 links is read whole.

## 10. Would another language noticeably help? WebAssembly experiment

The one loop that does the work in the Stress layout (one sweep over the pairs, 30 to 36 times) was written in C (`bench/wasm/sweep.c`, 515 bytes of WebAssembly, 512 with SIMD), and the engine was run with and without it on the same graphs. The WebAssembly version gives the same positions (bit for bit on these runs). The time includes copying the pairs into WebAssembly memory once and the item positions in and out on every sweep. Whole layout, best of 3, milliseconds (`node bench/wasm/exp.js`):

**Node 22 (V8, the engine inside Chromium)**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,389 ms | 1,489 ms (0.93×) | 1,281 ms (1.08×) | yes |
| 10,000 | moderate | 709 ms | 519 ms (1.37×) | 477 ms (1.49×) | yes |
| 30,000 | moderate | 2,322 ms | 2,082 ms (1.12×) | 1,844 ms (1.26×) | yes |
| 10,000 | complex | 657 ms | 541 ms (1.21×) | 617 ms (1.06×) | yes |

**chromium 154.0.8037.97**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,707 ms | 1,245 ms (1.37×) | 1,388 ms (1.23×) | yes |
| 10,000 | moderate | 602 ms | 452 ms (1.33×) | 439 ms (1.37×) | yes |
| 30,000 | moderate | 2,366 ms | 1,926 ms (1.23×) | 1,845 ms (1.28×) | yes |
| 10,000 | complex | 648 ms | 586 ms (1.11×) | 507 ms (1.28×) | yes |

**firefox firefox/158.0**

| items | structure | JavaScript | WebAssembly | WebAssembly + SIMD | same positions |
| ---: | --- | ---: | ---: | ---: | --- |
| 3,000 | moderate | 1,945 ms | 1,419 ms (1.37×) | 1,529 ms (1.27×) | yes |
| 10,000 | moderate | 711 ms | 505 ms (1.41×) | 569 ms (1.25×) | yes |
| 30,000 | moderate | 2,771 ms | 2,050 ms (1.35×) | 2,326 ms (1.19×) | yes |
| 10,000 | complex | 707 ms | 596 ms (1.19×) | 548 ms (1.29×) | yes |

What it says:
- **Gain: 1.1 to 1.4× on the whole layout**, about the same in all three engines, and not always more with SIMD. Node's first row even came out slower (1,389 ms against 1,489). That is real but not a change you would notice by eye. The 20 to 58× that Stress gained over d3-force at 10,000 items came from algorithms and typed arrays (section 3), not from the language.
- Most of what the app does is not arithmetic in a loop: reading text, building objects, drawing with the browser's canvas, WebGL or WebGPU, and the DOM. Those run in the browser's own native code already; compiling our JavaScript to WebAssembly would not make them faster, and text handling often gets slower once strings have to cross into WebAssembly.
- A second toolchain (clang, wasm-ld, or Rust) and a fallback for browsers without it would be needed, for roughly 25% on one module. The cost to the single file is trivial (the binary is under 1 KB); the cost to maintenance is not.
- What could give a large gain, and was **not measured here**: WebGPU compute for force layouts above 100,000 items (the only layouts that hit the 5-minute limit), and moving the whole Stress pipeline (breadth-first searches, pair building, overlap removal) into WebAssembly so the data never leaves its memory. Expect somewhere around 1.5 to 2× for the second, and a much larger step for the first, but only on machines where WebGPU works (Firefox 158 headless here had none).
- Web Workers are already used: the engine runs off the page's thread, so the interface stays responsive during layouts.

## 11. Your questions about definitions and limits

**How is "truest layout" defined and measured?** Truest means: distances on the page match how far apart the items really are in the network. For a layout, take the shortest path (number of links, in either direction) between pairs of items as the real distance `d`, and the distance between the items' centers on the page as `e`. Because a picture can be zoomed freely, find the single best zoom `s = Σ(e/d) / Σ(e²/d²)` and score the layout as the mean of `(d − s·e)² / d²`. Zero is a picture where every pair is exactly proportional; lower is truer. Dividing by `d²` makes neighbors matter most: getting two linked items placed far apart costs much more than misplacing two items that are 12 hops apart. To keep the check cheap, 60 evenly spaced source items are used, and each is compared with every other item (every 7th item above 3,000 items). It is the same number for every competitor, measured on their finished positions (`bench/suites.js`, `bench/stress-tune.js`). Two cautions: it is the quantity Stress minimizes, so Stress is naturally good at it; and it ignores item size, so d3-force and ForceAtlas2, which place points and never make room for boxes, are not penalized for overlaps, while ours guarantees that no two items touch. That guarantee is a vital advantage, not a footnote: a picture whose items sit on top of each other cannot be read, and the score gives those pictures credit for it. Keeping items apart costs a little truth, and the benchmark scores ours with that cost included (section 12 has the numbers). A third caution, found later: it is a distance measure, and on a local measure (do linked items sit nearest to each other?) our Stress layout scores clearly below d3-force and ForceAtlas2 (section 15). Layered-drawing quality is measured separately, as the number of crossing lines, and found groups as how well they match the planted groups.

**Are item counts only nodes? Do they limit how many links an item can have?** The counts are items (nodes) only. Links are limited separately, and one item can have as many links as the file has: a single hub with 150,000 links read whole, and 1,000 items with 330,000 links laid out in about 3 seconds. The app's default import caps are 200,000 items and 800,000 links, whichever comes first, with a plain-words note when reached (the benchmarks lift them to measure 1,000,000 items). The scale tables use about 1 link per item (simple), 3 (moderate) and 4.2 (complex, so the 1,000,000-item complex file holds 4.2 million links). More links per item makes everything cost more (reading is linear in links; the Stress layout's work grows with items times pivots plus links, and its pair memory is capped near 12 million pairs), but the cost is smooth and nothing stops at a link count.

**Did the network-mapping research improve our engine, in speed or quality?** Yes in speed, mixed in quality, and none of it came from copying library code (the research only compares; no code was taken). Measured on the same six-cluster test network (`docs/RESEARCH-open-source-comparison.md`, section 7, and sections 1 to 4 above):
- Speed: overlap removal was 9.9 of 12 seconds at 10,000 items and is about 4× faster; Stress at 10,000 items went from about 15.6 s to 1.2 to 2.1 s (14 to 23× faster than d3-force at that size); the minified build is 31% smaller; layout result memory fell 9% (17.8 to 16.3 MB at 10,000 items) and the pair lists use about a fifth of the memory.
- Quality: at 3,000 items Stress truth went from 0.286 to 0.224 and Force from 0.222 to 0.154 (d3-force: 0.179), so Force is now truer than d3-force there. Stress at 10,000 items is now 10% truer to 9% less true than d3-force (it was 7 to 28% less true), and, unlike d3-force and ForceAtlas2, it leaves no two items touching.
- Not improved: the layered flow drawing still has 60 to 100% more crossings than dagre and ELK (it is 7 to 117× faster), our own Louvain groups were not written, and GIF export is slower than gifenc on a short cold run (it is now faster from about 30 frames and far truer in color; section 14). The research listed these; they remain on the work list.

## 12. No two items touch: the comparison that the truth score cannot show

d3-force and ForceAtlas2 place points. They have no idea how big an item is, so at the item sizes this app draws they put most items on top of other items. Our network layouts (Stress and Force) finish with a step that removes every overlap, and that step is guaranteed, not best effort: push-apart passes, then (if any pair still touches) stretch the whole picture by 10% and repeat, up to 12 times (the truth score does not change when a picture is scaled), then move each remaining item to the nearest free spot on an outward spiral, which cannot land on another item. A test checks it (`test/layout.test.js`), and 40 layouts per browser were checked in Chromium and Firefox. This costs some truth and some time, and both costs are inside the numbers in sections 2 and 7. The competitors are scored without any such cost.

**How it was measured** (`node bench/overlap.js moderate 1000 3000 5000 10000`, Node 22, single runs; times indicative). The same network went to every method. Each competitor's picture was scaled so the median link is 130 units long, with every item drawn as a disc of the radius our layout gives it. "Items touching" is the share of items whose disc overlaps another item's disc. "Zoom" is how many times bigger the whole page would have to be for the worst pair to just separate (1 means nothing touches). "d3-force + forceCollide" is the standard way to make d3-force respect size: link distance 130, charge −300, collision radius equal to the item radius. ForceAtlas2 has its own "adjust sizes" switch; an attempt to emulate it here gave a visibly broken picture (truth 0.25, every item overlapping), so it is not shown and not claimed.

| network | items | method | time | truth (lower = truer) | overlapping pairs | items touching | zoom needed |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| moderate | 1,000 | **ours (Stress)** | 269 ms | 0.137 | **0** | **0%** | **1** |
| moderate | 1,000 | d3-force | 1.4 s | 0.198 | 1,141 | 81% | 7.2 |
| moderate | 1,000 | d3-force + forceCollide | 2.1 s | 0.195 | 34 | 6.5% | 1 |
| moderate | 1,000 | ForceAtlas2 | 1.5 s | 0.171 | 917 | 78% | 3.6 |
| moderate | 3,000 | **ours (Stress)** | 1.7 s | 0.152 | **0** | **0%** | **1** |
| moderate | 3,000 | d3-force | 6.3 s | 0.194 | 10,786 | 95% | 13 |
| moderate | 3,000 | d3-force + forceCollide | 8.3 s | 0.193 | 151 | 9.8% | 1 |
| moderate | 3,000 | ForceAtlas2 | 5.1 s | 0.176 | 9,483 | 95% | 6.4 |
| moderate | 5,000 | **ours (Stress)** | 782 ms | 0.198 | **0** | **0%** | **1** |
| moderate | 5,000 | d3-force | 11 s | 0.182 | 29,863 | 98.5% | 34 |
| moderate | 5,000 | d3-force + forceCollide | 16 s | 0.182 | 317 | 12% | 1 |
| moderate | 5,000 | ForceAtlas2 | 9.8 s | 0.183 | 27,069 | 98% | 7.4 |
| moderate | 10,000 | **ours (Stress)** | 1.5 s | 0.203 | **0** | **0%** | **1** |
| moderate | 10,000 | d3-force | 27 s | 0.190 | 122,584 | 99.6% | 48 |
| moderate | 10,000 | d3-force + forceCollide | 42 s | 0.189 | 916 | 17% | 1 |
| moderate | 10,000 | ForceAtlas2 | 25 s | 0.183 | 110,558 | 99.5% | 17 |
| planted groups | 5,000 | **ours (Stress)** | 813 ms | 0.195 | **0** | **0%** | **1** |
| planted groups | 5,000 | d3-force | 12 s | 0.195 | 18,402 | 92% | 13 |
| planted groups | 5,000 | d3-force + forceCollide | 16 s | 0.193 | 297 | 11% | 1 |
| planted groups | 5,000 | ForceAtlas2 | 10 s | 0.191 | 15,562 | 92% | 6.6 |
| simple tree | 5,000 | **ours (Stress)** | 696 ms | 0.184 | **0** | **0%** | **1** |
| simple tree | 5,000 | d3-force | 12 s | 0.206 | 3,021 | 70% | 7.8 |
| simple tree | 5,000 | d3-force + forceCollide | 18 s | 0.206 | 99 | 3.6% | 1 |
| simple tree | 5,000 | ForceAtlas2 | 10 s | 0.206 | 242 | 8.8% | 2.6 |

Reading it:
- **Ours is the only one with nothing touching**, in every row, at every size. d3-force and ForceAtlas2 leave 70 to 100% of items overlapping (the one low value, ForceAtlas2 on a plain tree, is 8.8%, because a tree spreads itself out).
- **Adding a collision force to d3-force helps but does not finish the job**: 3.6 to 17% of the items still touch after the extra pass, it takes 1.5× longer than d3-force alone, and it is 8 to 29× slower than ours. Its truth stays about the same, so it too pays for separating items, but it pays more and does not get there.
- **The truth cost of our guarantee is small and visible.** Compared with d3-force and ForceAtlas2 as they come (overlapping), ours is truer through 3,000 items, 7 to 9% less true than d3-force at 5,000 and 10,000 items on the moderate network, level with it on the planted-groups network and truer on the plain tree at 5,000 items. Comparing like with like (both with items apart) is not possible with the competitors as published, which is the point.
- **How it got here.** The first version of this round still left 2,400 overlapping pairs at 5,000 items and 10,341 at 10,000 (64% of items touching, zoom 187×), and the engine as committed before it left 8,412 at 5,000; no test had looked at this. The fix first moved each leftover item to the nearest free spot; that made the truth at 10,000 items blow up to 0.68 to 0.72, because items in a dense core get moved far. Stretching the whole picture before the spiral step brought it back to 0.20.

## 13. Stress for 10,000+ items: what was tried and what stayed

`docs/RESEARCH-r-packages.md` lists the methods read (graphlayouts sparse stress and pivot MDS, igraph, packcircles, ggrepel) and has the full table of tried ideas. The short result: the change that mattered was giving the short-range pairs more weight in the sample (100 nearest neighbors per item instead of 16, pivot terms at 0.3 of the normal weight), because the truth score divides each pair's error by the squared hop count, so nearby pairs carry most of it and 16 per item under-sampled them. Three ideas that looked promising did not help: a coarse-first multilevel start (same truth at twice the time), the region-size pivot weights of the sparse stress paper (unstable under gradient descent, 0.204 to 0.27), and fresh random source items on every sweep (worse).

**Chromium 154, before this round and now** (time / truth; the "before" engine left items overlapping, the "now" engine does not)

| network | items | before | now |
| --- | ---: | ---: | ---: |
| simple | 10,000 | 641 ms / 0.231 | 1.2 s / 0.192 |
| moderate | 10,000 | 853 ms / 0.213 | 1.6 s / 0.207 |
| complex | 10,000 | 928 ms / 0.233 | 1.5 s / 0.205 |
| planted groups | 10,000 | 1.1 s / 0.240 | 1.5 s / 0.203 |
| moderate | 3,000 | 1.9 s / 0.151 | 2.0 s / 0.151 |

At 10,000 items the engine now spends 1.4 to 1.9 times as long and is 3 to 17% truer, and now guarantees that nothing touches (the "before" engine left overlaps: 8,412 pairs at 5,000 items). Node measurements for the middle sizes: 3,500 items 0.234 to 0.189; 5,000 items 0.235 to 0.199. Raising the all-pairs limit from 3,000 to 4,000 items gives 0.156 at about 3 s, against 0.204 for the sparse method at that size. All pairs at 10,000 items would be 0.160, but takes 18.6 s.

**Tried a second time, and not kept** (Node, moderate network, 10,000 items; the engine as it stands scores 0.203 in 1.5 s):

| Idea | Truth | Time |
|---|---:|---:|
| Pivot-MDS start (Brandes and Pich 2006) instead of the spiral | 0.209 | 1.9 s |
| Pivot-MDS start with 20 sweeps instead of 36 | 0.210 | 1.5 s |
| Majorization polish after the sweeps, 8 steps | 0.204 | 1.8 s |
| Majorization polish, 20 steps | 0.206 | 2.4 s |
| 20 sweeps then 12 majorization steps | 0.210 | 1.6 s |
| Lighter pivot weight (0.1) plus 6 majorization steps | 0.211 | 1.6 s |
| Pivots at the centers of k-means groups of a pivot-MDS picture | 0.214 (complex network: 0.197 against 0.198) | 1.8 s (complex: 2.0 s against 1.7 s) |
| 160 nearest neighbors per item (was 100) | 0.200 | 1.9 s |
| 50 sweeps (was 36) | 0.204 | 1.6 s |

Single runs, so differences under about 0.005 are noise. A pivot-MDS start gives the right global shape, but the truth score is limited by local detail, which the extra neighbor pairs already supply. Majorization is stable with any weights, but as a polish it does not beat the annealed sweeps. 160 neighbors buys 0.003 for 30% more time. None of this code was kept.

**A third round, after reading the recent papers** (`docs/RESEARCH-layout-papers.md`). Same network and method as above, truth then time; the baseline row is the engine as it stands. Differences under about 0.005 are noise (the same setting scored 0.199 on the moderate network and 0.208 on the complex one).

| Idea | moderate | complex | planted | simple |
|---|---:|---:|---:|---:|
| Engine as it stands | 0.203 | 0.198 | 0.205 | 0.199 |
| Lower final step size (0.03; the engine uses 0.1) | 0.199 | 0.208 | 0.206 | 0.195 |
| Lower final step size 0.02 | 0.213 | 0.202 | 0.205 | 0.192 |
| Lower final step size 0.03 and pivot weight 0.15 | 0.215 | 0.203 | 0.202 | 0.193 |
| Final step size 0.3 / 0.01 | 0.204 / 0.210 | – | – | – |
| Pivot terms heavy early, light late (3× to 0.3×) | 0.208 | – | – | – |
| Pivot terms light early, heavy late (0.3× to 3×) | 0.206 | – | – | – |
| 300 pivots instead of 30 to 120, weight 0.3 / 0.1 / 1.0 | 0.209 / 0.206 / 0.229 | – | – | – |
| 120 random pivots instead of the farthest-apart, weight 0.3 / 1.0 | 0.202 / 0.214 | – | – | – |
| 300 random pivots, weight 1.0 / 0.5 | 0.216 / 0.206 | – | – | – |

Link pairs weighted 3× and 8× (to pull linked items closer) moved nothing that matters: truth 0.123 and 0.125 against 0.121 on a 1,000-item tree, and 0.152 and 0.155 against 0.152 on 3,000 moderate items. None of this code was kept.

What the papers say, in short, and how it fits. Börsig, Brandes and Pásztor's re-test of the stochastic-gradient claim finds no significant difference in final stress between gradient descent and majorization once majorization is started well, and the start matters for majorization only; that matches our majorization and pivot-MDS-start results. The 2025 resistance-distance paper reports that random pair sampling beats pivot sampling on small graphs (100 to 1,000 items), but at 10,000 items our random pivots were not better (0.202 against 0.203), and giving far pairs more weight made things worse, not better. DRGraph, the t-distribution force layout and its sparse-negative-sampling successor optimize neighborhood preservation, not distances, and report worse stress than the stress methods; they are answers to a different question (section 15). The one clear lever left is the pair model itself: all pairs at 10,000 items scores 0.160 but takes 18.6 s, so the open question is a cheaper way to get most of that. The paper-backed route is a parallel majorization over all pairs on the graphics chip (about 100 MB for a 10,000 by 10,000 byte matrix of hop counts), which this environment cannot test.

**A fourth round: a neighborhood term, and majorization on every pair** (Node, single runs; the moderate network of 3,000 items unless noted). The aim was to lift neighborhood preservation (section 15) without giving up distance truth. Each row is truth then neighborhood score, against 0.152 and 0.007 for the engine as it stands.

| Idea | Truth | Neighborhood |
|---|---:|---:|
| Six gentle extra sweeps over the link and near pairs only | 0.155 | 0.001 |
| The same, link pairs weighted 3× | 0.157 | 0.000 |
| Twelve such sweeps, larger steps, link pairs 3×, near pairs 0.3× | 0.161 | 0.000 |
| A short-range push between items that are not linked (reach 1× the link length), 8 rounds | 0.566 | 0.006 |
| The same with reach 0.8×, 8 rounds | 0.206 | 0.005 |
| Push at 1.2× plus pulling long links in twice as hard, 15 rounds | 0.763 | 0.000 |
| A short cool Force run after Stress, 20 steps | 0.155 | 0.007 |
| The same, 40 steps, warmer | 0.161 | 0.007 |
| The same, 40 steps, warmest | 0.163 | 0.010 |

Nothing lifted the neighborhood score by more than noise, and the stronger versions cost distance truth. The reading: the score is low because of what Stress asks for (distances), and a correction on top of it fights the distances instead of improving the picture. None of this code was kept. Whoever wants closeness should pick Force, which was built for it.

On the same network at 5,000 items, majorization on every pair (all items moving together, a calculation a graphics card could run in parallel) reached 0.152 after 3 sweeps of the normal method plus 30 majorization steps, the same as 12 normal sweeps on every pair (0.152) or 30 (0.153), and 80 steps gave 0.152 again. Started right after a single sweep it stuck at 0.210. So majorization buys no truth over the sweeps once every pair is used; at most it could make the same result faster. That is the evidence behind the graphics-card question in section 16.

**What is left.** Against d3-force the gap at 10,000 items is 10% truer to 9% less true; against ForceAtlas2 it is 4% truer to 17% less true (section 2). The three ideas that were still untried last round (a pivot-MDS start, k-means pivots, majorization) have now been tried, above. A note on the limits of this evidence: the truth score is the quantity Stress minimizes, so it favors Stress over methods that do not optimize it; a different measure, such as how many of an item's nearest neighbors stay nearest on the page, could rank the methods differently, and was not measured.

## 14. Layout results as columns, the GIF encoder and the random draws

**Layout results as columns.** The worker used to send a big layout as one object per item (about 37 fields) and one per link (about 13 fields), which the browser copies field by field twice. Now each field travels as one typed array (text as one long string plus lengths) and the page rebuilds the same plain objects from them, so nothing that reads a layout had to change (`src/pack.js`, `test/pack.test.js`). Lists of objects with an odd shape fall back to being sent as they are, and small results (under 2,000 items) are not packed.

**Chromium 154**

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

**Firefox 158**

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

How to read it: "send as objects" is the browser's own copy of the whole layout (the page waits for about half of that, an estimate). Packing happens in the worker, so the page's own wait is "send packed" plus "unpack". The end-to-end saving (pack + send + unpack against the plain copy) is 2.5× at 100,000 items in Chromium and 1.8× in Firefox (1.5× at 30,000 items in both). The page's own wait falls by 3.2×, 1.2× and 2.9× at 10,000, 30,000 and 100,000 items in Chromium (1.7×, 1.3× and 2.7× in Firefox), so the gain is modest in the middle, where rebuilding the objects dominates. The earlier estimate of 70 to 100× counted only the arrays; rebuilding the objects on the page (the "unpack" column) is a real cost that stays. Handing out lazy views over the columns would remove it but touches about 150 places that read the layout, so it was not done.

**GIF encoder.** The changes: a faster path for runs of one color in the compressor (the output is byte for byte what the plain compressor writes, and a test compares the two), a changed-pixel list so that unchanged parts of a frame cost nothing, a small cache for nearest-palette-color lookups, and a palette made by median cut and refined by k-means. Quality is measured by decoding each GIF (with omggif) and comparing every pixel with the original frame (mean squared error per color channel; PSNR in decibels, higher is better). gifenc is given one palette for all frames (its fastest mode).

**Chromium 154**

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 109 ms | 68 KB | 0.016 / 66.1 dB | 61 ms | 63 KB | 0.159 / 56.1 dB |
| 31 | 960×540 | 238 ms | 521 KB | 0.023 / 64.5 dB | 296 ms | 487 KB | 0.287 / 53.6 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 160 ms | 40 ms | 6.3 ms | 19 ms | 80 ms | 25 ms |
| 30,000 | 90,029 | 547 ms | 152 ms | 24 ms | 201 ms | 274 ms | 225 ms |
| 100,000 | 299,762 | 2.0 s | 471 ms | 124 ms | 221 ms | 1.0 s | 345 ms |

**Firefox 158**

| frames | size | ours | file | ours: color error (MSE / PSNR) | gifenc | file | gifenc: color error |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 4 | 960×540 | 84 ms | 67 KB | 0.015 / 66.4 dB | 80 ms | 63 KB | 0.191 / 55.3 dB |
| 31 | 960×540 | 212 ms | 515 KB | 0.022 / 64.6 dB | 316 ms | 485 KB | 0.347 / 52.7 dB |

Sending a layout from the worker to the page (moderate network)

| items | links | send as objects (write + read) | pack (worker) | send packed | unpack (page) | page waits, objects (half of the send) | page waits, packed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10,000 | 29,813 | 162 ms | 31 ms | 4.0 ms | 45 ms | 81 ms | 49 ms |
| 30,000 | 90,029 | 644 ms | 186 ms | 18 ms | 225 ms | 322 ms | 243 ms |
| 100,000 | 299,762 | 1.9 s | 678 ms | 78 ms | 263 ms | 934 ms | 341 ms |

Reading it: ours is 10 to 16× lower in color error (+10 to +12 dB) in both browsers and at both lengths, which is visible as less banding, and 1.24× (Chromium) to 1.5× (Firefox) faster at 31 frames. On a 4-frame run it is 1.8× slower in Chromium (the palette work is a fixed cost that four frames cannot spread out) and level in Firefox (84 against 80 ms). Files are 6 to 8% larger (the reason was not isolated). That is a real trade, not a win on every axis.

**Where the 4-frame time goes in Firefox, and what was done about it.** A profile of the encoder (`bench/gif-profile.sh`; the suite is `gifprof`) shows, for the second of three runs in a fresh page (the number this document reports is the median of three runs), about 85 ms in Firefox 158: the palette 48 ms (the color histogram over 2 million pixels about 22 ms, the k-means step about 20 ms while the code is still cold and 5 ms when warm, the median cut 3 ms), mapping and comparing the four frames 22 to 29 ms, compressing 5 to 10 ms. The same run in gifenc is 63 ms: 12 ms to build one palette from one picture and about 13 ms per frame. So our per-frame work is already cheaper (about 7 ms against 13 ms warm) and the whole gap is the palette, which looks at four pictures and then refines the cut. The first run in a fresh page takes 100 to 135 ms and the third 55 to 70 ms (gifenc 56 to 60 ms), so most of the rest is the engine's code warming up.

**A correction.** The previous round reported that two palette changes made the encoder about 30% slower in Firefox and reverted them. That measurement ran the variants one after another; repeated in an interleaved test (five rounds of four fresh-page jobs per variant, three runs each) the committed encoder and the variants were the same within noise (second-run totals 83, 90, 96 and 91 ms), so those changes were neither a Firefox loss nor a Firefox gain. They were still left out.

**What shipped.** For pictures totaling over a million pixels the palette histogram now looks at every other pixel, and the k-means step runs 2 rounds instead of 3. In the same interleaved Firefox test the palette fell from 48 to 35 ms and the second-run total from 83 to 75 ms; the decoded color error in Node moved from 0.130 to 0.135 at 4 frames and from 0.137 to 0.132 at 31 frames, and the file size by about 1%. In the tables above (single runs) the 4-frame run is now level with gifenc in Firefox and 1.8× slower in Chromium (Chromium's timings on this machine swing by 30% from run to run, so that last number is rough). From about four frames on, the lower per-frame cost makes up for the palette.

**Random draws.** The normal draw is a Marsaglia and Tsang ziggurat with 128 layers, the exponential draw is a 256-layer ziggurat, and Poisson draws with a small mean invert a cached cumulative table (lognormal is the normal draw exponentiated). The same seed always gives the same numbers, and tests check the means, spreads and tail counts (`test/sim.test.js`). One million draws, in milliseconds:

**Chromium 154**

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 21 | 53 | 48 |
| lognormal | 80 | 103 | – |
| poisson | 57 | 363 | 84 |
| binomial | 263 | 635 | – |
| exponential | 30 | 45 | – |

**Firefox 158**

| distribution | ours | d3-random | jStat |
| --- | ---: | ---: | ---: |
| normal | 60 | 51 | 42 |
| lognormal | 82 | 87 | – |
| poisson | 78 | 308 | 55 |
| binomial | 364 | 562 | – |
| exponential | 37 | 45 | – |

Reading it: in Chromium ours is faster in every row (normal 2.3 to 2.5×, Poisson 1.5 to 6.4×, binomial 2.4×). In Firefox it is a tie or a loss on normal draws (1.2× slower than d3-random and 1.4× slower than jStat) and slower than jStat on Poisson (1.4×), but still faster than d3-random there (Poisson 3.9×, binomial 1.5×, lognormal and exponential 1.1 to 1.2×). Two honest notes: d3-random was given a fast simple generator (a multiplicative one), and jStat uses the browser's own random numbers, so both are favorable to them; and ours uses a stronger generator (mulberry32) than d3's multiplicative one, so the comparison is not slanted toward us. An attempt to speed up the normal draw further for Firefox did not change the result beyond noise, so it was left alone.

## 15. Neighborhood preservation: where the Stress layout is weaker

Distance truth (the score used everywhere above) asks whether page distances follow hop counts. A second, common measure asks something local: for each item, are the items it is linked to the ones nearest to it on the page? This is neighborhood preservation as used by tsNET and DRGraph: for 600 evenly spaced items with k links, the overlap (Jaccard) between the k linked items and the k nearest items on the page; 1 is perfect, higher is better. It was added to `bench/overlap.js` (Node, single runs; `ARR=force` runs our Force arrangement).

| network | items | ours: Stress | ours: Force | d3-force | d3-force + forceCollide | ForceAtlas2 |
|---|---:|---:|---:|---:|---:|---:|
| simple tree | 1,000 | 0.012 (truth 0.121) | 0.082 (0.172) | 0.109 (0.208) | 0.089 (0.208) | 0.159 (0.197) |
| complex | 1,000 | 0.020 (0.124) | 0.026 (0.140) | 0.034 (0.187) | 0.028 (0.197) | 0.045 (0.147) |
| moderate | 3,000 | 0.007 (0.152) | 0.011 (0.168) | 0.027 (0.194) | 0.024 (0.193) | 0.031 (0.178) |
| moderate | 5,000 | 0.001 (0.198) | – | 0.014 (0.182) | 0.013 (0.182) | 0.023 (0.179) |

Each cell is the neighborhood score with the distance truth in parentheses. Reading it:
- **Stress is clearly the weakest here**: 7 to 13× lower than the competitors on the tree, 1.4 to 2.3× on the complex network, 3 to 4× on moderate 3,000 and 13 to 23× on moderate 5,000. Its edge in distance truth is real, and so is this gap; the two measures disagree about which layout is better, which is a known property of the two measures, not a bug in either.
- **It is not the overlap removal.** With the push-apart, stretch and settle steps switched off the score is the same (0.012 on the tree, 0.006 against 0.007 on moderate 3,000), and it is the same for the all-pairs version used below 4,000 items. It comes from the stress model: it puts linked items at the target length and siblings only a little farther, so around a parent with seven or more children the siblings are nearer to each other than to the parent. Weighting link pairs 3× and 8× did not change it (0.010 and 0.013 on the tree).
- **Our Force arrangement is nearer the competitors**, and still behind ForceAtlas2, with the overlap guarantee in place.
- All scores are small on the networks with random cross links, because no two-dimensional picture can keep every item's links among its nearest items.
- **What this does not show.** It is one local measure on four networks and single runs. It says that "truest layout" depends on what is being asked: Stress for how far apart things really are, Force or ForceAtlas2 for who sits next to whom. The in-app wording for the arrangements should say so (it already points Stress at distances). A hybrid that adds a local term to the stress model, as the (SGD)² paper does for neighborhood preservation, is the natural next experiment and was not tried.

## 16. "Distances, best quality (slower)": every pair, for networks of 4,001 to 20,000 items

The normal Stress layout samples pairs (pivots, links and near neighbors) once a network has more than 4,000 items. That is fast, and it is the plateau described in section 13: about 0.20 at 10,000 items whatever was tuned. The remaining route was to use every pair of items, which is what the layout does up to 4,000 items. It is now available above that size as its own choice in the Arrangement list, **Distances, best quality (slower)**. Nothing else changes: the normal arrangement stays the default, and both guarantee that no two items touch.

How it fits in memory and time:
- Hop counts between all pairs are kept in one byte each, one byte per pair (50 MB for 10,000 items, 200 MB for 20,000). The old way, 16 bytes per pair, would need 800 MB at 10,000 items.
- Pairs are visited one offset at a time in a random order (item 1 against the item 7 places on, then item 2 against the item 7 places on, and so on). That is as good as a fully random order for the result, and memory is read in straight lines, which is what makes it fast. A first version that took each item against its next neighbors in turn reached only 0.19 to 0.21 at 5,000 items; the offset order reached 0.152.
- Building the table of hop counts is done 32 searches at a time (each item carries a 32-bit mask of the searches that reached it), which cut that step at 10,000 items from 4.8 s to 1.8 s with byte-for-byte identical tables.
- **Four sweeps up to 12,000 items, three above.** The first version used 12, 6 and 4. Four sweeps score the same as twelve at 5,000 items (moderate 0.153 against 0.152, complex 0.144 against 0.143, simple 0.133 against 0.133), and 30 sweeps gave nothing more (0.153). Three sweeps are a little weaker on some networks (simple tree 0.139), and two fail (0.212 at 10,000 items), because the step size has too few stops to come down. Complex networks at 10,000 items lost a little (0.146 to 0.150) in this change.
- The inner loop keeps the x and y of the items in separate lists and handles the pairs that wrap round to the start of the list as their own stretch; in isolation that made a sweep about 15 to 20% faster.
- A piece with a path longer than 254 hops (a long chain) is left to the normal method, because one byte cannot count that far; so is a device that cannot give the memory.

**Node, same machine, one run each** (time / truth, lower truth is truer; same item sizes for all; ours leave no items touching, d3-force and ForceAtlas2 leave 10 to 100% of items overlapping at these sizes, section 12):

| network | items | normal Stress | best quality | d3-force | ForceAtlas2 |
|---|---:|---:|---:|---:|---:|
| simple tree | 5,000 | 0.6 s / 0.184 | **1.0 s / 0.134** | 12.2 s / 0.206 | 9.6 s / 0.205 |
| simple tree | 10,000 | 1.0 s / 0.199 | **3.6 s / 0.137** | 27.4 s / 0.210 | 22.2 s / 0.199 |
| moderate | 5,000 | 0.9 s / 0.198 | **1.2 s / 0.153** | 10.5 s / 0.182 | 10.2 s / 0.182 |
| moderate | 10,000 | 1.8 s / 0.203 | **4.6 s / 0.161** | 26.3 s / 0.190 | 22.9 s / 0.184 |
| complex | 5,000 | 0.9 s / 0.201 | **1.3 s / 0.144** | 10.9 s / 0.187 | 10.9 s / 0.171 |
| complex | 10,000 | 1.6 s / 0.198 | **4.2 s / 0.150** | 27.1 s / 0.195 | 24.9 s / 0.179 |

At 20,000 items on the moderate network: 13.4 s, truth 0.163 (the first version took 28 s).

**In the browsers, 10,000 items** (time / truth, one run each; d3-force and ForceAtlas2 from section 2):

| network | browser | normal Stress | best quality | d3-force | ForceAtlas2 |
|---|---|---:|---:|---:|---:|
| simple | Chromium 154 | 1.1 s / 0.192 | 4.1 s / 0.137 | 25.6 s / 0.210 | 22.6 s / 0.201 |
| simple | Firefox 158 | 1.4 s / 0.190 | 4.7 s / 0.137 | 31.6 s / 0.210 | 20.4 s / 0.198 |
| moderate | Chromium 154 | 1.5 s / 0.207 | 4.9 s / 0.158 | 21.7 s / 0.190 | 24.0 s / 0.180 |
| moderate | Firefox 158 | 1.7 s / 0.204 | 5.3 s / 0.159 | 29.6 s / 0.190 | 21.0 s / 0.175 |
| complex | Chromium 154 | 1.6 s / 0.205 | 4.6 s / 0.151 | 24.5 s / 0.195 | 26.7 s / 0.179 |
| complex | Firefox 158 | 2.0 s / 0.207 | 5.8 s / 0.152 | 34.5 s / 0.195 | 22.6 s / 0.179 |

At 5,000 items the browsers took 1.2 to 1.7 s (truth 0.133 to 0.157). Raw numbers are in `bench/results/*-best.jsonl`.

Reading it:
- **At 5,000 to 20,000 items this closes the gap.** It is truer than d3-force and ForceAtlas2 on every network tried (12 to 31% truer at 10,000 items in Node, 9 to 32% in the browsers) and 5.0 to 9.6× faster than the faster of them in Node (3.9 to 5.5× in the browsers), and nothing touches. The normal arrangement remains the quick choice: 2.9 to 4.3× faster again in the browsers, and about 0.20 true.
- **Neighborhood preservation is not helped** (0.001 to 0.005 here against 0.008 to 0.02 for the others on the moderate networks): the same weakness as section 15.
- **Single runs, one machine, one generator.** Differences under about 0.005 are noise. The competitors were run with the settings used in section 2 and are not tuned further.

**The graphics-card question, with a check instead of a guess.** Majorization (every item moving at once to the weighted mean of where each other item wants it) is the form of this calculation a graphics card can run in parallel, and on the CPU it reaches the same truth as the sweeps, not a better one (section 13, fourth round). `bench/suites.js` now has a check, `gpumaj`, that runs 20 such steps in a WebGPU compute shader and again on the CPU from the same start and reports whether the two pictures agree, in plain words (`NFM_CHROME_ARGS='--enable-unsafe-webgpu ...' node bench/run.js chromium gpumaj`; the flags are in the plan). In Chromium 154 on the adapter available here, it agrees at 500, 1,500 and 3,000 items: the distance error is identical to the digit shown (2092.1, 2414.1 and 2570.2, from starts of 5,911, 32,407 and 71,986) and items differ by less than 0.05% of a link length. So the shader is right. What it does not tell is how fast a real card would be: that adapter is a software one, and its times (106, 638 and 2,450 ms against 53, 350 and 1,256 ms on the CPU) are not evidence either way. It is not part of the page. After the changes above, the sweeps are about half of the time at 10,000 items (roughly 2.2 of 4.5 s, the rest is the table of hop counts and the overlap step), so the most a card could save is about half, and only on a card that is fast enough to beat the CPU on a table of 100 MB moved across.

## 17. "Closeness (nearest are linked)": an arrangement for the neighborhood question

Section 15 showed that Stress is weak when the question is "are my linked items the ones nearest to me?", and section 13 (fourth round) that bolting a closeness term onto Stress does not work. So closeness is its own arrangement in the Arrangement list, **Closeness (nearest are linked)**, with its own objective instead of a correction:
- It starts from the Stress picture, so the overall shape is right.
- Then, for 150 rounds, every link pulls its two items together and each linked item is pushed away from 10 randomly chosen other items. The force falls off slowly with distance (the shape used by t-SNE and UMAP; the random pushes are the sampling used by LargeVis), the step shrinks to zero, and big pieces (over 20,000 items) use fewer rounds.
- The same steps as for Stress then stretch a crowded picture and separate any items that touch, so nothing touches.
- Seeded: the same data gives the same picture.

**Node, one run each** (neighborhood score / distance truth; higher neighborhood score is better, lower truth is truer; competitors from sections 12 and 15 and the runs of section 16, so the sizes differ by row):

| network | items | closeness | ForceAtlas2 | d3-force | our Force | normal Stress |
|---|---:|---:|---:|---:|---:|---:|
| simple tree | 1,000 | **0.208** / 0.154 | 0.159 / 0.197 | 0.109 / 0.208 | 0.082 / 0.172 | 0.012 / 0.121 |
| complex | 1,000 | **0.129** / 0.188 | 0.045 / 0.147 | 0.034 / 0.187 | 0.026 / 0.140 | 0.020 / 0.124 |
| moderate | 3,000 | **0.068** / 0.199 | 0.031 / 0.178 | 0.027 / 0.194 | 0.011 / 0.168 | 0.007 / 0.152 |
| simple tree | 5,000 | **0.165** / 0.195 | 0.091 / 0.205 | 0.072 / 0.206 | – | 0.000 / 0.184 |
| moderate | 5,000 | **0.047** / 0.197 | 0.020 / 0.182 | 0.014 / 0.182 | – | 0.001 / 0.198 |
| complex | 5,000 | **0.044** / 0.234 | 0.011 / 0.171 | 0.006 / 0.187 | – | 0.001 / 0.201 |
| simple tree | 10,000 | **0.143** / 0.202 | 0.061 / 0.199 | 0.067 / 0.210 | – | 0.002 / 0.199 |
| moderate | 10,000 | **0.028** / 0.200 | 0.011 / 0.184 | 0.008 / 0.190 | – | 0.000 / 0.203 |
| complex | 10,000 | **0.024** / 0.221 | 0.008 / 0.179 | 0.005 / 0.195 | – | 0.000 / 0.198 |

**In the browsers** (time / distance truth, one run each; nothing touched in any of the 18 runs):

| network | items | Chromium 154 | Firefox 158 |
|---|---:|---:|---:|
| simple tree | 1,000 / 5,000 / 10,000 | 0.4 s / 0.151, 1.2 s / 0.186, 2.6 s / 0.198 | 0.5 s / 0.153, 1.1 s / 0.186, 1.9 s / 0.192 |
| moderate | 1,000 / 5,000 / 10,000 | 0.7 s / 0.188, 2.8 s / 0.194, 4.5 s / 0.193 | 0.5 s / 0.191, 1.6 s / 0.197, 3.3 s / 0.194 |
| complex | 1,000 / 5,000 / 10,000 | 0.7 s / 0.202, 2.7 s / 0.225, 5.3 s / 0.246 | 0.5 s / 0.188, 2.0 s / 0.225, 3.3 s / 0.269 |

Reading it:
- **On the neighborhood question it wins every row**: 1.3 to 2.9× the neighborhood score of the best of ForceAtlas2 and d3-force at 1,000 to 3,000 items, and 1.8 to 4× at 5,000 and 10,000, while taking 1 to 5 s where the others take 10 to 35 s at 5,000 and 10,000 items.
- **It is not the choice for distances.** On the plain tree its distance truth is level with or better than ForceAtlas2 and d3-force (0.154 against 0.197 at 1,000 items, 0.195 against 0.205 at 5,000, 0.202 against 0.199 at 10,000); on moderate networks it is 8 to 12% less true, and on complex networks with hubs 23 to 37% less true (0.221 to 0.246 against 0.179 at 10,000 items). For distances use Distances (section 16 for big networks).
- **Runs differ between engines.** The same data scored 0.221 in Node and 0.246 and 0.269 in Chromium and Firefox for the complex network at 10,000 items; the optimization is sensitive to the last digits of the number routines. Single runs; differences under about 0.01 are noise.
- **What did not matter.** Starting step size 0.1 to 0.5, 80 to 600 rounds, 2 to 10 random pushes (more pushes raised the score a little at 5,000 items and were kept), and dividing each item's steps by its number of links, all moved the results by less than the run-to-run difference or in the wrong direction. A first version that started from the spiral instead of the Stress picture scored 0.202 on the 1,000-item tree but only 0.25 to 0.37 in distance truth.
- **A bug found on the way:** the step that stretches a crowded picture before separating items was only applied to Stress; without it the complex network at 5,000 items scored 0.225 even with zero rounds of the new method. Closeness now gets it too.

## Reproduce

```
cd bench && npm install && node build-libs.mjs      # bundles the libraries into bench/dist/libs.js
node run.js chromium csv                             # or: firefox
node run.js chromium stress
node run.js chromium typed
node run.js chromium compare
node run.js chromium closeness                      # or: firefox; the closeness arrangement in the browser (section 17)
node run.js chromium stressBest                    # or: firefox; the best-quality arrangement next to the normal one (section 16)
NFM_CHROME_ARGS='--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader --use-gl=angle --use-angle=swiftshader --ignore-gpu-blocklist' node run.js chromium gpumaj   # does a WebGPU majorization agree with the CPU one? (section 16)
node run.js chromium stressOurs                      # or: firefox; only our Stress, quick re-run after a change
node run.js chromium refresh                         # or: firefox; the parts of the compare suite that changed (draws, GIF)
node run.js chromium pack                            # or: firefox; sending a layout from the worker, packed or not
node merge.js /tmp/new.jsonl results/chromium-stress.jsonl   # fold a partial re-run (new, then old) into the results file
ARR=closeness ONLY=ours node overlap.js moderate 5000   # also ARR=stressBest; the neighborhood score and truth of one of our arrangements
node overlap.js moderate 1000 3000 5000 10000        # Node only: items left touching and neighborhood preservation, ours against d3-force and ForceAtlas2 (ARR=force for our Force arrangement)
sh gif-profile.sh firefox /tmp/out.jsonl             # GIF phase timings (instruments src/gif.js for the run, then restores it; section 14)
node ../test/archive.test.js && node --expose-gc ../test/fuzz.test.js 70   # zips, Excel, graph files; random and hostile input
node ../test/fuzz.browser.js chromium 30            # or: firefox
node wasm/exp.js                                    # WebAssembly experiment (sweep.c is built with clang, see its header)
node run.js chromium limits                          # about 15 minutes per browser
node report.js                                       # all tables, from bench/results/*.jsonl
node stress-tune.js moderate 10000 before '{}'       # Node-only side by side of stress settings
```

Set `NFM_CHROME` and `NFM_FIREFOX` to the browser programs, and `NFM_PLAYWRIGHT` / `NFM_PUPPETEER` to the driver libraries when they are not in the default places (see `bench/driver.js`).
